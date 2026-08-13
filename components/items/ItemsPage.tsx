"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMapEvents, MapContainer as LeafletMapContainer, TileLayer as LeafletTileLayer, Marker as LeafletMarker } from "react-leaflet";
import { useForm, Controller } from "react-hook-form";
import {
    AlertCircle,
    FileText,
    Loader2,
    MapPin,
    PackagePlus,
    Tag
} from "lucide-react";
import dynamic from "next/dynamic";
import { ReportFormValues, reportSchema } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";

const MapContainer = dynamic(
    () => import("react-leaflet").then((mod) => mod.MapContainer as unknown as typeof LeafletMapContainer),
    { ssr: false }
) as typeof LeafletMapContainer;

const TileLayer = dynamic(
    () => import("react-leaflet").then((mod) => mod.TileLayer as unknown as typeof LeafletTileLayer),
    { ssr: false }
) as typeof LeafletTileLayer;

const Marker = dynamic(
    () => import("react-leaflet").then((mod) => mod.Marker as unknown as typeof LeafletMarker),
    { ssr: false }
) as typeof LeafletMarker;


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
            latitude: null,
            longitude: null,
        },
    });

    useEffect(() => {
        import("leaflet").then((L) => {
            delete (L.Icon.Default.prototype as any)._getIconUrl;

            L.Icon.Default.mergeOptions({
                iconRetinaUrl:
                    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
                iconUrl:
                    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
                shadowUrl:
                    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
            });
        });
    }, []);

    const activeType = watch("type");
    const lat = watch("latitude");
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
                setValue("latitude", pos.coords.latitude, { shouldValidate: true });
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
            const res = await api.post("/items", data);

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

            {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6 bg-card p-6 md:p-8 rounded-xl border border-border shadow-sm"
            >
                {/* Item Type (LOST / FOUND) */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Report Type</label>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setValue("type", "LOST")}
                            className={`py-3 px-4 rounded-lg text-sm font-semibold border transition-all ${activeType === "LOST"
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-background border-border text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            I Lost Something
                        </button>
                        <button
                            type="button"
                            onClick={() => setValue("type", "FOUND")}
                            className={`py-3 px-4 rounded-lg text-sm font-semibold border transition-all ${activeType === "FOUND"
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-background border-border text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            I Found Something
                        </button>
                    </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium text-card-foreground">
                        Item Title *
                    </label>
                    <input
                        id="title"
                        type="text"
                        placeholder="e.g. Web-II Notebook, Black Wallet"
                        {...register("title")}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {errors.title && (
                        <p className="text-xs text-destructive">{errors.title.message}</p>
                    )}
                </div>

                {/* Category */}
                <div className="space-y-2">
                    <label htmlFor="category" className="text-sm font-medium text-card-foreground flex items-center gap-2">
                        <Tag className="w-4 h-4 text-muted-foreground" /> Category
                    </label>
                    <select
                        id="category"
                        {...register("category")}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="ELECTRONICS">Electronics</option>
                        <option value="CLOTHING">Clothing & Accessories</option>
                        <option value="DOCUMENTS">IDs & Documents</option>
                        <option value="KEYS">Keys</option>
                        <option value="BAGS">Bags & Backpacks</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium text-card-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" /> Description
                    </label>
                    <textarea
                        id="description"
                        rows={4}
                        placeholder="Provide details like color, brand, distinct marks..."
                        {...register("description")}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                {/* Map Location Selector */}
                <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-card-foreground flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" /> Pin Location on Map
                        </label>
                        <button
                            type="button"
                            onClick={handleGetLocation}
                            disabled={fetchingLocation}
                            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                        >
                            {fetchingLocation ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <MapPin className="w-3.5 h-3.5" />
                            )}
                            Use GPS
                        </button>
                    </div>

                    <div className="h-64 w-full rounded-lg overflow-hidden border border-border">
                        {React.createElement(MapContainer as any, {
                            center: mapCenter,
                            zoom: 13,
                            scrollWheelZoom: true,
                            className: "h-full w-full",
                            children: [
                                React.createElement(TileLayer as any, {
                                    key: "tile-layer",
                                    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                                }),
                                <LocationPickerMarker
                                    key="location-picker"
                                    position={lat && lng ? [lat, lng] : null}
                                    onSelect={(selectedLat, selectedLng) => {
                                        setValue("latitude", selectedLat, { shouldValidate: true });
                                        setValue("longitude", selectedLng, { shouldValidate: true });
                                    }}
                                />,
                            ],
                        })}
                    </div>

                    {lat && lng && (
                        <p className="text-xs text-muted-foreground">
                            Selected location: {lat.toFixed(4)}, {lng.toFixed(4)}
                        </p>
                    )}
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground font-medium px-6 py-2.5 rounded-lg text-sm shadow-sm transition-opacity disabled:opacity-50"
                    >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Submit Report
                    </button>
                </div>
            </form>
        </div>
    );
}