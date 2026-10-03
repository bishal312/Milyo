import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processAIComparison } from "@/lib/process-ai-comparison";

export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const report = await db.aIComparisonReport.findUnique({
            where: { id },
            include: {
                lostItem: true,
                foundItem: true,
            },
        });

        if (!report) {
            return NextResponse.json({ error: "AI comparison report not found" }, { status: 404 });
        }

        // only related opposite party
        if (
            report.lostItem.reportedBy !== session.user.id &&
            report.foundItem.reportedBy !== session.user.id
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }



        // checking ai fail status
        if (report.status !== "FAILED") {
            return NextResponse.json({ error: "Only failed comparisons can be retried" }, { status: 409 });
        }

        const claimed = await db.aIComparisonReport.updateMany({
            where: { id, status: "FAILED" },
            data: {
                status: "PENDING",
                score: null,
                confidenceLevel: null,
                reasoning: null,
                keyMatchingFeatures: [],
                discrepancies: [],
            },
        });


        if (claimed.count === 0) {
            return NextResponse.json({ error: "This comparison is already being retried" }, { status: 409 });
        }

        const status = await processAIComparison(report.id, report.lostItem, report.foundItem);
        const updatedReport = await db.aIComparisonReport.findUniqueOrThrow({
            where: { id },
            select: {
                id: true,
                status: true,
                score: true,
                confidenceLevel: true,
                reasoning: true,
                keyMatchingFeatures: true,
                discrepancies: true,
                createdAt: true,
            },
        });

        return NextResponse.json({
            report: updatedReport,
            message: status === "FAILED" ? "The AI service is still unavailable. You can try again later." : null,
        });
    } catch (error) {
        console.error("Failed to retry AI comparison:", error);
        return NextResponse.json({ error: "Failed to retry AI comparison" }, { status: 500 });
    }
}
