import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabase-server';

export interface GeofenceShare {
    id: string;
    navixy_zone_id: number;
    share_token: string;
    region: 'TZ' | 'ZM';
    zone_data?: {
        name: string;
        color: string;
        type: string;
        points?: any[];
        center?: any;
        radius?: number;
    };
}

export async function getOrCreateShareToken(
    navixyZoneId: number,
    region: 'TZ' | 'ZM',
    metadata?: any
): Promise<string> {
    const adminSupabase = getSupabaseAdmin();

    console.log(`[ShareUtils] getOrCreateShareToken for zone ${navixyZoneId} (${region})`);

    const { data: existing, error: fetchError } = await adminSupabase
        .from('geofence_shares')
        .select('share_token')
        .eq('navixy_zone_id', navixyZoneId)
        .eq('region', region)
        .maybeSingle();

    if (existing) {
        // If we have new metadata, update it even if token exists
        if (metadata) {
            await adminSupabase
                .from('geofence_shares')
                .update({ zone_data: metadata })
                .eq('share_token', existing.share_token);
        }
        return existing.share_token;
    }

    const shareToken = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    const { data, error } = await adminSupabase
        .from('geofence_shares')
        .insert({
            navixy_zone_id: navixyZoneId,
            share_token: shareToken,
            region: region,
            zone_data: metadata
        })
        .select()
        .single();

    if (error) {
        console.error('[ShareUtils] Error creating share token in DB:', error);
        throw new Error('Failed to create share token in database');
    }

    return data.share_token;
}

export async function resolveShareToken(token: string): Promise<GeofenceShare | null> {
    const adminSupabase = getSupabaseAdmin();

    const { data, error } = await adminSupabase
        .from('geofence_shares')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();

    if (error || !data) return null;
    return data;
}
