import ChatPage from "@/components/chat/ChatPage";

interface PageProps {
    params: Promise<{ id: string }>
}

export default function Page({ params }: PageProps) {
    return (
        <ChatPage params={params} />
    )
}