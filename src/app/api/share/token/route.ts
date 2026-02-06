import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getOrCreateShareToken } from '@/lib/share-utils';

export async function POST(req: NextRequest) {
    try {
        const { zoneId, region } = await req.json();

        if (!zoneId || !region) {
            return NextResponse.json({ error: 'Missing zoneId or region' }, { status: 400 });
        }

        const token = await getOrCreateShareToken(Number(zoneId), region);
        return NextResponse.json({ token });
    } catch (error: any) {
        console.error('Error in /api/share/token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
