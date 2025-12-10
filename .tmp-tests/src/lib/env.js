"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientEnv = exports.getServerEnv = void 0;
const zod_1 = require("zod");
const constants_1 = require("./constants");
const serverSchema = zod_1.z.object({
    SUPABASE_URL: zod_1.z.string().url(),
    SUPABASE_ANON_KEY: zod_1.z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().min(1),
    NB_API_PROVIDER: zod_1.z
        .enum([constants_1.API_PROVIDER.BALDONTLIE, constants_1.API_PROVIDER.SPORTSDATAIO])
        .default(constants_1.API_PROVIDER.BALDONTLIE),
    BALLDONTLIE_API_KEY: zod_1.z.string().optional(),
    SPORTSDATAIO_API_KEY: zod_1.z.string().optional(),
});
const clientSchema = zod_1.z.object({
    NEXT_PUBLIC_SUPABASE_URL: zod_1.z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: zod_1.z.string().min(1),
});
let cachedServerEnv = null;
const getServerEnv = () => {
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
        throw new Error(`Invalid server environment configuration: ${parsed.error.message}`);
    }
    cachedServerEnv = parsed.data;
    return parsed.data;
};
exports.getServerEnv = getServerEnv;
let cachedClientEnv = null;
const getClientEnv = () => {
    if (cachedClientEnv) {
        return cachedClientEnv;
    }
    const parsed = clientSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    if (!parsed.success) {
        throw new Error(`Invalid client environment configuration: ${parsed.error.message}`);
    }
    cachedClientEnv = parsed.data;
    return parsed.data;
};
exports.getClientEnv = getClientEnv;
