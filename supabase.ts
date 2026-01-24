/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing in .env file. Falling back to provided values.');
}

export const supabase = createClient(
    supabaseUrl || 'https://zgteuwwhiwfglrvjcekq.supabase.co',
    supabaseAnonKey || 'sb_publishable_ths2W9m7xVW9GB-t-MxYhg_Nm0kTJmA'
);
