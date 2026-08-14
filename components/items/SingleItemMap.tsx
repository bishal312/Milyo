"use client";
import { markerIcon } from "./ItemsFeedMap";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";


interface SingleItemMapProps {
    latitude: number;
    longitude: number;
    title: string;
}

export default function SingleItemMap({ latitude, longitude, title }: SingleItemMapProps) {
    const position: [number, number] = [latitude, longitude];

    return (
        <MapContainer
            center={position}
            zoom={14}
            scrollWheelZoom={true}
            className="h-full w-full rounded-xl border border-border overflow-hidden"
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <Marker position={position} icon={markerIcon}>
                <Popup>
                    <span className="font-semibold text-xs text-foreground">{title}</span>
                </Popup>
            </Marker>
        </MapContainer>
    );
}