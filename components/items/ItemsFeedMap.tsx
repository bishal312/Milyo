"use client"

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet"
import L from "leaflet";
import Link from "next/link";
import { ItemType } from "@/types";

// Custom Leaflet Pin Icon
export const markerIcon = new L.Icon({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

export default function ItemsFeedMap({ items }: { items: ItemType[] }) {
    const itemsWithCoords = items.filter((item) => item.latitude && item.longitude);

    const center: [number, number] =
        itemsWithCoords.length > 0
            ? [itemsWithCoords[0].latitude!, itemsWithCoords[0].longitude!]
            : [27.6802, 83.4456];

    return (
        <MapContainer
            center={center}
            zoom={12}
            scrollWheelZoom={true}
            className="h-150 w-full rounded-xl border border-border overflow-hidden"
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {itemsWithCoords.map((item) => (
                <Marker
                    key={item.id}
                    position={[item.latitude!, item.longitude!]}
                    icon={markerIcon}
                >
                    <Popup>
                        <div className="space-y-2 p-1">
                            <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.type === "LOST"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-emerald-100 text-emerald-700"
                                    }`}
                            >
                                {item.type}
                            </span>
                            <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
                            {item.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {item.description}
                                </p>
                            )}
                            <Link
                                href={`/items/${item.id}`}
                                className="block text-xs font-semibold text-primary hover:underline pt-1"
                            >
                                View Details →
                            </Link>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}