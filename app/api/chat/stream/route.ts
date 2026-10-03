import { NextRequest, NextResponse } from "next/server";
import { chatEmitter } from "@/lib/chatEvents";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const runtime = "nodejs";

export async function getValidatedConversation(conversationId: string, userId: string) {
    const conversation = await db.conversation.findUnique({
        where: {
            id: conversationId,
        },
        include: {
            item: true,
        },
    });

    if (!conversation) return { error: "Conversation not found", status: 404 };

    const isItemOwner = conversation.item?.reportedBy === userId;
    const isInitiator =
        conversation.user1Id === userId ||
        conversation.user2Id === userId;

    if (!isItemOwner && !isInitiator) {
        return { error: "Forbidden: You are not a participant", status: 403 };
    }

    return { conversation };
}

export async function GET(req: NextRequest) {
    const session = await auth.api.getSession({
                headers: await headers(),
            });
    if (!session?.user) {
        return new Response(JSON.stringify({ message: "Unauthorized user" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
        return new Response("Missing conversationId", { status: 400 });
    }

    const result = await getValidatedConversation(conversationId, session.user.id);
    if ("error" in result) {
        return NextResponse.json(
            { message: result.error },
            { status: result.status },
        )
    };

    // readablestream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Listener callback when a new message arrives
            const onMessage = (data: unknown) => {
                if (
                    typeof data === "object" &&
                    data !== null &&
                    "conversationId" in data &&
                    data.conversationId === conversationId &&
                    "message" in data
                ) {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(data.message)}\n\n`)
                    );
                }
            }

            // subscribe to chat events
            chatEmitter.on("message", onMessage);

            // Send initial req or heartbeat to keep connection alive
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));

            // clean up listener when client disconnects
            req.signal.addEventListener("abort", () => {
                chatEmitter.off("message", onMessage);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "Keep-alive",
        },
    });
}