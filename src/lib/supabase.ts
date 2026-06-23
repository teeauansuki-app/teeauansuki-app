import { createClient } from '@supabase/supabase-js';

const getValidSupabaseUrl = (url: string | undefined): string => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url;
  }
  return 'https://placeholder.supabase.co';
};

const getValidSupabaseKey = (key: string | undefined): string => {
  if (key && key !== 'your_supabase_anon_key_here' && key !== 'your_supabase_service_role_key_here') {
    return key;
  }
  return 'placeholder-key';
};

const supabaseUrl = getValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = getValidSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Flag to check if we have real credentials or placeholders
export const isSupabaseConfigured = 
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http') && 
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your_supabase_url');

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables are missing or placeholders. Please configure them in your .env.local file.'
  );
}

// Client for public/anon access (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for administrative access (bypassing RLS) - ONLY use on Server Side
export const getSupabaseAdmin = () => {
  const supabaseServiceKey = getValidSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
