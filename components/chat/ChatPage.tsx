"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, CheckCircle2 } from "lucide-react";
import axios from "axios";

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

interface ChatPartner {
    id: string;
    name: string | null;
    image: string | null;
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    return (
        <ChatConversation
            key={resolvedParams.id}
            conversationId={resolvedParams.id}
        />
    );
}

function ChatConversation({ conversationId }: { conversationId: string }) {
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [item, setItem] = useState<ItemDetails | null>(null);
    const [partner, setPartner] = useState<ChatPartner | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [historyRetry, setHistoryRetry] = useState(0);
    const [isPageVisible, setIsPageVisible] = useState(false);
    const [hasNewMessages, setHasNewMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);

    const messageListRef = useRef<HTMLDivElement>(null);
    const shouldStickToBottomRef = useRef(true);
    const previousMessageCountRef = useRef(0);
    const pendingMessageSequenceRef = useRef(0);

    const scrollToBottom = () => {
        const messageList = messageListRef.current;
        if (!messageList) return;

        messageList.scrollTo({
            top: messageList.scrollHeight,
            behavior: "smooth",
        });
        shouldStickToBottomRef.current = true;
    };

    useEffect(() => {
        if (!conversationId) return;

        let active = true;
        let fetching = false;

        const fetchMessages = async () => {
            if (fetching) return;
            fetching = true;

            try {
                const res = await axios.get(`/api/chat?conversationId=${conversationId}`, {
                    timeout: 15000,
                });
                if (!active) return;
                const persistedMessages: Message[] = res.data.messages || [];
                setMessages((currentMessages) => {
                    const pendingMessages = currentMessages.filter(
                        (message) => message.id.startsWith("pending-"),
                    );
                    const nextMessages = [
                        ...persistedMessages,
                        ...pendingMessages.filter(
                            (pending) =>
                                !persistedMessages.some(
                                    (persisted) => persisted.id === pending.id,
                                ),
                        ),
                    ];
                    const unchanged =
                        currentMessages.length === nextMessages.length &&
                        currentMessages.every((message, index) => {
                            const nextMessage = nextMessages[index];
                            return (
                                message.id === nextMessage.id &&
                                message.content === nextMessage.content &&
                                message.senderId === nextMessage.senderId &&
                                message.receiverId === nextMessage.receiverId &&
                                message.createdAt === nextMessage.createdAt &&
                                message.read === nextMessage.read &&
                                message.sender.name === nextMessage.sender.name
                            );
                        });

                    return unchanged ? currentMessages : nextMessages;
                });
                setItem(res.data.item || null);
                setPartner(res.data.partner || null);
                setCurrentUserId(res.data.currentUserId || null);
                setCurrentUserName(res.data.currentUserName || null);
                setHistoryError(null);
            } catch (error) {
                console.error("Error fetching messages: ", error);
                if (active) {
                    setHistoryError("We couldn't load this conversation. Please try again.");
                }
            } finally {
                fetching = false;
                if (active) setLoading(false);
            }
        };

        void fetchMessages();
        // Database polling is the source-of-truth fallback when users are
        // connected to different server processes and cannot share the SSE emitter.
        const refreshInterval = window.setInterval(() => {
            void fetchMessages();
        }, 3000);

        // Connect to the message stream for this conversation.
        const eventSource = new EventSource(
            `/api/chat/stream?conversationId=${conversationId}`
        );

        eventSource.onmessage = () => void fetchMessages();

        return () => {
            active = false;
            window.clearInterval(refreshInterval);
            eventSource.close();
        };
    }, [conversationId, historyRetry]);

    useEffect(() => {
        if (
            loading ||
            !currentUserId ||
            !isPageVisible ||
            !messages.some(
                (message) => message.receiverId === currentUserId && !message.read,
            )
        ) {
            return;
        }

        let active = true;
        const markMessagesRead = async () => {
            try {
                const response = await axios.post("/api/chat/read", { conversationId });
                if (active && response.status === 200) {
                    setMessages((currentMessages) =>
                        currentMessages.map((message) =>
                            message.receiverId === currentUserId
                                ? { ...message, read: true }
                                : message,
                        ),
                    );
                }
            } catch (error) {
                console.error("Error marking messages as read:", error);
            }
        };

        void markMessagesRead();
        return () => {
            active = false;
        };
    }, [conversationId, currentUserId, isPageVisible, loading, messages]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsPageVisible(document.visibilityState === "visible");
        };

        handleVisibilityChange();
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);



    const handleMessageListScroll = () => {
        const messageList = messageListRef.current;
        if (!messageList) return;

        const distanceFromBottom =
            messageList.scrollHeight -
            messageList.scrollTop -
            messageList.clientHeight;
        shouldStickToBottomRef.current = distanceFromBottom < 120;
        if (shouldStickToBottomRef.current) {
            setHasNewMessages(false);
        }
    };

    useEffect(() => {
        if (loading) return;

        const previousMessageCount = previousMessageCountRef.current;
        if (
            previousMessageCount === 0 ||
            (messages.length > previousMessageCount &&
                shouldStickToBottomRef.current)
        ) {
            scrollToBottom();
        } else if (messages.length > previousMessageCount) {
            setHasNewMessages(true);
        }
        previousMessageCountRef.current = messages.length;
    }, [loading, messages.length]);

    const sendMessage = async (message: Message, isRetry = false) => {
        shouldStickToBottomRef.current = true;
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

            setMessages((prev) => [
                ...prev.filter(
                    (current) =>
                        current.id !== message.id && current.id !== res.data.message.id,
                ),
                res.data.message,
            ]);
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
            id: `pending-${++pendingMessageSequenceRef.current}`,
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
                            {partner?.name || "Conversation"}
                        </h1>
                        {item && (
                            <p className="text-xs text-muted-foreground">
                                {item.type}: {item.title}
                            </p>
                        )}
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
            <div
                ref={messageListRef}
                onScroll={handleMessageListScroll}
                className="min-h-0 flex-1 overflow-y-auto py-4 space-y-3"
            >
                {loading ? (
                    <div className="flex justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground">
                        {historyError ? (
                            <div className="space-y-2">
                                <p>{historyError}</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHistoryError(null);
                                        setLoading(true);
                                        setHistoryRetry((retry) => retry + 1);
                                    }}
                                    className="font-medium text-primary underline"
                                >
                                    Retry loading messages
                                </button>
                            </div>
                        ) : (
                            "No messages yet. Send a message to coordinate!"
                        )}
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe =
                            msg.id.startsWith("pending-") ||
                            (currentUserId !== null && msg.senderId === currentUserId);
                        const participantIds = [currentUserId, partner?.id]
                            .filter((id): id is string => Boolean(id))
                            .sort();
                        const senderColorIndex = participantIds.indexOf(msg.senderId);
                        const senderColors =
                            senderColorIndex === 1
                                ? {
                                      bubble: "bg-emerald-600 text-white",
                                      label: "text-emerald-700 dark:text-emerald-300",
                                  }
                                : {
                                      bubble: "bg-indigo-600 text-white",
                                      label: "text-indigo-700 dark:text-indigo-300",
                                  };
                        const senderName = isMe
                            ? `${currentUserName || msg.sender.name || "You"} (You)`
                            : msg.sender.name || partner?.name || "Other user";
                        const messageDate = new Date(msg.createdAt);
                        const previousMessage = messages[index - 1];
                        const startsNewDay =
                            !previousMessage ||
                            new Date(previousMessage.createdAt).toDateString() !==
                                messageDate.toDateString();
                        const today = new Date();
                        const yesterday = new Date();
                        yesterday.setDate(today.getDate() - 1);
                        const dateLabel =
                            messageDate.toDateString() === today.toDateString()
                                ? "Today"
                                : messageDate.toDateString() === yesterday.toDateString()
                                  ? "Yesterday"
                                  : messageDate.toLocaleDateString([], {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                    });
                        return (
                            <div key={msg.id} className="space-y-2">
                                {startsNewDay && (
                                    <div className="flex justify-center py-2">
                                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                                            {dateLabel}
                                        </span>
                                    </div>
                                )}
                                <div
                                    className={`flex flex-col ${
                                        isMe ? "items-end" : "items-start"
                                    }`}
                                >
                                    <span
                                        className={`mb-1 px-1 text-xs font-semibold ${senderColors.label}`}
                                    >
                                        {senderName}
                                    </span>
                                    <div
                                        className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${senderColors.bubble} ${
                                            isMe
                                                ? "rounded-br-none"
                                                : "rounded-bl-none"
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
                                                        disabled={
                                                            sending ||
                                                            retryingMessageId === msg.id
                                                        }
                                                        className="underline disabled:opacity-50"
                                                    >
                                                        Retry
                                                    </button>
                                                </>
                                            ) : (
                                                <span>
                                                    {sending
                                                        ? "Sending..."
                                                        : "Message queued"}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <span>
                                            {messageDate.toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>

                                        {isMe && (
                                            <span className="ml-1 font-medium text-gray-400 dark:text-gray-500">
                                                • {msg.read ? "Read" : "Sent"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                {hasNewMessages && (
                    <div className="sticky bottom-3 flex justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                shouldStickToBottomRef.current = true;
                                setHasNewMessages(false);
                                scrollToBottom();
                            }}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg"
                        >
                            New messages ↓
                        </button>
                    </div>
                )}
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
    );
}