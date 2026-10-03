"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMapEvents, MapContainer as LeafletMapContainer, TileLayer as LeafletTileLayer, Marker as LeafletMarker } from "react-leaflet";
import { useForm } from "react-hook-form";
import {
    AlertCircle,
    ArrowLeft,
    FileText,
    ImagePlus,
    Loader2,
    MapPin,
    PackagePlus,
    Tag,
    X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { ReportFormValues, reportSchema } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/axios";
import Link from "next/link";

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

const MAX_PHOTO_SIZE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                reject(new Error("The selected image could not be read."));
                return;
            }

            resolve(reader.result);
        };
        reader.onerror = () => reject(reader.error ?? new Error("The selected image could not be read."));
        reader.readAsDataURL(file);
    });
}


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
    const [success, setSuccess] = useState<string | null>(null);
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
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
        if (!photo) {
            setPhotoPreview(null);
            return;
        }

        const previewUrl = URL.createObjectURL(photo);
        setPhotoPreview(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [photo]);

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
        setSuccess(null);

        try {
            const photoUrl = photo ? await readFileAsDataUrl(photo) : null;
            const response = await api.post("/items", { ...data, photoUrl });
            const matching = response.data.matching as {
                checked: number;
                created: number;
                failed: number;
            };

            reset();
            setPhoto(null);
            if (photoInputRef.current) {
                photoInputRef.current.value = "";
            }
            setSuccess(
                matching.created > 0
                    ? `Report submitted. AI found ${matching.created} potential match${matching.created === 1 ? "" : "es"}; review them on the Matches page.${matching.failed > 0 ? ` ${matching.failed} comparison${matching.failed === 1 ? "" : "s"} could not be completed.` : ""}`
                    : matching.failed > 0
                        ? `Report submitted, but ${matching.failed} image comparison${matching.failed === 1 ? " was" : "s were"} unsuccessful.`
                        : matching.checked > 0
                            ? "Report submitted. No matching items were found."
                            : photoUrl
                                ? "Report submitted. There were no other photo reports to compare yet."
                                : "Report submitted.",
            );
        } catch (error) {
            console.error(error);
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-3xl mx-auto space-y-8">
            {/* HEADER */}
            <div className="border-b border-border pb-6">
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to dashboard
                </Link>
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

            {success && (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm">
                    {success}
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

                {/* Optional Item Photo */}
                <div className="space-y-2">
                    <label htmlFor="photo" className="text-sm font-medium text-card-foreground flex items-center gap-2">
                        <ImagePlus className="w-4 h-4 text-muted-foreground" /> Photo (optional)
                    </label>
                    <input
                        ref={photoInputRef}
                        id="photo"
                        type="file"
                        accept={ACCEPTED_PHOTO_TYPES.join(",")}
                        onChange={(event) => {
                            const selectedPhoto = event.target.files?.[0];
                            if (!selectedPhoto) {
                                return;
                            }

                            if (!ACCEPTED_PHOTO_TYPES.includes(selectedPhoto.type)) {
                                setError("Choose a JPEG, PNG, or WebP image.");
                                event.target.value = "";
                                return;
                            }

                            if (selectedPhoto.size > MAX_PHOTO_SIZE_BYTES) {
                                setError("The image must be no larger than 3 MB.");
                                event.target.value = "";
                                return;
                            }

                            setError(null);
                            setPhoto(selectedPhoto);
                        }}
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:font-medium file:text-primary hover:file:bg-primary/20"
                    />
                    <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP; up to 3 MB.</p>
                    {photo && photoPreview && (
                        <div className="relative w-fit">
                            <Image
                                src={photoPreview}
                                alt="Selected item preview"
                                width={480}
                                height={320}
                                unoptimized
                                className="max-h-56 max-w-full rounded-lg border border-border object-contain"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setPhoto(null);
                                    if (photoInputRef.current) {
                                        photoInputRef.current.value = "";
                                    }
                                }}
                                className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow hover:bg-background"
                                aria-label="Remove selected photo"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
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