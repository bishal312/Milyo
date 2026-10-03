import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;

        const item = await db.item.findUnique({
            where: { id },
            include: {
                reporter: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
        });

        if (!item) {
            return NextResponse.json(
                { message: "Item not found" },
                { status: 404 },
            );
        }

        const existingConversations = item.reportedBy === session.user.id
            ? await db.conversation.findMany({
                where: {
                    itemId: item.id,
                    OR: [
                        { user1Id: session.user.id },
                        { user2Id: session.user.id },
                    ],
                },
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    user1Id: true,
                    user2Id: true,
                    user1: { select: { id: true, name: true } },
                    user2: { select: { id: true, name: true } },
                },
            })
            : [];

        return NextResponse.json({
            ...item,
            isOwnItem: item.reportedBy === session.user.id,
            existingConversations: existingConversations.map((conversation) => ({
                id: conversation.id,
                partner:
                    conversation.user1Id === session.user.id
                        ? conversation.user2
                        : conversation.user1,
            })),
        });
    } catch (error) {
        console.error("Error fetching item details:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 },
        )
    }
}