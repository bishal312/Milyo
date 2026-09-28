import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const session = await auth.api.getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const currentUserId = session.user.id;

        // Fetch all conversations where user is user1 or user2
        const conversations = await db.conversation.findMany({
            where: {
                OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
            },
            orderBy: { updatedAt: "desc" },
            include: {
                user1: { select: { id: true, name: true, image: true } },
                user2: { select: { id: true, name: true, image: true } },
                item: { select: { id: true, title: true, photoUrl: true, type: true, status: true } },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1, // Get the latest message for preview
                },
            },
        });

        // Format response to present partner user and unread status cleanly
        const formattedConversations = conversations.map((conv) => {
            const partner = conv.user1Id === currentUserId ? conv.user2 : conv.user1;
            const lastMessage = conv.messages[0] || null;
            const isUnread = lastMessage ? !lastMessage.read && lastMessage.receiverId === currentUserId : false;

            return {
                id: conv.id,
                partner,
                item: conv.item,
                lastMessage,
                isUnread,
                updatedAt: conv.updatedAt,
            };
        });

        return NextResponse.json({ conversations: formattedConversations }, { status: 200 });
    } catch (error) {
        console.error("GET /api/chat/conversations error:", error);
        return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }
}