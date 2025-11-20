'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createBrowserSupabase } from './supabase-browser';
import type { Database } from './supabase.types';

const supabaseClient: SupabaseClient<Database> = createBrowserSupabase();

export default supabaseClient;
export { supabaseClient };
