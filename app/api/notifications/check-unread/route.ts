import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendUnreadMessageEmail } from "@/lib/email";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";


async function handler(req: Request) {
    try {
        const { messageId } = await req.json();

        if (!messageId) {
            return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
        }

        // fetching message alogn with receiver, sender, and item info
        const message = await db.chatMessage.findUnique(
            {
                where: {
                    id: messageId,
                },
                include: {
                    receiver: { select: { name: true, email: true } },
                    sender: { select: { name: true } },
                    item: { select: { title: true } },
                },
            },
        );

        if (!message) {
            return NextResponse.json({ message: "Message not found" });
        }

        // send notification if receiver has NOT read the message yet
        if (!message.read) {
            if (message.receiver.email) {
                await sendUnreadMessageEmail({
                    toEmail: message.receiver.email,
                    recipientName: message.receiver.name || "User",
                    senderName: message.sender.name || "Someone",
                    itemTitle: message.item.title,
                    messagePreview: message.content ?? "You received a message.",
                    conversationId: message.conversationId,
                });

                return NextResponse.json({ success: true, emailSent: true });
            }
        }

        return NextResponse.json({ success: true, emailsend: false, reason: "Messagge already read or email msissing" });
    } catch (error) {
        console.error("Error processing unread notification check: ", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// wrapping the handler with QStash signature verification for safety.
export const POST = verifySignatureAppRouter(handler);