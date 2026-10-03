import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_PHOTO_SIZE_BYTES = 3 * 1024 * 1024;

function isValidPhotoDataUrl(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }

    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) {
        return false;
    }

    const [, imageType, base64Data] = match;
    const image = Buffer.from(base64Data, "base64");
    if (image.byteLength === 0 || image.byteLength > MAX_PHOTO_SIZE_BYTES) {
        return false;
    }

    if (imageType === "jpeg") {
        return image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
    }

    if (imageType === "png") {
        return image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    return (
        image.length >= 12 &&
        image.toString("ascii", 0, 4) === "RIFF" &&
        image.toString("ascii", 8, 12) === "WEBP"
    );
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { title, description, category, type, latitude, longitude, photoUrl } = body;

        if (!title) {
            return NextResponse.json({ message: "Title is required" }, {
                status: 400,
            });
        }

        if (photoUrl !== undefined && photoUrl !== null && !isValidPhotoDataUrl(photoUrl)) {
            return NextResponse.json(
                { message: "Photo must be a valid JPEG, PNG, or WebP image no larger than 3 MB" },
                { status: 400 },
            );
        }

        const newItem = await db.item.create({
            data: {
                title,
                description,
                category,
                type,
                latitude,
                longitude,
                photoUrl: photoUrl ?? null,
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
            select: {
                id: true,
                title: true,
                description: true,
                category: true,
                type: true,
                latitude: true,
                longitude: true,
                createdAt: true,
            },
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