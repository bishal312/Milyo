import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { chatEmitter } from "@/lib/chatEvents";
// import { getValidatedConversation } from "./stream/route";

//GET: Specific conversation / item context
export async function GET(req: Request) {
    try {
        const session = await auth.api.getSession();
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

        // mark incoming unread messages for current user as read
        await db.chatMessage.updateMany({
            where: {
                conversationId,
                receiverId: session.user.id,
                read: false,
            },
            data: { read: true },
        });


        // const result = await getValidatedConversation(conversationId, session.user.id);
        // if ("error" in result) {
        //     return NextResponse.json(
        //         { message: result.error },
        //         { status: result.status },
        //     )
        // };


        const message = await db.chatMessage.findMany({
            where: {
                conversationId
            },
            orderBy: { createdAt: "asc" },
            include: {
                sender: {
                    select: { id: true, name: true, image: true },
                },
            },
        });

        return NextResponse.json({ message }, { status: 200 });
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
        const session = await auth.api.getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { receiverId, itemId, content, conversationId } = body;

        if (!content || content.trim() === "") {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

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
                // creating new conversation
                const newConversation = await db.conversation.create({
                    data: {
                        user1Id: session.user.id,
                        user2Id: receiverId,
                        itemId: itemId || null,
                    },
                });
                targetConversationId = newConversation.id;
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
        let actualReceiverId = conv.user1Id === session.user.id ? conv.user2Id : conv.user1Id;;

        //create the chatmessage
        const newMessage = await db.chatMessage.create({
            data: {
                conversationId: targetConversationId,
                itemId: itemId || null,
                senderId: session.user.id,
                receiverId: actualReceiverId,
                content,
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

        chatEmitter.emit("message", {
            conversationId: targetConversationId,
            message: newMessage,
        });

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