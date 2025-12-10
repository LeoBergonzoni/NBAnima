"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrowserSupabase = void 0;
const ssr_1 = require("@supabase/ssr");
const env_1 = require("./env");
const createBrowserSupabase = () => {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = (0, env_1.getClientEnv)();
    return (0, ssr_1.createBrowserClient)(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
};
exports.createBrowserSupabase = createBrowserSupabase;
