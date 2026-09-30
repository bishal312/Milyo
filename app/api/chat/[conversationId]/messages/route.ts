import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(
    req: Request,
    { params }: { params: { conversationId: string } }
) {
    try {
        const session = await auth.api.getSession({
                    headers: await headers(),
                })
        const currentUser = session?.user;

        if (!currentUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { conversationId } = params;

        // mark all unread messages received by the current user as read
        await db.chatMessage.updateMany({
            where: {
                conversationId,
                receiverId: currentUser.id,
                read: false,
            },
            data: {
                read: true,
            }
        });

        // fetcj cpmversatopm ,essages
        const messages = await db.chatMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
            include: {
                sender: {
                    select: { id: true, name: true, image: true },
                },
            },
        });

        return NextResponse.json(
            { messages }
        );
    } catch (error) {
        console.error("Error fetching messages: ", error);

        return NextResponse.json(
            { error: "Failed to fetch messages" },
            { status: 500 },
        )
    }
}