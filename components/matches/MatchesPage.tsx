"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, X } from 'lucide-react';
import axios from 'axios';

interface MatchListItem {
    id: string;
    score: number;
    status: "PENDING" | "CONFIRMED" | "REJECTED";
    lostItem: { id: string; title: string };
    foundItem: { id: string; title: string };
}

export default function MatchesPage() {
    const [matches, setMatches] = useState<MatchListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMatch = async () => {
            try {
                const response = await axios.get<MatchListItem[]>("/api/matches");
                setMatches(response.data);
            } catch (error) {
                console.error("Failed to load matches:", error);
                setError("Failed to load matches. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchMatch();
    }, []);

    const handleUpdateStatus = async (id: string, status: "CONFIRMED" | "REJECTED") => {
        setError(null);
        try {
            await axios.patch(`/api/matches/${id}`, { status });
            setMatches((prev) =>
                prev.map((match) => (match.id === id ? { ...match, status } : match))
            );
        } catch (error) {
            console.error("Failed to update match status:", error);
            setError("Could not update this match. Please try again.");
        }
    };

    if (loading) return <div className='p-6'>Loading</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Potential AI Matches</h1>

            {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

            {matches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-xl">
                    No matches found yet.
                </div>
            ) : (
                <div className="space-y-4">
                    {matches.map((match) => (
                        <div
                            key={match.id}
                            className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm"
                        >
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="text-xs text-red-500 font-semibold">LOST</span>
                                    <p className="font-medium">{match.lostItem.title}</p>
                                </div>

                                <span className="text-muted-foreground font-bold">↔</span>

                                <div>
                                    <span className="text-xs text-green-500 font-semibold">FOUND</span>
                                    <p className="font-medium">{match.foundItem.title}</p>
                                </div>

                                <div className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                                    {Math.round(match.score * 100)}% Match
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {match.status === 'PENDING' ? (
                                    <>
                                        <button
                                            onClick={() => handleUpdateStatus(match.id, 'CONFIRMED')}
                                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(match.id, 'REJECTED')}
                                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-xs font-semibold capitalize px-2 py-1 bg-muted rounded">
                                        {match.status.toLowerCase()}
                                    </span>
                                )}

                                <Link
                                    href={`/matches/${match.id}`}
                                    className="p-2 border rounded-lg hover:bg-accent"
                                >
                                    <ArrowUpRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}