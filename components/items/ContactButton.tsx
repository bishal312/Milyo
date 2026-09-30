"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

interface ItemDetailProps {
    item: {
        id: string;
        title: string;
        reportedBy: string;
        type: "LOST" | "FOUND";
        status: string;
    };
    currentUserId?: string;
}

export function ContactButton({ item, currentUserId }: ItemDetailProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    if (currentUserId === item.reportedBy) {
        return null;
    }

    const handleStartChat = async () => {
        setLoading(true);
        try {
            const response = await axios.post("/api/chat", {
                receiverId: item.reportedBy,
                itemId: item.id,
                content: `Hi, I am reaching out regarding your ${item.type.toLocaleLowerCase()} item: "${item.title}".`,
            });

            if (!response.data) {
                throw new Error("Failed to create a find conversation");
            }

            const data = response.data;
            router.push(`/chat/${data.conversationId}`);
        } catch (error) {
            console.error("Error initiating chat: ", error);
            alert("Unable to start conversation. Please try again.");
        } finally {
            setLoading(false);
        }
    }
    return (
        <button
            onClick={handleStartChat}
            disabled={loading || item.status !== "OPEN"}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
            {
                loading
                    ? "Opening Chat..."
                    : item.type === "FOUND"
                        ? "Contact Finder"
                        : "Contact Owner"
            }
        </button>
    )
}