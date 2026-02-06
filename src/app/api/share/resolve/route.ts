import { NextRequest, NextResponse } from 'next/server';
import { resolveShareToken } from '@/lib/share-utils';
import { NavixyService } from '@/services/navixy';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        const share = await resolveShareToken(token);
        if (!share) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
        }

        const sessionKey = share.region === 'TZ'
            ? (process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_TZ || process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY)
            : process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_ZM;

        if (!sessionKey) {
            return NextResponse.json({ error: 'System configuration error' }, { status: 500 });
        }

        // Fetch all zones to find the specific one
        // In a real production app, we might want to fetch just one if Navixy supports it by ID
        const zones = await NavixyService.listZones(sessionKey);
        const zone = zones.find((z: any) => z.id === share.navixy_zone_id);

        if (!zone) {
            return NextResponse.json({ error: 'Geofence not found in telematics system' }, { status: 404 });
        }

        // Fetch all trackers to get the IDs (or we can just fetch the status for all then filter)
        // For the shared view, we need the list of trackers to monitor.
        // Actually, the geofence doesn't "know" which trackers are inside until we check positions.
        // So we need to fetch all trackers for that session.
        const allTrackers = await NavixyService.listTrackers(sessionKey);
        const trackerIds = allTrackers.map((t: any) => t.source?.id || t.id);

        return NextResponse.json({
            zone: {
                id: zone.id,
                name: zone.label,
                type: zone.type,
                color: zone.color,
                points: zone.points,
                center: zone.center,
                radius: zone.radius,
            },
            region: share.region,
            trackerIds
        });
    } catch (error: any) {
        console.error('Error in /api/share/resolve:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
