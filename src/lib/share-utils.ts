import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabase-server';

export interface GeofenceShare {
    id: string;
    navixy_zone_id: number;
    share_token: string;
    region: 'TZ' | 'ZM';
}

export async function getOrCreateShareToken(navixyZoneId: number, region: 'TZ' | 'ZM'): Promise<string> {
    const { data: existing } = await supabase
        .from('geofence_shares')
        .select('share_token')
        .eq('navixy_zone_id', navixyZoneId)
        .eq('region', region)
        .single();

    if (existing) {
        return existing.share_token;
    }

    const shareToken = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    // Use admin client for write
    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
        .from('geofence_shares')
        .insert({
            navixy_zone_id: navixyZoneId,
            share_token: shareToken,
            region: region
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating share token:', error);
        throw new Error('Failed to create share token');
    }

    return data.share_token;
}

export async function resolveShareToken(token: string): Promise<GeofenceShare | null> {
    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
        .from('geofence_shares')
        .select('*')
        .eq('share_token', token)
        .single();

    if (error || !data) {
        console.error('Resolve token error:', error);
        return null;
    }

    return data;
}
