"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import axios from "axios";

function timeAgo(date: Date) {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

interface AIComparisonReportItem {
    id: string;
    title: string;
}

interface AIComparisonReport {
    id: string;
    status: "PENDING" | "MATCH" | "NO_MATCH" | "FAILED";
    score: number | null;
    confidenceLevel: string | null;
    reasoning: string | null;
    keyMatchingFeatures: unknown;
    discrepancies: unknown;
    createdAt: Date;
    lostItem: AIComparisonReportItem;
    foundItem: AIComparisonReportItem;
}

interface RetryResponse {
    report: Pick<AIComparisonReport, "id" | "status" | "score" | "confidenceLevel" | "reasoning" | "keyMatchingFeatures" | "discrepancies" | "createdAt">;
    message: string | null;
}

export default function AIComparisonReports({
    initialReports,
}: {
    initialReports: AIComparisonReport[];
}) {
    const [reports, setReports] = useState(initialReports);
    const [retryingId, setRetryingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function retryComparison(reportId: string) {
        setRetryingId(reportId);
        setError(null);

        try {
            const response = await axios.post<RetryResponse>(`/api/ai-comparison-reports/${reportId}/retry`);
            setReports((current) =>
                current.map((report) =>
                    report.id === reportId ? { ...report, ...response.data.report } : report,
                ),
            );
            setError(response.data.message);
        } catch (retryError) {
            console.error("Failed to retry AI comparison:", retryError);
            setError("Could not retry the AI comparison. Please try again later.");
        } finally {
            setRetryingId(null);
        }
    }

    return (
        <section className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
                <div>
                    <h2 className="text-lg font-semibold text-card-foreground">AI Comparison Reports</h2>
                    <p className="text-xs text-muted-foreground">Recent photo comparisons involving your reports</p>
                </div>
            </div>

            {error && (
                <p role="status" className="mb-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                    {error}
                </p>
            )}

            {reports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <p className="text-sm">No AI photo comparisons yet.</p>
                    <p className="text-xs mt-1">Comparisons appear here when a new lost or found report with a photo is submitted.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map((report) => (
                        <div key={report.id} className="p-4 border border-border rounded-lg space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <Link href={`/items/${report.lostItem.id}`} className="font-medium hover:text-primary hover:underline">
                                        {report.lostItem.title}
                                    </Link>
                                    <span className="text-muted-foreground">↔</span>
                                    <Link href={`/items/${report.foundItem.id}`} className="font-medium hover:text-primary hover:underline">
                                        {report.foundItem.title}
                                    </Link>
                                </div>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                    report.status === "MATCH"
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                        : report.status === "NO_MATCH"
                                            ? "bg-muted text-muted-foreground"
                                            : report.status === "FAILED"
                                                ? "bg-destructive/10 text-destructive"
                                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                }`}>
                                    {report.status === "NO_MATCH" ? "NO MATCH" : report.status}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {report.score !== null && <span>{Math.round(report.score * 100)}% similarity</span>}
                                {report.confidenceLevel && <span>{report.confidenceLevel.toLowerCase()} confidence</span>}
                                <span>{timeAgo(new Date(report.createdAt))}</span>
                            </div>
                            {report.reasoning && (
                                <p className="text-sm text-muted-foreground">{report.reasoning}</p>
                            )}
                            {Array.isArray(report.keyMatchingFeatures) && report.keyMatchingFeatures.length > 0 && (
                                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                    Shared features: {report.keyMatchingFeatures.filter((feature): feature is string => typeof feature === "string").join(", ")}
                                </p>
                            )}
                            {Array.isArray(report.discrepancies) && report.discrepancies.length > 0 && (
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    Differences: {report.discrepancies.filter((detail): detail is string => typeof detail === "string").join(", ")}
                                </p>
                            )}
                            {report.status === "FAILED" && (
                                <button
                                    type="button"
                                    onClick={() => retryComparison(report.id)}
                                    disabled={retryingId !== null}
                                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                                >
                                    {retryingId === report.id ? "Retrying comparison..." : "Retry comparison"}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
