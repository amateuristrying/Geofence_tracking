import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { resolveShareToken } from '@/lib/share-utils';
import { NavixyService } from '@/services/navixy';
import * as turf from '@turf/turf';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        const share = await resolveShareToken(token);
        if (!share) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
        }

        const sessionKey = share.region === 'TZ'
            ? (process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_TZ || process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY)
            : process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_ZM;

        if (!sessionKey) return NextResponse.json({ error: 'Config error' }, { status: 500 });

        // 1. Fetch Geofence to get its geometry
        const zones = await NavixyService.listZones(sessionKey);
        const zone = zones.find((z: any) => z.id === share.navixy_zone_id);
        if (!zone) return NextResponse.json({ error: 'Zone not found' }, { status: 404 });

        // 2. Fetch all tracker positions
        // Navixy list trackers usually includes last positions or we can use tracker/list
        const trackers = await NavixyService.listTrackers(sessionKey);

        // 3. Filter trackers inside the geofence
        const insideTrackers = trackers.filter((t: any) => {
            const lat = t.gps?.location?.lat || t.last_position?.lat;
            const lng = t.gps?.location?.lng || t.last_position?.lng;
            if (!lat || !lng) return false;

            try {
                if (zone.type === 'circle' && zone.center && zone.radius) {
                    const distance = turf.distance(
                        turf.point([lng, lat]),
                        turf.point([zone.center.lng, zone.center.lat]),
                        { units: 'meters' }
                    );
                    return distance <= zone.radius;
                } else if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
                    const coords = zone.points.map((p: any) => [p.lng, p.lat]);
                    coords.push(coords[0]);
                    const poly = turf.polygon([coords]);
                    return turf.booleanPointInPolygon(turf.point([lng, lat]), poly);
                } else if (zone.type === 'sausage' && zone.points && zone.points.length >= 2 && zone.radius) {
                    const coords = zone.points.map((p: any) => [p.lng, p.lat]);
                    const line = turf.lineString(coords);
                    const distance = turf.pointToLineDistance(turf.point([lng, lat]), line, { units: 'meters' });
                    return distance <= zone.radius;
                }
            } catch (e) {
                return false;
            }
            return false;
        });

        // 4. Transform to a simplified state object for the client
        const states = insideTrackers.map((t: any) => ({
            id: t.source?.id || t.id,
            label: t.label,
            lat: t.gps?.location?.lat || t.last_position?.lat,
            lng: t.gps?.location?.lng || t.last_position?.lng,
            speed: t.gps?.speed || t.last_position?.speed || 0,
            heading: t.gps?.heading || t.last_position?.heading || 0,
            last_update: t.last_update || t.gps?.updated,
            status: t.movement_status || (t.gps?.speed > 0 ? 'moving' : 'parked'), // Basic inference
            ignition: t.ignition
        }));

        return NextResponse.json({ trackers: states });
    } catch (error: any) {
        console.error('Error in /api/share/live:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
