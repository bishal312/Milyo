import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { title, description, category, type, latitude, longitude } = body;

        if (!title) {
            return NextResponse.json({ message: "Title is required" }, {
                status: 400,
            });
        }
        const newItem = await db.item.create({
            data: {
                title,
                description,
                category,
                type,
                latitude,
                longitude,
                reportedBy: session.user.id,
                status: "OPEN",
            }
        });

        return NextResponse.json(newItem, { status: 201 });
    } catch (error) {
        console.error("Error creating item:", error);
        return NextResponse.json({
            message: "Internal server error"
        },
            {
                status: 500
            }
        )
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search");
        const type = searchParams.get("type") || "";
        const category = searchParams.get("category") || "";

        const items = await db.item.findMany({
            where: {
                status: "OPEN",
                ...(type && type !== "ALL" ? { type: type as "LOST" | "FOUND" } : {}),
                ...(category && category !== "ALL" ? { category } : {}),
                ...(search
                    ? {
                        OR: [
                            { title: { contains: search, mode: "insensitive" } },
                            { description: { contains: search, mode: "insensitive" } }
                        ],
                    }
                    : {}
                )
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(items);
    } catch (error) {
        console.error("Error fetcing items: ", error);
        return NextResponse.json(
            { message: "Failed to fetch items" },
            { status: 500 }
        );
    }
}