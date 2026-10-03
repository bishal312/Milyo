"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
    Activity,
    ArrowLeft,
    Bot,
    Boxes,
    ChevronDown,
    FolderKanban,
    MessageSquare,
    Package,
    RefreshCw,
    ShieldCheck,
    Trash2,
    Users,
} from "lucide-react";
import { reportSchema } from "@/types";

type Entity =
    | "users"
    | "items"
    | "categories"
    | "claims"
    | "matches"
    | "reports"
    | "conversations"
    | "messages";
type Section = Entity | "overview";
type AdminRecord = { id: string; data: Record<string, unknown> };
type OverviewCounts = Record<string, number>;
type AdminDialog =
    | {
        kind: "category";
        mode: "rename" | "reassign";
        record: AdminRecord;
        value: string;
    }
    | {
        kind: "delete";
        entity: Entity;
        record: AdminRecord;
        title: string;
        description: string;
    };

const sections: { id: Section; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "items", label: "Lost & found items", icon: Package },
    { id: "categories", label: "Categories", icon: FolderKanban },
    { id: "claims", label: "Claims", icon: Boxes },
    { id: "matches", label: "Matches", icon: ShieldCheck },
    { id: "reports", label: "AI reports", icon: Bot },
    { id: "conversations", label: "Conversations", icon: MessageSquare },
    { id: "messages", label: "Messages", icon: MessageSquare },
];

const editableFields: Partial<Record<Entity, string[]>> = {
    users: ["name", "email", "emailVerified", "image"],
    items: ["title", "category", "description", "photoUrl", "latitude", "longitude", "type", "status", "reportedBy"],
    claims: ["itemId", "claimantId", "answers", "verified"],
    matches: ["lostItemId", "foundItemId", "score", "status"],
    reports: ["lostItemId", "foundItemId", "status", "score", "confidenceLevel", "reasoning", "keyMatchingFeatures", "discrepancies"],
    conversations: ["itemId", "user1Id", "user2Id"],
    messages: ["conversationId", "itemId", "senderId", "receiverId", "content", "read"],
};

const categories = reportSchema.shape.category.options;

function errorMessage(error: unknown) {
    if (axios.isAxiosError<{ error?: string }>(error)) {
        return error.response?.data?.error ?? error.message;
    }
    return error instanceof Error ? error.message : "Something went wrong.";
}

function displayValue(value: unknown) {
    return typeof value === "string" ? value : JSON.stringify(value);
}

