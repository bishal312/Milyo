import { NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { auth } from "@/lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

//Structured json schema for the ai output
const matchResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        matchPercentage: {
            type: Type.NUMBER,
            description: "Match confidence score from 0 to 100",
        },
        isMatch: {
            type: Type.BOOLEAN,
            description: "True if the item in both photos is highly likely the exact same item",
        },
        confidenceLevel: {
            type: Type.STRING,
            enum: ["HIGH", "MEDIUM", "LOW"],
            description: "Overall confidence level of the comparison",
        },
        keyMatchingFeatures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Visual traits present in both photos (e.g. 'matching gold zipper', 'same blue leather pattern')",
        },
        descrepancies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Differences or conflicting details between the two photos",
        },
        reasoning: {
            type: Type.STRING,
            description: "Concise summary explaining why the items do or do not match",
        },
    },

    required: [
        "matchPercentage",
        "isMatch",
        "confidenceLevel",
        "keyMatchingFeatures",
        "descrepancies",
        "reasoning",
    ],
};

async function fetchImageAsPart(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get("content-type") || "image/jpeg";

    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession();
        const currentUser = await session?.user;
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

        // converting both remote image urls to inline base64 parts
        const [finderPart, claimantPart] = await Promise.all([
            fetchImageAsPart(finderImageUrl),
            fetchImageAsPart(claimantImageUrl),
        ]);

        const prompt = `
You are an expert AI loss-and-found claim auditor. Your job is to analyze two images to verify if a lost/found item claim is authentic.

Item context:
- Title: ${itemTitle || "N/A"}
- Description: ${itemDescription || "N/A"}

Instructions:
1. Image 1 is uploaded by the person who may found the item or lost the lost vice versa.
2. Image 2 is uploaded by the person who may found the item or lost or can claiming ownership of the item.
3. Carefully compare visual features: brand/logo placement, color/hue, shape, surface textures, wear & tear marks, scratches, stickers, accessories, and overall proportions.
4. Account for differences in lighting, camera angles, backgrounds, and image quality.
5. Provide a realistic match percentage (0-100), boolean verdict (isMatch), confidence level, list of matching features, discrepancies, and clear reasoning.
    `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [prompt, finderPart, claimantPart],
            config: {
                responseMimeType: "application/json",
                responseSchema: matchResponseSchema,
                temperature: 0.2, // low temp for consistent factual visual audit
            },
        });

        const resultText = response.text;
        if (!resultText) {
            throw new Error("AI returned an empty response");
        }

        const matchAnalysis = JSON.parse(resultText);

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