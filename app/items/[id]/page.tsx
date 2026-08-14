import ItemDetailPage from "@/components/items/ItemDetailPage";

interface Props {
    params: Promise<{ id: string }>;
}

export default function Page({ params }: Props) {
    return (
        <ItemDetailPage params={params} />
    )
}