import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import {
  createBrowserClient,
  createServerClient as createSSRClient,
} from '@supabase/ssr';

import { getClientEnv, getServerEnv } from './env';
import type { Database } from '../types/database';

const createAdminClient = () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const createServerSupabase = () => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getServerEnv();
  const cookieStore = cookies();
  const headerStore = headers();

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
    headers: {
      get(name) {
        return headerStore.get(name) ?? undefined;
      },
    },
  });
};

export const createBrowserSupabase = () => {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getClientEnv();

  return createBrowserClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
};

export const supabaseAdmin = createAdminClient();
