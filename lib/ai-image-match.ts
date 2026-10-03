import { GoogleGenAI, Schema, Type } from "@google/genai";

export interface AIImageMatchAnalysis {
    matchPercentage: number;
    isMatch: boolean;
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
    keyMatchingFeatures: string[];
    discrepancies: string[];
    reasoning: string;
}

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
            description: "Visual traits present in both photos",
        },
        discrepancies: {
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
        "discrepancies",
        "reasoning",
    ],
};

async function fetchImageAsPart(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        throw new Error("Image must be a JPEG, PNG, or WebP file");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}

export async function compareItemImages({
    firstImageUrl,
    secondImageUrl,
    itemContext,
}: {
    firstImageUrl: string;
    secondImageUrl: string;
    itemContext: string;
}): Promise<AIImageMatchAnalysis> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    const [firstImage, secondImage] = await Promise.all([
        fetchImageAsPart(firstImageUrl),
        fetchImageAsPart(secondImageUrl),
    ]);

    const prompt = `
You are an expert loss-and-found item image auditor. Compare the two images and decide whether they show the exact same physical item.

Item context:
${itemContext}

Carefully compare brand/logo placement, color, shape, texture, wear, scratches, stickers, accessories, and proportions. Account for lighting, camera angles, backgrounds, and image quality. Set isMatch to true only when the visual evidence strongly supports the exact same item, not merely the same model or type. Return a realistic score from 0 to 100, confidence level, matching features, discrepancies, and concise reasoning.
`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [prompt, firstImage, secondImage],
        config: {
            responseMimeType: "application/json",
            responseSchema: matchResponseSchema,
            temperature: 0.2,
        },
    });

    if (!response.text) {
        throw new Error("AI returned an empty response");
    }

    const analysis: unknown = JSON.parse(response.text);
    if (
        typeof analysis !== "object" ||
        analysis === null ||
        !("matchPercentage" in analysis) ||
        typeof analysis.matchPercentage !== "number" ||
        !Number.isFinite(analysis.matchPercentage) ||
        analysis.matchPercentage < 0 ||
        analysis.matchPercentage > 100 ||
        !("isMatch" in analysis) ||
        typeof analysis.isMatch !== "boolean" ||
        !("confidenceLevel" in analysis) ||
        !["HIGH", "MEDIUM", "LOW"].includes(String(analysis.confidenceLevel)) ||
        !("keyMatchingFeatures" in analysis) ||
        !Array.isArray(analysis.keyMatchingFeatures) ||
        !analysis.keyMatchingFeatures.every((feature) => typeof feature === "string") ||
        !("discrepancies" in analysis) ||
        !Array.isArray(analysis.discrepancies) ||
        !analysis.discrepancies.every((detail) => typeof detail === "string") ||
        !("reasoning" in analysis) ||
        typeof analysis.reasoning !== "string"
    ) {
        throw new Error("AI returned an invalid image comparison result");
    }

    return analysis as AIImageMatchAnalysis;
}
