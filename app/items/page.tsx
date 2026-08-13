// app/items/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { formatDistanceToNow } from "date-fns";
import {
    Search,
    PlusCircle,
    LayoutGrid,
    Map as MapIcon,
    Tag,
    MapPin,
    Loader2,
    PackageSearch,
} from "lucide-react";
import axios from "axios";

const ItemsFeedMap = dynamic(() => import("@/components/items/ItemsFeedMap"), {
    ssr: false,
    loading: () => (
        <div className="h-150 w-full bg-muted animate-pulse rounded-xl flex items-center justify-center text-sm text-muted-foreground">
            Loading map items...
        </div>
    ),
});

interface Item {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    type: "LOST" | "FOUND";
    latitude?: number | null;
    longitude?: number | null;
    createdAt: string;
}

export default function ItemsFeedPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

    // Search and Filters State
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");

    const fetchItems = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append("search", search);
            if (typeFilter !== "ALL") params.append("type", typeFilter);
            if (categoryFilter !== "ALL") params.append("category", categoryFilter);

            const res = await axios.get(`/api/items?${params.toString()}`);
            if (res.data) {
                setItems(res.data);
            }
        } catch (err) {
            console.error("Failed to load items:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchItems();
        }, 300);

        return () => clearTimeout(timer);
    }, [search, typeFilter, categoryFilter]);

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-7xl mx-auto space-y-8">
            {/* Header & Primary CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-serif">Lost & Found Items</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Browse active reports or submit a new item to reconnect with its owner.
                    </p>
                </div>
                <Link
                    href="/items/report"
                    className="inline-flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground font-medium px-5 py-2.5 rounded-lg text-sm shadow-sm transition-opacity shrink-0"
                >
                    <PlusCircle className="w-4 h-4" />
                    Report Item
                </Link>
            </div>

            {/* Filter Bar & View Toggle */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search items by keyword..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                {/* Type & Category Selectors */}
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="ALL">All Types</option>
                        <option value="LOST">Lost</option>
                        <option value="FOUND">Found</option>
                    </select>

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="ALL">All Categories</option>
                        <option value="ELECTRONICS">Electronics</option>
                        <option value="CLOTHING">Clothing & Accessories</option>
                        <option value="DOCUMENTS">IDs & Documents</option>
                        <option value="KEYS">Keys</option>
                        <option value="BAGS">Bags & Backpacks</option>
                        <option value="OTHER">Other</option>
                    </select>

                    {/* Grid / Map Switcher */}
                    <div className="flex items-center border border-border rounded-lg bg-background p-1">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                                viewMode === "grid"
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("map")}
                            className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                                viewMode === "map"
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Map View"
                        >
                            <MapIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Fetching reported items...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl text-center p-6 space-y-3">
                    <PackageSearch className="w-12 h-12 text-muted-foreground/50" />
                    <h3 className="font-semibold text-lg">No Items Found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        No reports match your current search or filters. Try resetting filters or report a new item.
                    </p>
                </div>
            ) : viewMode === "map" ? (
                <ItemsFeedMap items={items} />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="group bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                            item.type === "LOST"
                                                ? "bg-red-500/10 text-red-600 border border-red-500/20"
                                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                        }`}
                                    >
                                        {item.type}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(item.createdAt), {
                                            addSuffix: true,
                                        })}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                                        {item.title}
                                    </h3>
                                    {item.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                            {item.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-border/60">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Tag className="w-3.5 h-3.5" />
                                        {item.category}
                                    </span>
                                    {item.latitude && item.longitude && (
                                        <span className="flex items-center gap-1 text-primary">
                                            <MapPin className="w-3.5 h-3.5" />
                                            Has Location
                                        </span>
                                    )}
                                </div>

                                <Link
                                    href={`/items/${item.id}`}
                                    className="block w-full text-center py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-lg transition-colors"
                                >
                                    View Item Details
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}