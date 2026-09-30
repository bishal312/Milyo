import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import axios from "axios";
import { Client } from "@upstash/qstash"

export async function POST(req: Request) {
    const qstash = new Client({ token: process.env.QSTASH_TOKEN! });
    const { conversationId, itemId, receiverId, content, senderId } = await req.json();

    const newSendMessage = await db.chatMessage.create({
        data: {
            conversationId,
            itemId,
            senderId,
            receiverId,
            content,
            read: false,
        },
    });

    // schedule offline check
    // setTimeout(async () => {
    //     try {
    //         await axios.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/check-unread`, {
    //             messageId: newSendMessage.id,
    //         });
    //     } catch (err) {
    //         console.error("Failed to check delayed unread status: ", err);
    //     }
    // }

    //     , 5 * 60 * 1000
    // );

    // upstash qstash scheduler
    try {
        await qstash.publishJSON({
            url: `${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/check-unread`,
            body: { messageId: newSendMessage.id },
            delay: 300, // delay in seconds
        });
    } catch (qstashError) {
        console.error("Failed to schedule QStash background job: ", qstashError);
    }


    return NextResponse.json({ success: true, message: newSendMessage });
}