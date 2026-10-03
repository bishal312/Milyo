import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
    try {
        const session = await auth.api.getSession({
                    headers: await headers(),
                });
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
        const unreadMessages = await db.chatMessage.findMany({
            where: {
                conversationId: { in: conversations.map(({ id }) => id) },
                receiverId: currentUserId,
                read: false,
            },
            select: { conversationId: true },
        });
        const unreadConversationIds = new Set(
            unreadMessages.map(({ conversationId }) => conversationId),
        );

        type ConversationRecord = (typeof conversations)[number];
        const groupedConversations = new Map<
            string,
            {
                conversation: ConversationRecord;
                lastMessage: ConversationRecord["messages"][number] | null;
                updatedAt: Date;
                hasUnread: boolean;
            }
        >();

        for (const conv of conversations) {
            const participantIds = [conv.user1Id, conv.user2Id].sort();
            const key = JSON.stringify([conv.itemId, ...participantIds]);
            const latestMessage = conv.messages[0] || null;
            const existing = groupedConversations.get(key);

            if (!existing) {
                groupedConversations.set(key, {
                    conversation: conv,
                    lastMessage: latestMessage,
                    updatedAt: conv.updatedAt,
                    hasUnread: unreadConversationIds.has(conv.id),
                });
                continue;
            }

            existing.hasUnread ||= unreadConversationIds.has(conv.id);
            if (
                latestMessage &&
                (!existing.lastMessage ||
                    latestMessage.createdAt > existing.lastMessage.createdAt)
            ) {
                existing.lastMessage = latestMessage;
            }
            if (conv.updatedAt > existing.updatedAt) {
                existing.updatedAt = conv.updatedAt;
            }
        }

        // Treat reversed/duplicate participant rows as the same item conversation.
        const formattedConversations = Array.from(groupedConversations.values()).map(
            ({ conversation: conv, lastMessage, updatedAt, hasUnread }) => {
                const partner = conv.user1Id === currentUserId ? conv.user2 : conv.user1;

                return {
                    id: conv.id,
                    partner,
                    item: conv.item,
                    lastMessage,
                    isUnread: hasUnread,
                    updatedAt,
                };
            },
        );

        return NextResponse.json(
            { conversations: formattedConversations },
            {
                status: 200,
                headers: { "Cache-Control": "no-store, max-age=0" },
            },
        );
    } catch (error) {
        console.error("GET /api/chat/conversations error:", error);
        return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }
}