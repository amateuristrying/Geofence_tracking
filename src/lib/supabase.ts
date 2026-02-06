import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
    get(target, prop, receiver) {
        if (!_supabase) {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            if (!url || !key) {
                // Silently return a dummy proxy or throw informative error if called at runtime
                throw new Error('Supabase URL and Key are required for this action.');
            }
            _supabase = createClient(url, key);
        }
        return Reflect.get(_supabase, prop, receiver);
    },
});
