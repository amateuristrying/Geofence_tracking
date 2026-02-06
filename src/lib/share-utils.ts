import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabase-server';

export interface GeofenceShare {
    id: string;
    navixy_zone_id: number;
    share_token: string;
    region: 'TZ' | 'ZM';
}

export async function getOrCreateShareToken(navixyZoneId: number, region: 'TZ' | 'ZM'): Promise<string> {
    const adminSupabase = getSupabaseAdmin();

    console.log(`[ShareUtils] getOrCreateShareToken for zone ${navixyZoneId} (${region})`);

    const { data: existing, error: fetchError } = await adminSupabase
        .from('geofence_shares')
        .select('share_token')
        .eq('navixy_zone_id', navixyZoneId)
        .eq('region', region)
        .maybeSingle();

    if (existing) {
        console.log(`[ShareUtils] Found existing token: ${existing.share_token}`);
        return existing.share_token;
    }

    if (fetchError) {
        console.error('[ShareUtils] Error checking for existing token:', fetchError);
    }

    const shareToken = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    console.log(`[ShareUtils] Generating new token: ${shareToken}`);

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
        console.error('[ShareUtils] Error creating share token in DB:', error);
        throw new Error('Failed to create share token in database');
    }

    console.log('[ShareUtils] Successfully created and saved token');
    return data.share_token;
}

export async function resolveShareToken(token: string): Promise<GeofenceShare | null> {
    const adminSupabase = getSupabaseAdmin();

    console.log(`[ShareUtils] resolveShareToken attempt: ${token}`);

    const { data, error } = await adminSupabase
        .from('geofence_shares')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();

    if (error) {
        console.error(`[ShareUtils] Database error resolving token ${token}:`, error);
        return null;
    }

    if (!data) {
        console.warn(`[ShareUtils] Token ${token} not found in geofence_shares table`);
        return null;
    }

    console.log(`[ShareUtils] Token resolved to zone ${data.navixy_zone_id}`);
    return data;
}
