import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

function getEnvValue(name: string) {
  const rawValue = process.env[name]?.trim() ?? '';
  const withoutKeyPrefix = rawValue.startsWith(`${name}=`)
    ? rawValue.slice(name.length + 1).trim()
    : rawValue;

  return withoutKeyPrefix.replace(/^["']|["']$/g, '').trim();
}

const supabaseUrl = getEnvValue('SUPABASE_URL');
const supabaseKey = getEnvValue('SUPABASE_SERVICE_KEY');

export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  supabaseUrl.includes('.supabase.co') &&
  Boolean(supabaseKey);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://example.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'service-key-placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: WebSocket as never,
    },
  }
);
