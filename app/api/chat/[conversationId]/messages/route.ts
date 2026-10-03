import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ conversationId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })
        const currentUser = session?.user;

        if (!currentUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { conversationId } = await params;
        const conversation = await db.conversation.findUnique({
            where: { id: conversationId },
            include: {
                user1: { select: { id: true, name: true, image: true } },
                user2: { select: { id: true, name: true, image: true } },
                item: true, // Remove or adjust if your schema relation is named differently
            },
        });
        if (
            !conversation ||
            (conversation.user1Id !== currentUser.id &&
                conversation.user2Id !== currentUser.id)
        ) {
            return NextResponse.json(
                { error: "Conversation not found or access denied" },
                { status: 403 },
            );
        }

        const partner =
            conversation.user1Id === currentUser.id
                ? conversation.user2
                : conversation.user1;

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
            {
                messages,
                partner,
                item: conversation.item || null,
                currentUserId: currentUser.id,
                currentUserName: currentUser.name,
            }
        );
    } catch (error) {
        console.error("Error fetching messages: ", error);

        return NextResponse.json(
            { error: "Failed to fetch messages" },
            { status: 500 },
        )
    }
}