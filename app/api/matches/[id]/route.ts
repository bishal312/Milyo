import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const { status } = await req.json();
        if (status !== "CONFIRMED" && status !== "REJECTED") {
            return NextResponse.json({ error: "Invalid match status" }, { status: 400 });
        }

        const match = await db.match.findUnique({
            where: { id },
            include: {
                lostItem: { select: { id: true, reportedBy: true } },
                foundItem: { select: { id: true, reportedBy: true } },
            },
        });
        if (!match) {
            return NextResponse.json({ error: "Match not found" }, { status: 404 });
        }

        if (
            match.lostItem.reportedBy !== session.user.id &&
            match.foundItem.reportedBy !== session.user.id
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const updatedMatch = await db.$transaction(async (tx) => {
            const updated = await tx.match.update({
                where: { id },
                data: { status },
            });

            if (status === "CONFIRMED") {
                await tx.item.updateMany({
                    where: { id: { in: [match.lostItem.id, match.foundItem.id] } },
                    data: { status: "MATCHED" },
                });
            }

            return updated;
        });

        return NextResponse.json(updatedMatch);
    } catch (error) {
        console.error("Failed to update match status:", error);
        return NextResponse.json({ error: "Failed to update match status" }, { status: 500 });
    }
}