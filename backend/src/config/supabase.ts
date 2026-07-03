import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const isSupabaseConfigured =
  Boolean(supabaseUrl?.startsWith('http')) && Boolean(supabaseKey);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://example.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'service-key-placeholder'
);
