import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } },
) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    };

    const { status } = await req.json();

    const updatedMatch = await db.match.update({
        where: { id: params.id},
        data: { status },
    });
    return NextResponse.json(updatedMatch);
}