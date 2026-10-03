import { db } from "@/lib/db";
import type { Item } from "@/lib/generated/prisma/client";
import { compareItemImages } from "@/lib/ai-image-match";

type ComparisonItem = Pick<Item, "id" | "title" | "category" | "description" | "photoUrl" | "type">;
type ComparisonStatus = "MATCH" | "NO_MATCH" | "FAILED";

export async function processAIComparison(
    reportId: string,
    lostItem: ComparisonItem,
    foundItem: ComparisonItem,
): Promise<ComparisonStatus> {
    try {
        if (!lostItem.photoUrl || !foundItem.photoUrl) {
            throw new Error("Both items need a photo to compare.");
        }

        const analysis = await compareItemImages({
            firstImageUrl: lostItem.photoUrl,
            secondImageUrl: foundItem.photoUrl,
            itemContext: [
                `Lost report: ${lostItem.title} (${lostItem.category})`,
                lostItem.description,
                `Found report: ${foundItem.title} (${foundItem.category})`,
                foundItem.description,
            ].filter(Boolean).join("\n"),
        });

        const status = analysis.isMatch ? "MATCH" : "NO_MATCH";
        const score = analysis.matchPercentage / 100;

        await db.$transaction(async (tx) => {
            if (analysis.isMatch) {
                const existingMatch = await tx.match.findFirst({
                    where: { lostItemId: lostItem.id, foundItemId: foundItem.id },
                    select: { id: true },
                });

                if (!existingMatch) {
                    await tx.match.create({
                        data: {
                            lostItemId: lostItem.id,
                            foundItemId: foundItem.id,
                            score,
                            status: "PENDING",
                        },
                    });
                }
            }

            await tx.aIComparisonReport.update({
                where: { id: reportId },
                data: {
                    status,
                    score,
                    confidenceLevel: analysis.confidenceLevel,
                    reasoning: analysis.reasoning,
                    keyMatchingFeatures: analysis.keyMatchingFeatures,
                    discrepancies: analysis.discrepancies,
                },
            });
        });

        return status;
    } catch (error) {
        console.error(`AI comparison failed for report ${reportId}:`, error);
        await db.aIComparisonReport.update({
            where: { id: reportId },
            data: {
                status: "FAILED",
                reasoning: "The AI comparison could not be completed. You can retry it later.",
            },
        });
        return "FAILED";
    }
}
