import { createClient } from '@supabase/supabase-js';

const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl =
  envSupabaseUrl?.startsWith('http') ? envSupabaseUrl : 'https://example.supabase.co';
const supabaseAnonKey =
  envSupabaseAnonKey && envSupabaseAnonKey !== 'your_supabase_anon_key'
    ? envSupabaseAnonKey
    : 'anon-placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

