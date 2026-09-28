import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

//GET: Specific conversation / item context
export async function GET(req: Request) {
    const session = await auth.api.getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const otherUserId = searchParams.get("otherUserId");

    if (!itemId || !otherUserId) {
        return NextResponse.json(
            { error: "Missing required query parameters: itemId, otherUserId" },
            { status: 400 },
        );
    }

    try {
        const message = await db.chatMessage.findMany({
            where: {
                itemId: itemId,
                OR: [
                    { senderId: session.user.id, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: session.user.id },
                ],
            },
            orderBy: { createdAt: "asc" },
            include: {
                sender: {
                    select: { id: true, name: true, image: true },
                },
            },
        });

        return NextResponse.json(message);
    } catch (error) {
        console.error("Error fetching messages: ", error);
        return NextResponse.json(
            { error: "Failed to fetch messages" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    const session = await auth.api.getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { itemId, receiverId, content } = body;

        if (!itemId || !receiverId || !content?.trim()) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }
        const newMessage = await db.chatMessage.create({
            data: {
                content: content.trim(),
                itemId: itemId,
                senderId: session.user.id,
                receiverId: receiverId,
            },
            include: {
                sender: {
                    select: {
                        id: true, name: true, image: true
                    },
                },
            },
        });
    } catch (error) {
        console.error("Error sending message:", error);
        return NextResponse.json(
            { error: "Failed to send message" },
            { status: 500 }
        );
    }

}