export default function AdminPage() {
    const [section, setSection] = useState<Section>("overview");
    const [counts, setCounts] = useState<OverviewCounts>({});
    const [records, setRecords] = useState<AdminRecord[]>([]);
    const offsetRef = useRef(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [dialog, setDialog] = useState<AdminDialog | null>(null);

    const loadSection = useCallback(async (nextSection: Section, append = false) => {
        setLoading(true);
        setError(null);
        setNotice(null);
        try {
            if (nextSection === "overview") {
                const response = await axios.get("/api/admin?entity=overview");
                setCounts(response.data.counts);
                setAuthorized(true);
            } else {
                const pageOffset = append ? offsetRef.current : 0;
                const response = await axios.get(
                    `/api/admin?entity=${nextSection}&offset=${pageOffset}`,
                );
                setRecords((current) =>
                    append ? [...current, ...response.data.records] : response.data.records,
                );
                setHasMore(response.data.hasMore ?? false);
                const nextOffset = pageOffset + response.data.records.length;
                offsetRef.current = nextOffset;
                setAuthorized(true);
            }
        } catch (loadError) {
            if (
                axios.isAxiosError(loadError) &&
                (loadError.response?.status === 401 || loadError.response?.status === 403)
            ) {
                setAuthorized(false);
            } else {
                setError(errorMessage(loadError));
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        offsetRef.current = 0;
        const timeout = window.setTimeout(() => {
            void loadSection(section);
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [section, loadSection]);

    function beginEdit(record: AdminRecord) {
        const fields = editableFields[section as Entity] ?? [];
        const editableData = Object.fromEntries(
            fields
                .filter((field) => field in record.data)
                .map((field) => [field, record.data[field]]),
        );
        setEditingId(record.id);
        setEditValue(JSON.stringify(editableData, null, 2));
        setError(null);
        setNotice(null);
    }

    async function saveRecord(record: AdminRecord) {
        let data: unknown;
        try {
            data = JSON.parse(editValue);
        } catch {
            setError("The edit is not valid JSON.");
            return;
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            setError("Enter a JSON object containing the fields to update.");
            return;
        }

        setSavingId(record.id);
        setError(null);
        try {
            await axios.patch("/api/admin", { entity: section, id: record.id, data });
            setNotice("Record updated.");
            setEditingId(null);
            await loadSection(section);
        } catch (saveError) {
            setError(errorMessage(saveError));
        } finally {
            setSavingId(null);
        }
    }

    function deleteRecord(record: AdminRecord) {
        const label = String(record.data.name ?? record.data.title ?? record.data.content ?? record.id);
        setError(null);
        const entity = section as Entity;
        setDialog({
            kind: "delete",
            entity,
            record,
            title: `Delete ${entity.slice(0, -1)}?`,
            description: entity === "users"
                ? `Permanently delete ${label} and this user's items, claims, matches, conversations, and messages? This cannot be undone.`
                : `Permanently delete this ${entity.slice(0, -1)} record? This cannot be undone.`,
        });
    }

    function changeCategory(record: AdminRecord, mode: "rename" | "reassign") {
        const currentName = String(record.data.category ?? record.id);
        setError(null);
        setDialog({
            kind: "category",
            mode,
            record,
            value: mode === "rename" ? currentName : "Uncategorized",
        });
    }

    async function submitDialog() {
        if (!dialog) return;
        const { record } = dialog;
        setSavingId(record.id);
        setError(null);
        try {
            if (dialog.kind === "category") {
                const category = dialog.value.trim();
                if (!category) {
                    setError("Enter a category name.");
                    return;
                }
                if (dialog.mode === "reassign" && category === record.id) {
                    setError("Choose a different category for reassignment.");
                    return;
                }

                if (dialog.mode === "reassign") {
                    await axios.delete("/api/admin", {
                        data: {
                            entity: "categories",
                            id: record.id,
                            replacementCategory: category,
                        },
                    });
                } else {
                    await axios.patch("/api/admin", {
                        entity: "categories",
                        id: record.id,
                        data: { category },
                    });
                }
                setNotice(dialog.mode === "reassign" ? "Category items were reassigned." : "Category renamed.");
                setDialog(null);
                await loadSection("categories");
                return;
            }

            await axios.delete("/api/admin", {
                data: { entity: dialog.entity, id: record.id },
            });
            setNotice("Record deleted.");
            setDialog(null);
            await loadSection(dialog.entity);
        } catch (dialogError) {
            setError(errorMessage(dialogError));
        } finally {
            setSavingId(null);
        }
    }

    function closeDialog() {
        if (savingId) return;
        setDialog(null);
        setError(null);
    }

    function updateCategoryValue(value: string) {
        setDialog((current) =>
            current?.kind === "category" ? { ...current, value } : current,
        );
    }

    if (authorized === false) {
        return (
            <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
                <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                    <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-amber-400" />
                    <h1 className="text-2xl font-bold">Admin access required</h1>
                    <p className="mt-3 text-sm text-slate-400">
                        Sign in with an account listed in the server&apos;s ADMIN_EMAILS environment variable.
                    </p>
                    <div className="mt-6 flex justify-center gap-5">
                        <Link href="/sign-in" className="text-sm text-blue-300 hover:text-blue-200">
                            Sign in
                        </Link>
                        <Link href="/" className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200">
                            <ArrowLeft className="h-4 w-4" /> Back to Milyo
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <header className="border-b border-slate-800 bg-slate-900/80">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Milyo</p>
                        <h1 className="text-xl font-bold">Admin console</h1>
                    </div>
                    <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
                        <ArrowLeft className="h-4 w-4" /> Back to app
                    </Link>
                </div>
            </header>

            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)]">
                <nav className="flex gap-2 overflow-x-auto lg:flex-col">
                    {sections.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => {
                                setEditingId(null);
                                offsetRef.current = 0;
                                setSection(id);
                            }}
                            className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${section === id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-900"
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </nav>

                <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold">
                                {sections.find((item) => item.id === section)?.label}
                            </h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Review and manage Milyo&apos;s existing data.
                            </p>
                        </div>
                        <button
                            onClick={() => void loadSection(section)}
                            disabled={loading}
                            aria-label="Refresh data"
                            className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    {error && (
                        <div role="alert" className="mb-4 rounded-lg border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    )}
                    {notice && (
                        <p role="status" className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
                            {notice}
                        </p>
                    )}

                    {section === "overview" ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {Object.entries(counts).map(([name, count]) => (
                                <button
                                    key={name}
                                    onClick={() => setSection(name as Entity)}
                                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-left hover:border-blue-700"
                                >
                                    <p className="text-sm capitalize text-slate-400">{name}</p>
                                    <p className="mt-2 text-3xl font-bold">{count}</p>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {loading && records.length === 0 ? (
                                <p className="py-10 text-center text-sm text-slate-400">Loading records…</p>
                            ) : records.length === 0 ? (
                                <p className="py-10 text-center text-sm text-slate-400">No records found.</p>
                            ) : records.map((record) => (
                                <article key={record.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-all font-medium">
                                                {String(record.data.name ?? record.data.title ?? record.data.category ?? record.data.content ?? record.id)}
                                            </p>
                                            <p className="mt-1 break-all text-xs text-slate-500">{record.id}</p>
                                            {section === "categories" && (
                                                <p className="mt-1 text-xs text-slate-400">{String(record.data.itemCount)} items</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {section === "categories" ? (
                                                <>
                                                    <button onClick={() => changeCategory(record, "rename")} disabled={savingId === record.id} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800">Rename</button>
                                                    <button onClick={() => changeCategory(record, "reassign")} disabled={savingId === record.id} className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950">Reassign &amp; delete</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => editingId === record.id ? setEditingId(null) : beginEdit(record)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800">
                                                        {editingId === record.id ? "Cancel" : "Edit"}
                                                    </button>
                                                    <button onClick={() => void deleteRecord(record)} disabled={savingId === record.id} className="inline-flex items-center gap-1 rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950 disabled:opacity-50">
                                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {section !== "categories" && (
                                        editingId === record.id ? (
                                            <div className="mt-4 space-y-3">
                                                <label className="block text-xs text-slate-400" htmlFor={`record-${record.id}`}>
                                                    Edit fields as JSON. Only editable model fields are accepted.
                                                </label>
                                                <textarea
                                                    id={`record-${record.id}`}
                                                    value={editValue}
                                                    onChange={(event) => setEditValue(event.target.value)}
                                                    rows={Math.min(14, Math.max(5, editValue.split("\n").length + 1))}
                                                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 font-mono text-xs text-slate-100 outline-none focus:border-blue-500"
                                                />
                                                <button
                                                    onClick={() => void saveRecord(record)}
                                                    disabled={savingId === record.id}
                                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
                                                >
                                                    {savingId === record.id ? "Saving…" : "Save changes"}
                                                </button>
                                            </div>
                                        ) : (
                                            <details className="mt-3">
                                                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-slate-400">
                                                    View record fields <ChevronDown className="h-3.5 w-3.5" />
                                                </summary>
                                                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                                                    {Object.entries(record.data).map(([key, value]) => (
                                                        <div key={key} className="min-w-0 rounded-lg bg-slate-900 px-3 py-2">
                                                            <dt className="text-[11px] text-slate-500">{key}</dt>
                                                            <dd className="mt-1 break-all text-xs text-slate-200">{displayValue(value) ?? "null"}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            </details>
                                        )
                                    )}
                                </article>
                            ))}
                            {hasMore && (
                                <button
                                    onClick={() => void loadSection(section, true)}
                                    disabled={loading}
                                    className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {loading ? "Loading…" : "Load more"}
                                </button>
                            )}
                        </div>
                    )}
                </section>
            </div>
            {dialog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeDialog();
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-dialog-title"
                        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
                    >
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void submitDialog();
                            }}
                        >
                            <h2 id="admin-dialog-title" className="text-lg font-semibold">
                                {dialog.kind === "category"
                                    ? dialog.mode === "rename" ? "Rename category" : "Reassign category items"
                                    : dialog.title}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                                {dialog.kind === "category"
                                    ? dialog.mode === "rename"
                                        ? `Update the category name for all ${dialog.record.data.itemCount} items currently in "${dialog.record.id}".`
                                        : `All ${dialog.record.data.itemCount} items in "${dialog.record.id}" will be moved to the replacement category. The old category will disappear if no items remain.`
                                    : dialog.description}
                            </p>

                            {dialog.kind === "category" && (
                                <div className="mt-4">
                                    <label htmlFor="admin-category-select" className="mb-1.5 block text-sm font-medium text-slate-300">
                                        {dialog.mode === "rename" ? "New category name" : "Move items to"}
                                    </label>
                                    <select
                                        id="admin-category-select"
                                        required
                                        autoFocus
                                        value={dialog.value}
                                        onChange={(event) => updateCategoryValue(event.target.value)}
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                                    >
                                        <option value="" disabled>
                                            Select a category...
                                        </option>
                                        {/* Map over your categories array here */}
                                        {categories.map((category) => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {error && (
                                <p role="alert" className="mt-3 rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
                                    {error}
                                </p>
                            )}

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeDialog}
                                    disabled={savingId !== null}
                                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingId !== null || (dialog.kind === "category" && !dialog.value.trim())}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${dialog.kind === "delete" || dialog.kind === "category" && dialog.mode === "reassign"
                                            ? "bg-red-700 hover:bg-red-600"
                                            : "bg-blue-600 hover:bg-blue-500"
                                        }`}
                                >
                                    {savingId !== null
                                        ? "Saving…"
                                        : dialog.kind === "category"
                                            ? dialog.mode === "rename" ? "Rename category" : "Reassign items"
                                            : "Delete permanently"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}
