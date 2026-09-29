"use client";

import axios from "axios";
import { useState } from "react";

interface AIMatchAnalysis {
    matchPercentage: number;
    isMatch: boolean;
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
    keyMatchingFeatures: string[];
    discrepancies: string[];
    reasoning: string;
}

interface ClaimAIMatchProps {
    finderImageUrl: string;
    claimantImageUrl: string;
    itemTitle?: string;
    itemDescription?: string;
}

export default function ClaimAIMatchBadge({
    finderImageUrl,
    claimantImageUrl,
    itemTitle,
    itemDescription,
}: ClaimAIMatchProps) {
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<AIMatchAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function runAiComparison() {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.post("/api/claims/ai-match", {
                finderImageUrl,
                claimantImageUrl,
                itemTitle,
                itemDescription,
            });
            setAnalysis(res.data.analysis);
        } catch (err: any) {
            setError(
                err.response?.data?.error ||
                err.message ||
                "An error occurred while comparing"
            );
        } finally {
            setLoading(false);
        }
    } return (
        <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>🤖</span> AI Photo Verification
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Compare finder photo against claimant proof photo
                    </p>
                </div>

                {!analysis && !loading && (
                    <button
                        onClick={runAiComparison}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
                    >
                        Run AI Match
                    </button>
                )}
            </div>

            {loading && (
                <div className="flex items-center gap-3 py-4 text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing visual features, colors, and unique marks...</span>
                </div>
            )}

            {error && (
                <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg">
                    {error}
                </p>
            )}

            {analysis && (
                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                    {/* Match Score Bar */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span
                                className={`text-xl font-extrabold ${analysis.isMatch ? "text-green-600" : "text-red-500"
                                    }`}
                            >
                                {analysis.matchPercentage}%
                            </span>
                            <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${analysis.isMatch
                                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                    }`}
                            >
                                {analysis.isMatch ? "Match Verified" : "Low Match Likelihood"}
                            </span>
                        </div>
                        <span className="text-xs text-gray-400">Confidence: {analysis.confidenceLevel}</span>
                    </div>

                    {/* Reasoning */}
                    <p className="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                        {analysis.reasoning}
                    </p>

                    {/* Key Matching Traits */}
                    {analysis.keyMatchingFeatures.length > 0 && (
                        <div>
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                Matching Attributes:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {analysis.keyMatchingFeatures.map((trait, index) => (
                                    <span
                                        key={index}
                                        className="text-[10px] bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/50 px-2 py-0.5 rounded-md"
                                    >
                                        ✓ {trait}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Discrepancies */}
                    {analysis.discrepancies.length > 0 && (
                        <div>
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                Discrepancies / Differences:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {analysis.discrepancies.map((disc, index) => (
                                    <span
                                        key={index}
                                        className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded-md"
                                    >
                                        ⚠ {disc}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}