"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import {
    ArrowLeft,
    Tag,
    MapPin,
    Calendar,
    User,
    MessageSquare,
    CheckCircle2,
    Loader2,
    AlertCircle,
    ShieldCheck,
} from "lucide-react";
import axios from "axios";

const SingleItemMap = dynamic(() => import("@/components/items/SingleItemMap"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full bg-muted animate-pulse rounded-xl flex items-center justify-center text-xs text-muted-foreground">
            Loading map location...
        </div>
    ),
});

interface ItemDetail {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    type: "LOST" | "FOUND";
    status: string;
    latitude?: number | null;
    longitude?: number | null;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
    };
}

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [item, setItem] = useState<ItemDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchItem = async () => {
            try {
                const res = await axios.get(`/api/items/${id}`);
                if (!res.data) {
                    if (res.status === 404) throw new Error("Item report not found.");
                    throw new Error("Failed to load item details.");
                }
                const data = res.data;
                setItem(data);
            } catch (err: any) {
                setError(err.message || "Something went wrong.");
            } finally {
                setLoading(false);
            }
        };

        fetchItem();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading item details...</p>
                </div>
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="min-h-screen max-w-3xl mx-auto p-6 md:p-10 flex flex-col items-center justify-center text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-destructive" />
                <h2 className="text-xl font-bold">{error || "Item Not Found"}</h2>
                <Link
                    href="/items"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Items Feed
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-5xl mx-auto space-y-8">
            {/* Top Navigation */}
            <div>
                <Link
                    href="/items"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Items
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Item Information */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <span
                                className={`text-xs font-bold px-3 py-1 rounded-full ${item.type === "LOST"
                                        ? "bg-red-500/10 text-red-600 border border-red-500/20"
                                        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                    }`}
                            >
                                {item.type} ITEM
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {format(new Date(item.createdAt), "PPP")}
                            </span>
                        </div>

                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-serif text-foreground">
                            {item.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/60">
                            <span className="flex items-center gap-1">
                                <Tag className="w-4 h-4 text-primary" />
                                <strong className="text-foreground">Category:</strong> {item.category}
                            </span>
                            <span className="flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <strong className="text-foreground">Status:</strong> {item.status}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-3">
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                            Description & Details
                        </h3>
                        <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                            {item.description || "No description provided for this item."}
                        </p>
                    </div>

                    {/* Map Location */}
                    {item.latitude && item.longitude && (
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-primary" /> Reported Location
                            </h3>
                            <div className="h-72 w-full rounded-xl overflow-hidden border border-border">
                                <SingleItemMap
                                    latitude={item.latitude}
                                    longitude={item.longitude}
                                    title={item.title}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Coordinates: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                            </p>
                        </div>
                    )}
                </div>

                {/* Sidebar - Reporter Contact Card */}
                <div className="space-y-6">
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
                        <h3 className="font-semibold text-base border-b border-border pb-3">
                            Reported By
                        </h3>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                                {item.user?.name?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-foreground">
                                    {item.user?.name || "Anonymous Reporter"}
                                </h4>
                                <p className="text-xs text-muted-foreground">Community Member</p>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <button
                                onClick={() => alert("Real-time Chat socket module coming up next!")}
                                className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-primary-foreground font-medium py-2.5 rounded-lg text-sm transition-opacity shadow-sm"
                            >
                                <MessageSquare className="w-4 h-4" />
                                Send Message
                            </button>

                            <button
                                onClick={() => alert("Claim request sent to reporter!")}
                                className="w-full inline-flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2.5 rounded-lg text-sm transition-colors"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {item.type === "FOUND" ? "Claim This Item" : "I Found This Item"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}