import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient as createSSRClient } from '@supabase/ssr';

import { getServerEnv } from './env';
import type { Database } from './supabase.types';

export const createAdminSupabaseClient = (): SupabaseClient<Database> => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const createServerSupabase = async (): Promise<SupabaseClient<Database>> => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getServerEnv();
  const cookieStore = await cookies();

  return createSSRClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.delete({ name, ...options });
      },
    },
  });
};

export const supabaseAdmin = createAdminSupabaseClient();
