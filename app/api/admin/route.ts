import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { Prisma } from "@/lib/generated/prisma/client";

const entities = [
    "users",
    "items",
    "categories",
    "claims",
    "matches",
    "reports",
    "conversations",
    "messages",
] as const;

type Entity = (typeof entities)[number];
type AdminView = Entity | "overview";
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): boolean {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (isRecord(value)) return Object.values(value).every(isJsonValue);
    return false;
}

function jsonInput(value: unknown) {
    return value === null ? Prisma.DbNull : value as Prisma.InputJsonValue;
}

function isAdminView(value: string | null): value is AdminView {
    return value === "overview" || entities.some((entity) => entity === value);
}

function isEntity(value: string | null): value is Entity {
    return entities.some((entity) => entity === value);
}

function hasOnlyKeys(value: JsonRecord, allowed: string[]) {
    return Object.keys(value).every((key) => allowed.includes(key));
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
    return value === null || isNumber(value);
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
    return typeof value === "string" && values.includes(value);
}

async function deleteUser(userId: string, adminId: string) {
    if (userId === adminId) {
        return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 400 });
    }

    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    const target = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
    });
    if (!target) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (adminEmails.includes(target.email.toLowerCase())) {
        return NextResponse.json({ error: "Remove this email from ADMIN_EMAILS before deleting an admin account." }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
        const userItems = await tx.item.findMany({
            where: { reportedBy: userId },
            select: { id: true },
        });
        const itemIds = userItems.map(({ id }) => id);

        await tx.chatMessage.deleteMany({
            where: {
                OR: [
                    { senderId: userId },
                    { receiverId: userId },
                    ...(itemIds.length ? [{ itemId: { in: itemIds } }] : []),
                ],
            },
        });
        await tx.conversation.deleteMany({
            where: {
                OR: [
                    { user1Id: userId },
                    { user2Id: userId },
                    ...(itemIds.length ? [{ itemId: { in: itemIds } }] : []),
                ],
            },
        });
        await tx.claim.deleteMany({
            where: {
                OR: [
                    { claimantId: userId },
                    ...(itemIds.length ? [{ itemId: { in: itemIds } }] : []),
                ],
            },
        });
        if (itemIds.length) {
            await tx.match.deleteMany({
                where: {
                    OR: [
                        { lostItemId: { in: itemIds } },
                        { foundItemId: { in: itemIds } },
                    ],
                },
            });
            await tx.item.deleteMany({ where: { id: { in: itemIds } } });
        }
        await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    if (!entity || !isAdminView(entity)) {
        return NextResponse.json({ error: "A valid entity is required." }, { status: 400 });
    }

    try {
        if (entity === "overview") {
            const [users, items, categories, claims, matches, reports, conversations, messages] =
                await Promise.all([
                    db.user.count(),
                    db.item.count(),
                    db.item.findMany({ distinct: ["category"], select: { category: true } }),
                    db.claim.count(),
                    db.match.count(),
                    db.aIComparisonReport.count(),
                    db.conversation.count(),
                    db.chatMessage.count(),
                ]);
            return NextResponse.json({
                counts: { users, items, categories: categories.length, claims, matches, reports, conversations, messages },
            });
        }

        if (entity === "categories") {
            const categories = await db.item.groupBy({
                by: ["category"],
                _count: { _all: true },
                orderBy: { category: "asc" },
            });
            return NextResponse.json({
                records: categories.map(({ category, _count }) => ({
                    id: category,
                    data: { category, itemCount: _count._all },
                })),
            });
        }

        const requestedOffset = Number(searchParams.get("offset"));
        const offset = Number.isInteger(requestedOffset) && requestedOffset > 0
            ? requestedOffset
            : 0;
        const take = 50;
        let records: { id: string; data: JsonRecord }[] = [];

        switch (entity) {
            case "users": {
                const rows = await db.user.findMany({
                    orderBy: { createdAt: "desc" },
                    skip: offset,
                    take,
                    select: { id: true, name: true, email: true, emailVerified: true, image: true, createdAt: true, updatedAt: true },
                });
                records = rows.map((row) => ({ id: row.id, data: row }));
                break;
            }
            case "items": {
                const rows = await db.item.findMany({
                    orderBy: { createdAt: "desc" },
                    skip: offset,
                    take,
                    select: { id: true, title: true, category: true, description: true, photoUrl: true, latitude: true, longitude: true, type: true, status: true, reportedBy: true, createdAt: true },
                });
                records = rows.map((row) => ({ id: row.id, data: row }));
                break;
            }
            case "claims": {
                const rows = await db.claim.findMany({
                    orderBy: { createdAt: "desc" },
                    skip: offset,
                    take,
                    select: { id: true, itemId: true, claimantId: true, answers: true, verified: true, createdAt: true },
                });
                records = rows.map((row) => ({ id: row.id, data: row }));
                break;
            }
            case "matches": {
                const rows = await db.match.findMany({
                    orderBy: { createdAt: "desc" },
                    skip: offset,
                    take,
                    select: { id: true, lostItemId: true, foundItemId: true, score: true, status: true, createdAt: true },
                });
                records = rows.map((row) => ({ id: row.id, data: row }));
                break;
            }
            case "reports": {
                const rows = await db.aIComparisonReport.findMany({
                    orderBy: { createdAt: "desc" },
                    skip: offset,
                    take,
                    select: { id: true, lostItemId: true, foundItemId: true, status: true, score: true, confidenceLevel: true, reasoning: true, keyMatchingFeatures: true, discrepancies: true, createdAt: true, updatedAt: true },
                });
                records = rows.map((row) => ({ id: row.id, data: row }));
                break;
            }
            case "conversations": {
                const rows = await db.conversation.findMany({
                    orderBy: { updatedAt: "desc" },
                    skip: offset,
                    take,
                    select: { id: true, itemId: true, user1Id: true, user2Id: true, createdAt: true, updatedAt: true },
                });
                records = rows.map((row) => ({ id: row.id, data: row }));
                break;
            }
            case "messages": {
                const rows = await db.chatMessage.findMany({
                    orderBy: { createdAt: "desc" },
                    skip: offset,
                    take,
                    select: { id: true, conversationId: true, itemId: true, senderId: true, receiverId: true, content: true, read: true, createdAt: true },
                });
                records = rows.map((row) => ({ id: row.id, data: row }));
                break;
            }
        }

        return NextResponse.json({ records, hasMore: records.length === take });
    } catch (error) {
        console.error("GET /api/admin error:", error);
        return NextResponse.json({ error: "Failed to load admin data." }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const { response } = await requireAdmin();
    if (response) return response;

    try {
        const body: unknown = await request.json();
        if (!isRecord(body) || !isString(body.entity) || !isString(body.id) || !isRecord(body.data) || Object.keys(body.data).length === 0) {
            return NextResponse.json({ error: "entity, id, and data are required." }, { status: 400 });
        }
        const { entity, id, data } = body;
        if (!isString(entity) || !isEntity(entity)) {
            return NextResponse.json({ error: "Invalid entity." }, { status: 400 });
        }

        if (entity === "categories") {
            if (!hasOnlyKeys(data, ["category"]) || !isString(data.category) || !data.category.trim()) {
                return NextResponse.json({ error: "A non-empty category name is required." }, { status: 400 });
            }
            await db.item.updateMany({
                where: { category: id },
                data: { category: data.category.trim() },
            });
            return NextResponse.json({ success: true });
        }

        switch (entity) {
            case "users":
                if (!hasOnlyKeys(data, ["name", "email", "emailVerified", "image"]) ||
                    ("name" in data && (!isString(data.name) || !data.name.trim())) ||
                    ("email" in data && (!isString(data.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) ||
                    ("emailVerified" in data && !isBoolean(data.emailVerified)) ||
                    ("image" in data && !isNullableString(data.image))) {
                    return NextResponse.json({ error: "Invalid user fields." }, { status: 400 });
                }
                if (isString(data.email)) {
                    const currentUser = await db.user.findUnique({
                        where: { id },
                        select: { email: true },
                    });
                    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
                        .split(",")
                        .map((email) => email.trim().toLowerCase())
                        .filter(Boolean);
                    if (
                        currentUser &&
                        adminEmails.includes(currentUser.email.toLowerCase()) &&
                        !adminEmails.includes(data.email.trim().toLowerCase())
                    ) {
                        return NextResponse.json(
                            { error: "Update ADMIN_EMAILS before changing an administrator's email." },
                            { status: 400 },
                        );
                    }
                }
                await db.user.update({ where: { id }, data: {
                    ...(isString(data.name) ? { name: data.name.trim() } : {}),
                    ...(isString(data.email) ? { email: data.email.trim().toLowerCase() } : {}),
                    ...(isBoolean(data.emailVerified) ? { emailVerified: data.emailVerified } : {}),
                    ...(isNullableString(data.image) ? { image: data.image } : {}),
                } });
                break;
            case "items":
                if (!hasOnlyKeys(data, ["title", "category", "description", "photoUrl", "latitude", "longitude", "type", "status", "reportedBy"]) ||
                    ("title" in data && (!isString(data.title) || !data.title.trim())) ||
                    ("category" in data && (!isString(data.category) || !data.category.trim())) ||
                    ("description" in data && !isString(data.description)) ||
                    ("photoUrl" in data && !isNullableString(data.photoUrl)) ||
                    ("latitude" in data && !isNullableNumber(data.latitude)) ||
                    ("longitude" in data && !isNullableNumber(data.longitude)) ||
                    ("type" in data && !isOneOf(data.type, ["LOST", "FOUND"] as const)) ||
                    ("status" in data && !isOneOf(data.status, ["OPEN", "MATCHED", "CLAIMED", "RESOLVED"] as const)) ||
                    ("reportedBy" in data && !isString(data.reportedBy))) {
                    return NextResponse.json({ error: "Invalid item fields." }, { status: 400 });
                }
                await db.item.update({ where: { id }, data: {
                    ...(isString(data.title) ? { title: data.title.trim() } : {}),
                    ...(isString(data.category) ? { category: data.category.trim() } : {}),
                    ...(isString(data.description) ? { description: data.description } : {}),
                    ...(isNullableString(data.photoUrl) ? { photoUrl: data.photoUrl } : {}),
                    ...(isNullableNumber(data.latitude) ? { latitude: data.latitude } : {}),
                    ...(isNullableNumber(data.longitude) ? { longitude: data.longitude } : {}),
                    ...(isOneOf(data.type, ["LOST", "FOUND"] as const) ? { type: data.type } : {}),
                    ...(isOneOf(data.status, ["OPEN", "MATCHED", "CLAIMED", "RESOLVED"] as const) ? { status: data.status } : {}),
                    ...(isString(data.reportedBy) ? { reportedBy: data.reportedBy } : {}),
                } });
                break;
            case "claims":
                if (!hasOnlyKeys(data, ["itemId", "claimantId", "answers", "verified"]) ||
                    ("itemId" in data && !isString(data.itemId)) ||
                    ("claimantId" in data && !isString(data.claimantId)) ||
                    ("verified" in data && !isBoolean(data.verified)) ||
                    ("answers" in data && (!isJsonValue(data.answers) || data.answers === null))) {
                    return NextResponse.json({ error: "Invalid claim fields." }, { status: 400 });
                }
                await db.claim.update({ where: { id }, data: {
                    ...(isString(data.itemId) ? { itemId: data.itemId } : {}),
                    ...(isString(data.claimantId) ? { claimantId: data.claimantId } : {}),
                    ...("answers" in data ? { answers: data.answers as Prisma.InputJsonValue } : {}),
                    ...(isBoolean(data.verified) ? { verified: data.verified } : {}),
                } });
                break;
            case "matches":
                if (!hasOnlyKeys(data, ["lostItemId", "foundItemId", "score", "status"]) ||
                    ("lostItemId" in data && !isString(data.lostItemId)) ||
                    ("foundItemId" in data && !isString(data.foundItemId)) ||
                    ("score" in data && !isNumber(data.score)) ||
                    ("status" in data && !isOneOf(data.status, ["PENDING", "CONFIRMED", "REJECTED"] as const))) {
                    return NextResponse.json({ error: "Invalid match fields." }, { status: 400 });
                }
                await db.match.update({ where: { id }, data: {
                    ...(isString(data.lostItemId) ? { lostItemId: data.lostItemId } : {}),
                    ...(isString(data.foundItemId) ? { foundItemId: data.foundItemId } : {}),
                    ...(isNumber(data.score) ? { score: data.score } : {}),
                    ...(isOneOf(data.status, ["PENDING", "CONFIRMED", "REJECTED"] as const) ? { status: data.status } : {}),
                } });
                break;
            case "reports":
                if (!hasOnlyKeys(data, ["lostItemId", "foundItemId", "status", "score", "confidenceLevel", "reasoning", "keyMatchingFeatures", "discrepancies"]) ||
                    ("lostItemId" in data && !isString(data.lostItemId)) ||
                    ("foundItemId" in data && !isString(data.foundItemId)) ||
                    ("status" in data && !isOneOf(data.status, ["PENDING", "MATCH", "NO_MATCH", "FAILED"] as const)) ||
                    ("score" in data && !isNullableNumber(data.score)) ||
                    ("confidenceLevel" in data && !isNullableString(data.confidenceLevel)) ||
                    ("reasoning" in data && !isNullableString(data.reasoning)) ||
                    ("keyMatchingFeatures" in data && !isJsonValue(data.keyMatchingFeatures)) ||
                    ("discrepancies" in data && !isJsonValue(data.discrepancies))) {
                    return NextResponse.json({ error: "Invalid comparison report fields." }, { status: 400 });
                }
                await db.aIComparisonReport.update({ where: { id }, data: {
                    ...(isString(data.lostItemId) ? { lostItemId: data.lostItemId } : {}),
                    ...(isString(data.foundItemId) ? { foundItemId: data.foundItemId } : {}),
                    ...(isOneOf(data.status, ["PENDING", "MATCH", "NO_MATCH", "FAILED"] as const) ? { status: data.status } : {}),
                    ...(isNullableNumber(data.score) ? { score: data.score } : {}),
                    ...(isNullableString(data.confidenceLevel) ? { confidenceLevel: data.confidenceLevel } : {}),
                    ...(isNullableString(data.reasoning) ? { reasoning: data.reasoning } : {}),
                    ...("keyMatchingFeatures" in data ? { keyMatchingFeatures: jsonInput(data.keyMatchingFeatures) } : {}),
                    ...("discrepancies" in data ? { discrepancies: jsonInput(data.discrepancies) } : {}),
                } });
                break;
            case "conversations":
                if (!hasOnlyKeys(data, ["itemId", "user1Id", "user2Id"]) ||
                    ("itemId" in data && !isNullableString(data.itemId)) ||
                    ("user1Id" in data && !isString(data.user1Id)) ||
                    ("user2Id" in data && !isString(data.user2Id))) {
                    return NextResponse.json({ error: "Invalid conversation fields." }, { status: 400 });
                }
                await db.conversation.update({ where: { id }, data: {
                    ...(isNullableString(data.itemId) ? { itemId: data.itemId } : {}),
                    ...(isString(data.user1Id) ? { user1Id: data.user1Id } : {}),
                    ...(isString(data.user2Id) ? { user2Id: data.user2Id } : {}),
                } });
                break;
            case "messages":
                if (!hasOnlyKeys(data, ["conversationId", "itemId", "senderId", "receiverId", "content", "read"]) ||
                    ("conversationId" in data && !isString(data.conversationId)) ||
                    ("itemId" in data && !isString(data.itemId)) ||
                    ("senderId" in data && !isString(data.senderId)) ||
                    ("receiverId" in data && !isString(data.receiverId)) ||
                    ("content" in data && !isNullableString(data.content)) ||
                    ("read" in data && !isBoolean(data.read))) {
                    return NextResponse.json({ error: "Invalid message fields." }, { status: 400 });
                }
                await db.chatMessage.update({ where: { id }, data: {
                    ...(isString(data.conversationId) ? { conversationId: data.conversationId } : {}),
                    ...(isString(data.itemId) ? { itemId: data.itemId } : {}),
                    ...(isString(data.senderId) ? { senderId: data.senderId } : {}),
                    ...(isString(data.receiverId) ? { receiverId: data.receiverId } : {}),
                    ...(isNullableString(data.content) ? { content: data.content } : {}),
                    ...(isBoolean(data.read) ? { read: data.read } : {}),
                } });
                break;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH /api/admin error:", error);
        return NextResponse.json({ error: "Failed to update record." }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { user, response } = await requireAdmin();
    if (response) return response;

    try {
        const body: unknown = await request.json();
        if (!isRecord(body) || !isString(body.entity) || !isString(body.id) || !isEntity(body.entity)) {
            return NextResponse.json({ error: "A valid entity and id are required." }, { status: 400 });
        }
        const { entity, id } = body;
        if (!isString(entity) || !isEntity(entity)) {
            return NextResponse.json({ error: "Invalid entity." }, { status: 400 });
        }

        if (entity === "categories") {
            const replacementCategory = body.replacementCategory;
            if (!isString(replacementCategory) || !replacementCategory.trim() || replacementCategory.trim() === id) {
                return NextResponse.json({ error: "Choose a different replacement category." }, { status: 400 });
            }
            await db.item.updateMany({
                where: { category: id },
                data: { category: replacementCategory.trim() },
            });
            return NextResponse.json({ success: true });
        }

        switch (entity) {
            case "users": {
                const result = await deleteUser(id, user.id);
                return result;
            }
            case "items":
                await db.$transaction(async (tx) => {
                    await tx.match.deleteMany({
                        where: { OR: [{ lostItemId: id }, { foundItemId: id }] },
                    });
                    await tx.item.delete({ where: { id } });
                });
                break;
            case "claims":
                await db.claim.delete({ where: { id } });
                break;
            case "matches":
                await db.match.delete({ where: { id } });
                break;
            case "reports":
                await db.aIComparisonReport.delete({ where: { id } });
                break;
            case "conversations":
                await db.conversation.delete({ where: { id } });
                break;
            case "messages":
                await db.chatMessage.delete({ where: { id } });
                break;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/admin error:", error);
        return NextResponse.json({ error: "Failed to delete record." }, { status: 500 });
    }
}
