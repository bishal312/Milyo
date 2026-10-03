import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { compareItemImages } from "@/lib/ai-image-match";

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({
                    headers: await headers(),
                });
        const currentUser = session?.user;
        if (!currentUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { finderImageUrl, claimantImageUrl, itemTitle, itemDescription } = await req.json();
        if (!finderImageUrl || !claimantImageUrl) {
            return NextResponse.json(
                { error: "Both finderImageUrl and claimantImageUrl are required" },
                { status: 400 }
            );
        }

        const matchAnalysis = await compareItemImages({
            firstImageUrl: finderImageUrl,
            secondImageUrl: claimantImageUrl,
            itemContext: `Title: ${itemTitle || "N/A"}\nDescription: ${itemDescription || "N/A"}`,
        });

        return NextResponse.json({
            success: true,
            analysis: matchAnalysis,
        });

    } catch (error) {
        console.error("AI Image Comaparison Error: ", error);
        return NextResponse.json(
            { error: "Failed to perform AI image comparison" },
            { status: 500 }
        );
    }
}