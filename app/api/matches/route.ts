import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
    const session = await auth.api.getSession(
        { headers: await headers() }
    );

    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const matches = await db.match.findMany({
        where: {
            OR: [
                { lostItem: { reportedBy: session.user.id}},
                { foundItem: { reportedBy: session.user.id}},
            ],
        },
        select: {
            id: true,
            score: true,
            status: true,
            createdAt: true,
            lostItem: {
                select: { id: true, title: true },
            },
            foundItem: {
                select: { id: true, title: true },
            },
        },
        orderBy: { createdAt: "desc"},
    });

    return NextResponse.json(matches);
}