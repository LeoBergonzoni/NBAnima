"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.createServerSupabase = exports.createAdminSupabaseClient = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const headers_1 = require("next/headers");
const ssr_1 = require("@supabase/ssr");
const env_1 = require("./env");
const createAdminSupabaseClient = () => {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = (0, env_1.getServerEnv)();
    return (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
};
exports.createAdminSupabaseClient = createAdminSupabaseClient;
const createServerSupabase = async () => {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = (0, env_1.getServerEnv)();
    const cookieStore = await (0, headers_1.cookies)();
    return (0, ssr_1.createServerClient)(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: {
            get(name) {
                return cookieStore.get(name)?.value;
            },
            set(name, value, options) {
                try {
                    cookieStore.set({ name, value, ...options });
                }
                catch (error) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn('[supabase] cookies.set skipped', error);
                    }
                }
            },
            remove(name, options) {
                try {
                    cookieStore.delete({ name, ...options });
                }
                catch (error) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn('[supabase] cookies.delete skipped', error);
                    }
                }
            },
        },
    });
};
exports.createServerSupabase = createServerSupabase;
exports.supabaseAdmin = (0, exports.createAdminSupabaseClient)();
