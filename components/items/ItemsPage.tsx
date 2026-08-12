"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMapEvents } from "react-leaflet";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import {
    PackagePlus
} from "lucide-react";
import dynamic from "next/dynamic";
import { ReportFormValues, reportSchema } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";

const MapContainer = dynamic(
    () => import("react-leaflet").then((mod) => mod.MapContainer),
    { ssr: false }
);

const TileLayer = dynamic(
    () => import("react-leaflet").then((mod) => mod.TileLayer),
    { ssr: false }
);

const Marker = dynamic(
    () => import("react-leaflet").then((mod) => mod.Marker),
);


function LocationPickerMarker({
    position,
    onSelect,
}: {
    position: [number, number] | null;
    onSelect: (lat: number, lng: number) => void;
}) {
    useMapEvents({
        click(e: any) {
            onSelect(e.latlng.lat, e.latlng.lng);
        },
    });

    return position ? <Marker position={position} /> : null;
}

export default function ReportItemPage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        control,
        formState: { errors },
    } = useForm<ReportFormValues>({
        resolver: zodResolver(reportSchema),
        defaultValues: {
            title: "",
            description: "",
            category: "ELECTRONICS",
            type: "LOST",
            latitiude: null,
            longitude: null,
        },
    });

    const activeType = watch("type");
    const lat = watch("latitiude");
    const lng = watch("longitude");

    const mapCenter: [number, number] = lat && lng ? [lat, lng] : [27.68689, 83.45929]; //Default map center

    // Getting browser geolocation
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            return;
        }

        setFetchingLocation(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setValue("latitiude", pos.coords.latitude, { shouldValidate: true });
                setValue("longitude", pos.coords.longitude, { shouldValidate: true });
                setFetchingLocation(false);
            },
            () => {
                setError("Unable to retrieve GPS location.");
                setFetchingLocation(false);
            }
        );
    };

    const onSubmit = async (data: ReportFormValues) => {
        setSubmitting(true);
        setError(null);

        try {
            const res = await api.post("/api/items", data);

            console.log(res.data);
        } catch (error) {
            console.log(error);
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-3xl mx-auto space-y-8">
            {/* HEADER */}
            <div className="border-b border-border pb-6">
                <h1 className="text-3xl font-bold tracking-tight text-foreground font-serif flex items-center gap-3">
                    <PackagePlus className="w-8 h-8 text-primary" />
                    Report an Iteam
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Submit details about a lost or found item to match with potential owners.
                </p>
            </div>
        </div>
    );
}