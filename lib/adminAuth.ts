import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return {
            user: null,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

    if (!session.user.email || !adminEmails.includes(session.user.email.toLowerCase())) {
        return {
            user: null,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
    }

    return { user: session.user, response: null };
}
