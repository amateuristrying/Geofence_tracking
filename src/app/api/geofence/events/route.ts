import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const zoneId = searchParams.get('zoneId');
        const hours = parseInt(searchParams.get('hours') || '24');

        if (!zoneId) {
            return NextResponse.json({ error: 'Missing zoneId' }, { status: 400 });
        }

        const dateLimit = new Date();
        dateLimit.setHours(dateLimit.getHours() - hours);

        const { data, error } = await supabase
            .from('geofence_events')
            .select('*')
            .eq('geofence_id', zoneId)
            .gt('timestamp', dateLimit.toISOString())
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ events: data });
    } catch (error: any) {
        console.error('Error fetching geofence events:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
