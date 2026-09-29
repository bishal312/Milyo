import { NextRequest } from "next/server";
import { chatEmitter } from "@/lib/chatEvents";

export const runtime = "nodejs";

export async function GET(req:NextRequest) {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
        return new Response("Missing conversationId", { status: 400});
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Listener callback when a new message arrives
            const onMessage = (data: any) => {
                if (data.conversationId === conversationId) {
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