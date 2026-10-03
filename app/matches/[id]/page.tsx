import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, Clock3, ImageOff, Sparkles, XCircle } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function stringList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function itemStatusClass(status: string) {
    if (status === "CONFIRMED" || status === "MATCH") {
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    }
    if (status === "REJECTED" || status === "NO_MATCH" || status === "FAILED") {
        return "bg-destructive/10 text-destructive";
    }
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function ComparisonItemCard({
    type,
    item,
}: {
    type: "LOST" | "FOUND";
    item: {
        id: string;
        title: string;
        category: string;
        description: string;
        status: string;
        photoUrl: string | null;
        createdAt: Date;
    };
}) {
    return (
        <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="relative flex h-64 items-center justify-center bg-muted">
                {item.photoUrl ? (
                    <Image
                        src={item.photoUrl}
                        alt={`Photo of ${item.title}`}
                        width={900}
                        height={700}
                        unoptimized
                        className="h-full w-full object-contain"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                        <ImageOff className="h-8 w-8" />
                        No photo available
                    </div>
                )}
                <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${
                    type === "LOST"
                        ? "bg-red-500/10 text-red-700 dark:text-red-300"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                }`}>
                    {type} ITEM
                </span>
            </div>
            <div className="space-y-3 p-5">
                <div>
                    <p className="text-xs text-muted-foreground">{item.category} · Reported {format(item.createdAt, "PPP")}</p>
                    <h2 className="mt-1 text-xl font-semibold">
                        <Link href={`/items/${item.id}`} className="hover:text-primary hover:underline">
                            {item.title}
                        </Link>
                    </h2>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${itemStatusClass(item.status)}`}>
                        Item status: {item.status}
                    </span>
                    <Link href={`/items/${item.id}`} className="text-sm font-medium text-primary hover:underline">
                        View item report
                    </Link>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {item.description || "No description provided."}
                </p>
            </div>
        </article>
    );
}

export default async function MatchDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/sign-in");
    }

    const { id } = await params;
    const match = await db.match.findUnique({
        where: { id },
        select: {
            id: true,
            score: true,
            status: true,
            createdAt: true,
            lostItem: {
                select: {
                    id: true,
                    title: true,
                    category: true,
                    description: true,
                    status: true,
                    photoUrl: true,
                    createdAt: true,
                    reportedBy: true,
                },
            },
            foundItem: {
                select: {
                    id: true,
                    title: true,
                    category: true,
                    description: true,
                    status: true,
                    photoUrl: true,
                    createdAt: true,
                    reportedBy: true,
                },
            },
        },
    });

    if (!match) {
        notFound();
    }

    if (
        match.lostItem.reportedBy !== session.user.id &&
        match.foundItem.reportedBy !== session.user.id
    ) {
        notFound();
    }

    const comparison = await db.aIComparisonReport.findUnique({
        where: {
            lostItemId_foundItemId: {
                lostItemId: match.lostItem.id,
                foundItemId: match.foundItem.id,
            },
        },
        select: {
            status: true,
            score: true,
            confidenceLevel: true,
            reasoning: true,
            keyMatchingFeatures: true,
            discrepancies: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    const matchingFeatures = stringList(comparison?.keyMatchingFeatures);
    const discrepancies = stringList(comparison?.discrepancies);
    const score = comparison?.score ?? match.score;

    return (
        <main className="mx-auto min-h-screen max-w-6xl space-y-8 bg-background p-6 text-foreground md:p-10">
            <header className="space-y-4 border-b border-border pb-6">
                <Link href="/matches" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Back to matches
                </Link>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="font-serif text-3xl font-bold tracking-tight">AI Match Details</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Full visual comparison report for this lost and found item pair.
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${itemStatusClass(match.status)}`}>
                        Match status: {match.status}
                    </span>
                </div>
            </header>

            <section className="grid gap-5 md:grid-cols-2" aria-label="Compared items">
                <ComparisonItemCard type="LOST" item={match.lostItem} />
                <ComparisonItemCard type="FOUND" item={match.foundItem} />
            </section>

            <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">AI Comparison Report</h2>
                            <p className="text-xs text-muted-foreground">
                                Compared {format(comparison?.updatedAt ?? match.createdAt, "PPP 'at' p")}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {comparison?.confidenceLevel && (
                            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
                                {comparison.confidenceLevel} confidence
                            </span>
                        )}
                        {comparison && (
                            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${itemStatusClass(comparison.status)}`}>
                                {comparison.status === "NO_MATCH" ? "NO MATCH" : comparison.status}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 p-4">
                    <div>
                        <p className="text-xs text-muted-foreground">Visual similarity</p>
                        <p className="text-3xl font-bold text-primary">{Math.round(score * 100)}%</p>
                    </div>
                    <div className="h-10 w-px bg-border" />
                    <div>
                        <p className="text-xs text-muted-foreground">Match review</p>
                        <p className="font-semibold">{match.status === "PENDING" ? "Awaiting review" : match.status}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        Match created {format(match.createdAt, "PPP")}
                    </div>
                </div>

                {comparison?.reasoning ? (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold">AI reasoning</h3>
                        <p className="rounded-lg border border-border p-4 text-sm leading-relaxed text-muted-foreground">
                            {comparison.reasoning}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No detailed AI reasoning was saved for this match.
                    </p>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" /> Shared visual features
                        </h3>
                        {matchingFeatures.length > 0 ? (
                            <ul className="space-y-2">
                                {matchingFeatures.map((feature, index) => (
                                    <li key={`${feature}-${index}`} className="rounded-lg bg-emerald-500/5 px-3 py-2 text-sm">
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">No shared features were recorded.</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                            <XCircle className="h-4 w-4" /> Differences noted
                        </h3>
                        {discrepancies.length > 0 ? (
                            <ul className="space-y-2">
                                {discrepancies.map((difference, index) => (
                                    <li key={`${difference}-${index}`} className="rounded-lg bg-amber-500/5 px-3 py-2 text-sm">
                                        {difference}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">No differences were recorded.</p>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
