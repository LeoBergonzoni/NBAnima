'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';

import type { Database } from '@/lib/supabase.types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() =>
    createClientComponentClient<Database>(),
  );

  return (
    <SessionContextProvider
      supabaseClient={supabase as unknown as SupabaseClient}
    >
      {children}
    </SessionContextProvider>
  );
}
