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
} from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Item, ItemStatus, Match } from "@/lib/generated/prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// types for the merged activity feed

type ActivityEntry = {
    id: string;
    text: string;
    time: Date;
    kind: "reported" | "matched" | "resolved"
};

function timeAgo(date: Date) {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""}`;
}

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) redirect("/login");

    const userId = session.user.id;

    const ACTIVE_STATUS: ItemStatus[] = ["OPEN", "MATCHED", "CLAIMED", "RESOLVED"] as const;

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
                    in: ACTIVE_STATUS
                }
            }
        }),

        // 2. pendingMatchesCount
        db.match.count({
            where: {
                status: "PENDING",
                OR: [
                    {
                        lostItem: { reportedBy: userId }
                    },
                    {
                        foundItem: { reportedBy: userId },
                    }
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

        // 4. campusResolvedCount
        db.match.findMany({
            where: {
                status: "PENDING",
                OR: [{
                    lostItem: {
                        reportedBy: userId
                    },
                },
                {
                    foundItem: {
                        reportedBy: userId
                    },
                }],
            },
            include: {
                lostItem: true,
                foundItem: true
            },
            orderBy: {
                score: "desc"
            },
            take: 4,
        }),

        // 5. pendingMatches
        db.item.findMany({
            where: {
                reportedBy: userId
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 4,
        }),

        // 6. recentItems
        db.item.findMany({
            where: {
                reportedBy: userId
            },
            orderBy: { createdAt: "desc" },
            take: 4,
        }),

        // 7. recentMatches
        db.match.findMany({
            where: {
                OR: [{
                    lostItem: {
                        reportedBy: userId
                    }
                }, {
                    foundItem: {
                        reportedBy: userId
                    },
                }]
            },
            include: {
                lostItem: true,
                foundItem: true,
            },
            orderBy: { createdAt: "desc" },
            take: 4,
        }),
    ]);




}