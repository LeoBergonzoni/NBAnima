"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseClient = void 0;
const supabase_browser_1 = require("./supabase-browser");
const supabaseClient = (0, supabase_browser_1.createBrowserSupabase)();
exports.supabaseClient = supabaseClient;
exports.default = supabaseClient;
