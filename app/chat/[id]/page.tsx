import ChatPage from "@/components/chat/ChatPage";
import { use } from "react";

interface PageProps {
    params: Promise<{ id: string }>
}

export default function Page({ params }: PageProps) {
    const resolvedParams = use(params);

    return (
        <ChatPage params={resolvedParams} />
    )
}