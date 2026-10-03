import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { chatEmitter } from "@/lib/chatEvents";
import { headers } from "next/headers";
// import { getValidatedConversation } from "./stream/route";

//GET: Specific conversation / item context
export async function GET(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const conversationId = searchParams.get("conversationId");

        if (!conversationId) {
            return NextResponse.json(
                { error: "conversationId query parameter is required" },
                { status: 400 }
            );
        };

        // verify user is a participant in this conversation
        const conversation = await db.conversation.findUnique({
            where: { id: conversationId },
            include: {
                user1: {
                    select: { id: true, name: true, image: true },
                },
                user2: {
                    select: { id: true, name: true, image: true },
                },
                item: {
                    select: { id: true, title: true, type: true, status: true },
                },
            },
        })

        if (
            !conversation ||
            (conversation.user1Id !== session.user.id &&
                conversation.user2Id !== session.user.id)
        ) {
            return NextResponse.json(
                { error: "Conversation not found or access denied" },
                { status: 403 }
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
        const relatedConversationIds = relatedConversations.map(({ id }) => id);

        const messages = await db.chatMessage.findMany({
            where: {
                conversationId: { in: relatedConversationIds },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: {
                sender: {
                    select: { id: true, name: true, image: true },
                },
            },
        });

        return NextResponse.json(
            {
                messages,
                item: conversation.item,
                partner:
                    conversation.user1Id === session.user.id
                        ? conversation.user2
                        : conversation.user1,
                currentUserId: session.user.id,
                currentUserName: session.user.name,
            },
            {
                status: 200,
                headers: { "Cache-Control": "no-store, max-age=0" },
            }
        );
    } catch (error) {
        console.error("Error fetching messages: ", error);
        return NextResponse.json(
            { error: "Failed to fetch messages" },
            { status: 500 }
        );
    }
}


// post
export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { receiverId, itemId, content, conversationId } = body;

        // if (!content || content.trim() === "") {
        //     return NextResponse.json(
        //         { error: "Missing required fields" },
        //         { status: 400 }
        //     );
        // }

        let targetConversationId = conversationId;

        //if conversationID isn't passed directly, find or create one
        if (!targetConversationId) {
            if (!receiverId) {
                return NextResponse.json(
                    { error: "receiverId is required when conversationId is omitted" },
                    { status: 400 }
                );
            }

            //check for existing conversation between user1 & user2 for the item
            const existingConversation = await db.conversation.findFirst({
                where: {
                    OR: [
                        { user1Id: session.user.id, user2Id: receiverId, itemId: itemId || null },
                        { user1Id: receiverId, user2Id: session.user.id, itemId: itemId || null },
                    ],
                },
            });

            if (existingConversation) {
                targetConversationId = existingConversation.id;
            } else {
                const [user1Id, user2Id] = [session.user.id, receiverId].sort();
                try {
                    const newConversation = await db.conversation.create({
                        data: {
                            user1Id,
                            user2Id,
                            itemId: itemId || null,
                        },
                    });
                    targetConversationId = newConversation.id;
                } catch (createError) {
                    const concurrentConversation = await db.conversation.findFirst({
                        where: {
                            OR: [
                                { user1Id, user2Id, itemId: itemId || null },
                                { user1Id: user2Id, user2Id: user1Id, itemId: itemId || null },
                            ],
                        },
                    });
                    if (!concurrentConversation) throw createError;
                    targetConversationId = concurrentConversation.id;
                }
            }
        };

        // fetch conversation to determine correct receiverid & verify membership
        const conv = await db.conversation.findUnique({
            where: { id: targetConversationId },
        });

        if (!conv) {
            return NextResponse.json(
                { error: "Conversation not found" },
                { status: 404 }
            );
        }

        // courrent user belongs to conversation
        if (conv.user1Id !== session.user.id && conv.user2Id !== session.user.id) {
            return NextResponse.json(
                { error: "Forbidden: You are not a participant in this conversation" },
                { status: 403 }
            );
        }

        // Determine actual receiverId if conversationId was supplied
        const actualReceiverId = conv.user1Id === session.user.id ? conv.user2Id : conv.user1Id;
        const actualItemId = conv.itemId || itemId;

        if (!actualItemId) {
            return NextResponse.json(
                { error: "This conversation is not associated with an item." },
                { status: 400 }
            );
        }

        let newMessage = null;

        if (content && content.trim() !== "") {
            //create the chatmessage
            newMessage = await db.chatMessage.create({
                data: {
                    content,
                    // Connect the conversation relation
                    conversation: {
                        connect: { id: targetConversationId },
                    },
                    // Connect the sender relation
                    sender: {
                        connect: { id: session.user.id },
                    },
                    receiver: {
                        connect: { id: actualReceiverId },
                    },
                    item: {
                        connect: { id: actualItemId },
                    },
                },
                include: {
                    sender: {
                        select: {
                            id: true, name: true, image: true
                        },
                    },
                },
            });

            await db.conversation.update({
                where: { id: targetConversationId },
                data: { updatedAt: new Date() },
            });

            chatEmitter.setMaxListeners(50);
            chatEmitter.emit("message", {
                conversationId: targetConversationId,
                message: newMessage,
            });
        }


        return NextResponse.json(
            { message: newMessage, conversationId: targetConversationId },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error sending message:", error);
        return NextResponse.json(
            { error: "Failed to send message" },
            { status: 500 }
        );
    }

}