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

        return NextResponse.json(item);
    } catch (error) {
        console.error("Error fetching item details:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 },
        )
    }
}