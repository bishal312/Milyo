// app/chat/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Conversation {
  id: string;
  partner: {
    id: string;
    name: string;
    image?: string | null;
  };
  item?: {
    id: string;
    title: string;
    photoUrl?: string | null;
    type: "LOST" | "FOUND";
    status: string;
  } | null;
  lastMessage?: {
    content: string;
    createdAt: string;
  } | null;
  isUnread: boolean;
  updatedAt: string;
}

export default function ChatInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch("/api/chat/conversations");
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch (err) {
        console.error("Error loading conversations:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchConversations();
  }, []);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.item?.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Communicate with item owners and finders
          </p>
        </div>

        {/* Search Filter */}
        <input
          type="text"
          placeholder="Search by user or item..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-64 px-4 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400 font-medium">No conversations found</p>
          <p className="text-xs text-gray-400 mt-1">
            When you claim an item or contact a finder, conversations will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/chat/${conv.id}`}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md ${
                conv.isUnread
                  ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* User Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center font-bold text-gray-600 dark:text-gray-200">
                    {conv.partner.image ? (
                      <Image
                        src={conv.partner.image}
                        alt={conv.partner.name}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      conv.partner.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  {conv.isUnread && (
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-blue-600 border-2 border-white dark:border-gray-900 rounded-full" />
                  )}
                </div>

                {/* Info & Message Preview */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                      {conv.partner.name}
                    </h2>
                    {conv.item && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${
                          conv.item.type === "LOST"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        }`}
                      >
                        {conv.item.type}: {conv.item.title}
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-sm truncate mt-1 ${
                      conv.isUnread
                        ? "font-semibold text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {conv.lastMessage?.content || "No messages yet"}
                  </p>
                </div>
              </div>

              {/* Timestamp */}
              <div className="text-xs text-gray-400 flex-shrink-0 ml-4">
                {new Date(conv.updatedAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}