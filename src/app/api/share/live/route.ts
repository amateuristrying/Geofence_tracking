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
        const trackers = await NavixyService.listTrackers(sessionKey);

        if (trackers.length > 0 && process.env.NODE_ENV === 'development') {
            console.log('[ShareLive] Tracker Sample Structure:', JSON.stringify(trackers[0]).substring(0, 500));
        }

        // 3. Filter trackers inside the geofence
        const insideTrackers = trackers.filter((t: any) => {
            // Robust location parsing
            const gps = t.gps || t.last_position || {};
            const loc = gps.location || gps;
            const lat = loc.lat;
            const lng = loc.lng;

            if (!lat || !lng) return false;

            try {
                const point = turf.point([Number(lng), Number(lat)]);
                if (zone.type === 'circle' && zone.center && zone.radius) {
                    const distance = turf.distance(
                        point,
                        turf.point([Number(zone.center.lng), Number(zone.center.lat)]),
                        { units: 'meters' }
                    );
                    return distance <= zone.radius;
                } else if ((zone.type === 'polygon' || zone.type === 'zone') && zone.points && zone.points.length >= 3) {
                    const coords = zone.points.map((p: any) => [Number(p.lng), Number(lat === undefined ? p.lat : p.lat)]);
                    // Note: Ensure we use the correct lat/lng from points
                    const polyCoords = zone.points.map((p: any) => [Number(p.lng), Number(p.lat)]);
                    polyCoords.push(polyCoords[0]);
                    const poly = turf.polygon([polyCoords]);
                    return turf.booleanPointInPolygon(point, poly);
                } else if (zone.type === 'sausage' && zone.points && zone.points.length >= 2 && zone.radius) {
                    const lineCoords = zone.points.map((p: any) => [Number(p.lng), Number(p.lat)]);
                    const line = turf.lineString(lineCoords);
                    const distance = turf.pointToLineDistance(point, line, { units: 'meters' });
                    return distance <= zone.radius;
                }
            } catch (e) {
                return false;
            }
            return false;
        });

        // 4. Transform for the premium client
        const states = insideTrackers.map((t: any) => {
            const gps = t.gps || t.last_position || {};
            const loc = gps.location || gps;

            return {
                id: t.id || t.source_id,
                label: t.label || `Vehicle #${t.id}`,
                lat: Number(loc.lat),
                lng: Number(loc.lng),
                speed: Number(gps.speed || 0),
                heading: Number(gps.heading || 0),
                last_update: gps.updated || t.last_update,
                status: t.movement_status || (Number(gps.speed) > 0 ? 'moving' : 'parked'),
                ignition: t.ignition ?? gps.ignition
            };
        });

        return NextResponse.json({ trackers: states });
    } catch (error: any) {
        console.error('Error in /api/share/live:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
