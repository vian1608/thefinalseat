import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment variables.');
}

// Backend client uses the secret key — never expose this to the browser
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function testSupabaseConnection() {
  try {
    const { error } = await supabase.from('bookings').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table not found (acceptable if migration not run yet)
      console.error('❌ Supabase connection error:', error.message);
      return false;
    }
    console.log('✅ Supabase connection established successfully.');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
    return false;
  }
}

export default supabase;
