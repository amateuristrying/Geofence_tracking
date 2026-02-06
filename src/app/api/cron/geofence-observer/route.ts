import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { NavixyService } from '@/services/navixy';
import * as turf from '@turf/turf';

// This is the "Heartbeat" of the system.
// It should be called every 1-5 minutes by a Cron Job.
export async function GET(req: NextRequest) {
    // Basic security: Check for Cron Secret if configured
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // Commenting out for local testing if needed, but recommended for production
    }

    const admin = getSupabaseAdmin();
    const regions = ['TZ', 'ZM'] as const;
    const results: any[] = [];

    for (const region of regions) {
        try {
            const sessionKey = region === 'TZ'
                ? (process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_TZ || process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY)
                : process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_ZM;

            if (!sessionKey) continue;

            console.log(`[Observer] Processing region: ${region}`);

            // 1. Fetch live trackers and zones
            const [trackers, navixyZones] = await Promise.all([
                NavixyService.listTrackers(sessionKey),
                NavixyService.listZones(sessionKey)
            ]);

            // 2. Fetch current stored state from DB
            const { data: storedStates } = await admin
                .from('geofence_vehicle_state')
                .select('*');

            // Map for quick lookup: "geofenceId-vehicleId" -> is_inside
            const stateMap = new Map<string, boolean>();
            storedStates?.forEach(s => {
                stateMap.set(`${s.geofence_id}-${s.vehicle_id}`, s.is_inside);
            });

            const newEvents: any[] = [];
            const stateUpdates: any[] = [];

            // 3. Process every Zone-Vehicle combination
            for (const zone of navixyZones) {
                for (const tracker of trackers) {
                    const vehicleId = tracker.source?.id || tracker.id;
                    const lat = tracker.gps?.location?.lat || tracker.last_position?.lat;
                    const lng = tracker.gps?.location?.lng || tracker.last_position?.lng;

                    if (!lat || !lng) continue;

                    let currentlyInside = false;

                    try {
                        if (zone.type === 'circle' && zone.center && zone.radius) {
                            const distance = turf.distance(
                                turf.point([lng, lat]),
                                turf.point([zone.center.lng, zone.center.lat]),
                                { units: 'meters' }
                            );
                            currentlyInside = distance <= zone.radius;
                        } else if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
                            const coords = zone.points.map((p: any) => [p.lng, p.lat]);
                            coords.push(coords[0]);
                            const poly = turf.polygon([coords]);
                            currentlyInside = turf.booleanPointInPolygon(turf.point([lng, lat]), poly);
                        } else if (zone.type === 'sausage' && zone.points && zone.points.length >= 2 && zone.radius) {
                            const coords = zone.points.map((p: any) => [p.lng, p.lat]);
                            const line = turf.lineString(coords);
                            const distance = turf.pointToLineDistance(turf.point([lng, lat]), line, { units: 'meters' });
                            currentlyInside = distance <= zone.radius;
                        }
                    } catch (e) {
                        continue;
                    }

                    const stateKey = `${zone.id}-${vehicleId}`;
                    const previouslyInside = stateMap.has(stateKey) ? stateMap.get(stateKey) : false;

                    // 4. Detect Transitions
                    if (currentlyInside && !previouslyInside) {
                        // ENTRY detected
                        newEvents.push({
                            vehicle_id: vehicleId,
                            geofence_id: zone.id,
                            event_type: 'ENTRY',
                        });
                        stateUpdates.push({ vehicle_id: vehicleId, geofence_id: zone.id, is_inside: true, last_updated: new Date().toISOString() });
                    } else if (!currentlyInside && previouslyInside) {
                        // EXIT detected
                        newEvents.push({
                            vehicle_id: vehicleId,
                            geofence_id: zone.id,
                            event_type: 'EXIT',
                        });
                        stateUpdates.push({ vehicle_id: vehicleId, geofence_id: zone.id, is_inside: false, last_updated: new Date().toISOString() });
                    } else if (!stateMap.has(stateKey) && !currentlyInside) {
                        // First time seeing this pair, and it's outside. 
                        // Initialize to false to avoid false ENTRY logs later.
                        stateUpdates.push({ vehicle_id: vehicleId, geofence_id: zone.id, is_inside: false, last_updated: new Date().toISOString() });
                    }
                }
            }

            // 5. Bulk updates to Supabase
            if (newEvents.length > 0) {
                await admin.from('geofence_events').insert(newEvents);
                console.log(`[Observer] Logged ${newEvents.length} new transition events.`);
            }

            if (stateUpdates.length > 0) {
                // Upsert current states (match on PK vehicle_id, geofence_id)
                await admin.from('geofence_vehicle_state').upsert(stateUpdates, { onConflict: 'vehicle_id,geofence_id' });
            }

            results.push({ region, processed: trackers.length, events: newEvents.length });

        } catch (error: any) {
            console.error(`[Observer] Error in region ${region}:`, error);
            results.push({ region, error: error.message });
        }
    }

    return NextResponse.json({ success: true, results });
}
