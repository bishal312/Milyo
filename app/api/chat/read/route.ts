import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body: unknown = await req.json();
        if (
            typeof body !== "object" ||
            body === null ||
            !("conversationId" in body) ||
            typeof body.conversationId !== "string"
        ) {
            return NextResponse.json(
                { error: "conversationId is required" },
                { status: 400 },
            );
        }

        const conversation = await db.conversation.findUnique({
            where: { id: body.conversationId },
            select: { id: true, user1Id: true, user2Id: true, itemId: true },
        });
        if (
            !conversation ||
            (conversation.user1Id !== session.user.id &&
                conversation.user2Id !== session.user.id)
        ) {
            return NextResponse.json(
                { error: "Conversation not found or access denied" },
                { status: 403 },
            );
        }

        const relatedConversations = await db.conversation.findMany({
            where: {
                itemId: conversation.itemId,
                OR: [
                    {
                        user1Id: conversation.user1Id,
                        user2Id: conversation.user2Id,
                    },
                    {
                        user1Id: conversation.user2Id,
                        user2Id: conversation.user1Id,
                    },
                ],
            },
            select: { id: true },
        });

        const result = await db.chatMessage.updateMany({
            where: {
                conversationId: {
                    in: relatedConversations.map(({ id }) => id),
                },
                receiverId: session.user.id,
                read: false,
            },
            data: { read: true },
        });

        return NextResponse.json({ markedRead: result.count });
    } catch (error) {
        console.error("POST /api/chat/read error:", error);
        return NextResponse.json(
            { error: "Failed to mark messages as read" },
            { status: 500 },
        );
    }
}
