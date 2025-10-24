import { z } from 'zod';

import { API_PROVIDER } from './constants';

const serverSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NB_API_PROVIDER: z
    .enum([API_PROVIDER.BALDONTLIE, API_PROVIDER.SPORTSDATAIO])
    .default(API_PROVIDER.BALDONTLIE),
  BALLDONTLIE_API_KEY: z.string().optional(),
  SPORTSDATAIO_API_KEY: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export const getServerEnv = () => {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }
  const parsed = serverSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NB_API_PROVIDER: process.env.NB_API_PROVIDER,
    BALLDONTLIE_API_KEY: process.env.BALLDONTLIE_API_KEY,
    SPORTSDATAIO_API_KEY: process.env.SPORTSDATAIO_API_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration: ${parsed.error.message}`,
    );
  }

  cachedServerEnv = parsed.data;
  return parsed.data;
};

let cachedClientEnv: z.infer<typeof clientSchema> | null = null;

export const getClientEnv = () => {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid client environment configuration: ${parsed.error.message}`,
    );
  }

  cachedClientEnv = parsed.data;
  return parsed.data;
};
