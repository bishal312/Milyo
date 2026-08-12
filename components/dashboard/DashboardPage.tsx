import Link from "next/link";
import {
    Search,
    Plus,
    PackageSearch,
    Sparkles,
    MessageCircle,
    MapPin,
    Clock,
    CheckCircle2,
    ArrowUpRight,
    TrendingUp,
    ShieldCheck,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Item, ItemStatus, Match } from "@/lib/generated/prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogOutButton } from "../auth/LogOutButton";

// types for the merged activity feed
type ActivityEntry = {
    id: string;
    text: string;
    time: Date;
    kind: "reported" | "matched" | "resolved";
};

export async function getAddressFromCoords(lat: number, lng: number) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            {
                headers: {
                    "User-Agent": "Milyo/1.0"
                }
            }
        );
        const data = await res.json();
        return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

export function timeAgo(date: Date) {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) redirect("/sign-in");

    const userId = session.user.id;

    const ACTIVE_STATUS: ItemStatus[] = [
        "OPEN",
        "MATCHED",
        "CLAIMED",
        "RESOLVED",
    ] as const;

    const [
        activeReportsCount,
        pendingMatchesCount,
        myResolvedCount,
        campusResolvedCount,
        pendingMatches,
        recentItems,
        recentMatches,
    ] = await Promise.all([
        // 1. activeReportsCount
        db.item.count({
            where: {
                reportedBy: userId,
                status: {
                    in: ACTIVE_STATUS,
                },
            },
        }),

        // 2. pendingMatchesCount
        db.match.count({
            where: {
                status: "PENDING",
                OR: [
                    { lostItem: { reportedBy: userId } },
                    { foundItem: { reportedBy: userId } },
                ],
            },
        }),

        // 3. myResolvedCount
        db.item.count({
            where: {
                reportedBy: userId,
                status: "RESOLVED",
            },
        }),

        // 4. campusResolvedCount (Campus-wide total resolved)
        db.item.count({
            where: {
                status: "RESOLVED",
            },
        }),

        // 5. pendingMatches
        db.match.findMany({
            where: {
                status: "PENDING",
                OR: [
                    { lostItem: { reportedBy: userId } },
                    { foundItem: { reportedBy: userId } },
                ],
            },
            include: {
                lostItem: true,
                foundItem: true,
            },
            orderBy: {
                score: "desc",
            },
            take: 4,
        }),

        // 6. recentItems
        db.item.findMany({
            where: {
                reportedBy: userId,
            },
            orderBy: { createdAt: "desc" },
            take: 4,
        }),

        // 7. recentMatches
        db.match.findMany({
            where: {
                OR: [
                    { lostItem: { reportedBy: userId } },
                    { foundItem: { reportedBy: userId } },
                ],
            },
            include: {
                lostItem: true,
                foundItem: true,
            },
            orderBy: { createdAt: "desc" },
            take: 4,
        }),
    ]);

    // Generate recent activity entries
    const activities: ActivityEntry[] = [
        ...recentItems.map((item) => ({
            id: `item-${item.id}`,
            text: `Reported ${item.type.toLowerCase()} item: "${item.title}"`,
            time: item.createdAt,
            kind: "reported" as const,
        })),
        ...recentMatches.map((match) => ({
            id: `match-${match.id}`,
            text: `New match found: "${match.lostItem.title}" <-> "${match.foundItem.title}"`,
            time: match.createdAt,
            kind: match.status === "CONFIRMED" ? ("resolved" as const) : ("matched" as const),
        })),
    ]
        .sort((a, b) => b.time.getTime() - a.time.getTime())
        .slice(0, 5);

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground font-serif">
                        Welcome back, {session.user.name || "User"} 👋
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your reported items, inspect potential matches, and keep track of campus activity.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/items/report"
                        className="inline-flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground font-medium px-4 py-2.5 rounded-lg text-sm shadow-sm transition-opacity"
                    >
                        <Plus className="w-4 h-4" />
                        Report Item
                    </Link>

                    <LogOutButton />

                    <Link
                        href="/items"
                        className="inline-flex items-center gap-2 bg-card hover:bg-muted border border-border text-foreground font-medium px-4 py-2.5 rounded-lg text-sm shadow-sm transition-colors"
                    >
                        <Search className="w-4 h-4" />
                        Browse Items
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Reports</p>
                        <p className="text-2xl font-bold text-card-foreground mt-1">{activeReportsCount}</p>
                    </div>
                    <div className="p-3 bg-secondary text-secondary-foreground rounded-lg">
                        <PackageSearch className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Matches</p>
                        <p className="text-2xl font-bold text-card-foreground mt-1">{pendingMatchesCount}</p>
                    </div>
                    <div className="p-3 bg-accent/20 text-accent-foreground rounded-lg">
                        <Sparkles className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">My Recoveries</p>
                        <p className="text-2xl font-bold text-card-foreground mt-1">{myResolvedCount}</p>
                    </div>
                    <div className="p-3 bg-secondary text-secondary-foreground rounded-lg">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Campus Total Resolved</p>
                        <p className="text-2xl font-bold text-card-foreground mt-1">{campusResolvedCount}</p>
                    </div>
                    <div className="p-3 bg-primary/10 text-primary rounded-lg">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Main Grid Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left 2 Columns: Pending Matches & My Reported Items */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Pending Matches Section */}
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-accent-foreground" />
                                <h2 className="text-lg font-semibold text-card-foreground">Potential AI Matches</h2>
                            </div>
                            <Link
                                href="/matches"
                                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                            >
                                View all <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        {pendingMatches.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                                <p className="text-sm">No pending matches found right now.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingMatches.map((match) => {
                                    const isLostOwner = match.lostItem.reportedBy === userId;
                                    const itemToShow = isLostOwner ? match.foundItem : match.lostItem;

                                    return (
                                        <div
                                            key={match.id}
                                            className="p-4 border border-border rounded-lg hover:border-ring transition-colors flex items-center justify-between gap-4"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-accent text-accent-foreground">
                                                        {Math.round((match.score || 0) * 100)}% Match
                                                    </span>
                                                    <h3 className="font-medium text-card-foreground text-sm">{itemToShow.title}</h3>
                                                </div>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {
                                                        itemToShow.latitude && itemToShow.longitude
                                                            ? (getAddressFromCoords(itemToShow.latitude, itemToShow.longitude))
                                                            : "Unknown location"
                                                    }
                                                </p>
                                            </div>

                                            <Link
                                                href={`/matches/${match.id}`}
                                                className="text-xs font-medium bg-primary hover:opacity-90 text-primary-foreground px-3 py-1.5 rounded-md transition-opacity"
                                            >
                                                Inspect Match
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* My Recent Items Section */}
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-card-foreground">My Reported Items</h2>
                            <Link
                                href="/my-items"
                                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                            >
                                View all <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        {recentItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                                <p className="text-sm">You haven't reported any items yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {recentItems.map((item) => (
                                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="font-medium text-card-foreground text-sm">{item.title}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                                <span className="capitalize">{item.type.toLowerCase()}</span> •
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {timeAgo(item.createdAt)}
                                                </span>
                                            </p>
                                        </div>
                                        <span
                                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${item.status === "RESOLVED"
                                                ? "bg-secondary text-secondary-foreground"
                                                : "bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right 1 Column: Activity Feed Sidebar */}
                <div className="space-y-8">
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold text-card-foreground">Recent Activity</h2>
                        </div>

                        {activities.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">No recent activity recorded.</p>
                        ) : (
                            <div className="relative pl-4 space-y-6 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                {activities.map((act) => (
                                    <div key={act.id} className="relative pl-3">
                                        <div className="absolute -left-4.75 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-card" />
                                        <p className="text-xs text-card-foreground font-medium">{act.text}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(act.time)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}