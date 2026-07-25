import { createClient } from '@supabase/supabase-js';
import env from './env.mjs';

const url = env.supabaseUrl || 'https://placeholder.supabase.co';
const key = env.supabaseSecretKey || 'placeholder-key';

if (!env.supabaseUrl || !env.supabaseSecretKey) {
  console.warn('⚠️ Supabase environment variables missing! Using safe stub client for tests/offline execution.');
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: false
  }
});

// Ping test helper
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('bookings').select('id').limit(1);
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
    return false;
  }
}

export default supabase;
