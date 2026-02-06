import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { resolveShareToken } from '@/lib/share-utils';
import { NavixyService } from '@/services/navixy';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');
        console.log(`[API] Resolving share token: ${token}`);

        if (!token) {
            return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
        }

        const share = await resolveShareToken(token);
        if (!share) {
            return NextResponse.json({ error: 'This share link does not exist or has expired.' }, { status: 404 });
        }

        // PREFER CACHED METADATA FROM DB
        if (share.zone_data) {
            const sessionKey = share.region === 'TZ'
                ? (process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_TZ || process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY)
                : process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_ZM;

            // Fetch tracker IDs for live polling later
            let trackerIds: number[] = [];
            if (sessionKey) {
                try {
                    const allTrackers = await NavixyService.listTrackers(sessionKey);
                    trackerIds = allTrackers.map((t: any) => t.source?.id || t.id);
                } catch (e) {
                    console.error('Failed to pre-fetch trackers for shared view:', e);
                }
            }

            return NextResponse.json({
                zone: share.zone_data,
                region: share.region,
                trackerIds
            });
        }

        // FALLBACK: OLD LOGIC (Fetch from Navixy)
        const sessionKey = share.region === 'TZ'
            ? (process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_TZ || process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY)
            : process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_ZM;
    } catch (error: any) {
        console.error('Error in /api/share/resolve:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
