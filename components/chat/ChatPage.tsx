"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import axios from "axios";

interface Message {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    createdAt: string;
    sender: {
        id: string;
        name?: string | null;
        image?: string | null;
    };
}

export default function ChatPage({ params }: { params: { id: string } }) {
    const itemId = params.id;
    const searchParams = useSearchParams();
    const receiverId = searchParams.get("recipientId");
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Fetch messages from api
    const fetchMessages = async () => {
        if (!itemId || !receiverId) return;
        try {
            const res = await axios.get(`/api/chat?itemId=${itemId}&otherUserId=${receiverId}`);
            if (res.data) {
                setMessages(res.data);
            }
        } catch (error) {
            console.error("Error fetching messages: ", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();

        //polling message in 3 second
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [itemId, receiverId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !receiverId || sending) return;

        setSending(true);
        const tempText = newMessage;
        setNewMessage("");

        try {
            const res = await axios.post("/api/chat", {
                itemId,
                receiverId,
                content: tempText,
            });
            if (res.data) {
                const sentMessage = res.data;
                setMessages((prev) => [...prev, sentMessage]);
            } else {
                setNewMessage(tempText); //Restore on error
            }
        } catch (error) {
            console.error("Error sending message: ", error);
            setNewMessage(tempText)
        } finally {
            setSending(false);
        }
    };

    if (!receiverId) {
        return (
            <div className="max-w-2xl mx-auto p-6 text-center text-muted-foreground">
                Invalid chat session. No recipient specified.
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto h-[calc(100vh-5rem)] flex flex-col p-4">
            {/* Header */}
            <div className="flex items-center gap-4 pb-4 border-b border-border">
                <button
                    onClick={() => router.back()}
                    className="p-2 border border-border rounded-lg hover:bg-accent"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-lg font-bold">Item Return Discussion</h1>
                    <Link
                        href={`/items/${itemId}`}
                        className="text-xs text-primary hover:underline"
                    >
                        View associated item details →
                    </Link>
                </div>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground">
                        No messages yet. Send a message to coordinate the return!
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId !== receiverId;
                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isMe ? "items-end" : "items-start"
                                    }`}
                            >
                                <div
                                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-muted text-foreground rounded-bl-none"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
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
        </div>
    )
}