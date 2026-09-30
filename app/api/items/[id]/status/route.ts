// app/api/items/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const itemId = resolvedParams.id;
    // const itemId =  params.id;
    const body = await req.json();
    const { status } = body;

    if (!["OPEN", "RESOLVED", "CLAIMED", "MATCHED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const item = await db.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Only allow item reporter or participants to change state
    const updatedItem = await db.item.update({
      where: { id: itemId },
      data: { status },
    });

    return NextResponse.json({ item: updatedItem }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/items/[id]/status error:", error);
    return NextResponse.json({ error: "Failed to update item status" }, { status: 500 });
  }
}