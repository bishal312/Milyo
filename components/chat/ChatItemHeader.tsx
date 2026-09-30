"use client";

import axios from "axios";
import { useState } from "react";

interface ItemHeaderProps {
    item?: {
        id: string;
        title: string;
        status: string;
        type: string;
    } | null;
}

export function ChatItemHeader({ item }: ItemHeaderProps) {
    const [status, setStatus] = useState(item?.status || "OPEN");
    const [loading, setLoading] = useState(false);

    if (!item) return null;

    const handleResolve = async () => {
        const confirmed = confirm("Are you sure you want to mark this item as resolved?");
        if (!confirmed) return;

        setLoading(true);
        try {
            const res = await axios.patch(`/api/items/${item.id}/status`, {
                status: "RESOLVED"
            });

            if (res.data) {
                setStatus("RESOLVED");
            } else {
                alert("Failed to update status.");
            }
        } catch (error) {
            console.error("Error updating item status: ", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-transparent dark:bg-gray-800 p-3 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    Item: {item.title}
                </span>
                <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${status === "RESOLVED"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                >
                    {status}
                </span>
            </div>

            {status === "OPEN" && (
                <button
                    onClick={handleResolve}
                    disabled={loading}
                    className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                    {loading ? "Updating..." : "Mark as Resolved"}
                </button>
            )}
        </div>
    );
}