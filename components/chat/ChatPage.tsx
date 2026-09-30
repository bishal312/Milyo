"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, CheckCircle2 } from "lucide-react";
import axios from "axios";
import { ChatItemHeader } from "./ChatItemHeader";

interface Message {
    id: string;
    content?: string;
    senderId: string;
    receiverId: string;
    createdAt: string;
    read: boolean;
    sender: {
        id: string;
        name?: string | null;
        image?: string | null;
    };
    deliveryError?: string;
}

interface ItemDetails {
    id: string;
    title: string;
    type: "LOST" | "FOUND";
    status: "OPEN" | "RESOLVED" | "CLAIMED" | "MATCHED";
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const conversationId = resolvedParams.id;
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [item, setItem] = useState<ItemDetails | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (!conversationId) return;

        let active = true;

        const fetchMessages = async () => {
            try {
                const res = await axios.get(`/api/chat?conversationId=${conversationId}`, {
                    timeout: 15000,
                });
                if (!active) return;
                setMessages(res.data.messages || []);
                setItem(res.data.item || null);
                setCurrentUserId(res.data.currentUserId || null);
            } catch (error) {
                console.error("Error fetching messages: ", error);
            } finally {
                if (active) setLoading(false);
            }
        };

        void fetchMessages();

        // Connect to the message stream for this conversation.
        const eventSource = new EventSource(
            `/api/chat/stream?conversationId=${conversationId}`
        );

        eventSource.onmessage = (event) => {
            try {
                const incomingMsg = JSON.parse(event.data);
                setMessages((prev) => {
                    if (prev.some((message) => message.id === incomingMsg.id)) return prev;
                    const pendingIndex = prev.findIndex((message) =>
                        message.id.startsWith("pending-") &&
                        message.senderId === incomingMsg.senderId &&
                        message.content === incomingMsg.content
                    );
                    if (pendingIndex !== -1) {
                        return prev.map((message, index) => index === pendingIndex ? incomingMsg : message);
                    }
                    return [...prev, incomingMsg];
                });
            } catch (error) {
                console.error("Error parsing streaming message: ", error);
            }
        };

        return () => {
            active = false;
            eventSource.close();
        };
    }, [conversationId]);



    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (message: Message, isRetry = false) => {
        setMessages((prev) => isRetry
            ? prev.map((current) => current.id === message.id ? message : current)
            : [...prev, message]
        );
        setSending(true);

        try {
            const res = await axios.post(
                "/api/chat",
                { conversationId, content: message.content },
                { timeout: 15000 }
            );

            if (!res.data?.message) {
                throw new Error("The server did not confirm the message.");
            }

            setMessages((prev) =>
                prev.map((current) => current.id === message.id ? res.data.message : current)
            );
        } catch (error) {
            console.error("Error sending message: ", error);
            const deliveryError = axios.isAxiosError(error)
                ? error.code === "ECONNABORTED"
                    ? "Sending timed out. Check your connection and retry."
                    : error.response?.data?.error || "Couldn't connect to the server. Check your connection and retry."
                : error instanceof Error
                    ? error.message
                    : "Message could not be sent. Please retry.";

            setMessages((prev) =>
                prev.map((current) => current.id === message.id
                    ? { ...current, deliveryError }
                    : current)
            );
        } finally {
            setSending(false);
            setRetryingMessageId(null);
        }
    };

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        const content = newMessage.trim();
        setNewMessage("");
        const optimisticMessage: Message = {
            id: `pending-${Date.now()}`,
            content,
            senderId: currentUserId || "",
            receiverId: "",
            createdAt: new Date().toISOString(),
            read: false,
            sender: { id: currentUserId || "" },
        };
        await sendMessage(optimisticMessage);
    };

    const handleRetryMessage = async (message: Message) => {
        if (sending) return;
        setRetryingMessageId(message.id);
        const retryMessage = { ...message, deliveryError: undefined };
        await sendMessage(retryMessage, true);
    };

    const handleMarkAsResolved = async () => {
        if (!item?.id) return;
        const confirmed = confirm("Are you sure you want to mark this item as resolved?");
        if (!confirmed) return;

        setResolving(true);
        try {
            const res = await axios.patch(`/api/items/${item.id}/status`, {
                status: "RESOLVED",
            });
            if (res.status === 200) {
                setItem((prev) => (prev ? { ...prev, status: "RESOLVED" } : null));
            }
        } catch (error) {
            console.error("Error resolving item: ", error);
            alert("Failed to update item status.");
        } finally {
            setResolving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto h-[calc(100vh-5rem)] flex flex-col p-4">
            {/* Header */}
            
            <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 border border-border rounded-lg hover:bg-accent transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold">
                            {item ? `${item.type}: ${item.title}` : "Discussion"}
                        </h1>
                        {item && (
                            <Link
                                href={`/items/${item.id}`}
                                className="text-xs text-primary hover:underline"
                            >
                                View item details →
                            </Link>
                        )}
                    </div>
                </div>

                {/* Item Resolution Status Badge / Action Button */}
                {item && (
                    <div className="flex items-center gap-2">
                        <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${item.status === "RESOLVED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                }`}
                        >
                            {item.status}
                        </span>

                        {item.status === "OPEN" && (
                            <button
                                onClick={handleMarkAsResolved}
                                disabled={resolving}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                            >
                                {resolving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Mark Resolved
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground">
                        No messages yet. Send a message to coordinate!
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = currentUserId ? msg.senderId === currentUserId : msg.senderId !== item?.id;
                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                            >
                                <div
                                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe
                                        ? "bg-primary text-primary-foreground rounded-br-none"
                                        : "bg-muted text-foreground rounded-bl-none"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                                {isMe && msg.id.startsWith("pending-") && (
                                    <div className="mt-1 flex items-center gap-2 text-xs text-destructive">
                                        {msg.deliveryError ? (
                                            <>
                                                <span>{msg.deliveryError}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRetryMessage(msg)}
                                                    disabled={sending || retryingMessageId === msg.id}
                                                    className="underline disabled:opacity-50"
                                                >
                                                    Retry
                                                </button>
                                            </>
                                        ) : (
                                            <span>{sending ? "Sending..." : "Message queued"}</span>
                                        )}
                                    </div>
                                )}
                                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>

                                {/* Timestamp & Read Badge */}
                                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400">
                                    <span>
                                        {new Date(msg.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>

                                    {/* Show Read badge only on messages sent by the logged-in user */}
                                    {isMe && (
                                        <span className="font-medium text-gray-400 dark:text-gray-500 ml-1">
                                            • {msg.read ? "Read" : "Sent"}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="pt-2 border-t border-border flex gap-2">
                <input
                    type="text"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition"
                >
                    {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </button>
            </form>
            <ChatItemHeader item={item} />
        </div>
    );
}