"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthProvider = AuthProvider;
const jsx_runtime_1 = require("react/jsx-runtime");
const auth_helpers_nextjs_1 = require("@supabase/auth-helpers-nextjs");
const auth_helpers_react_1 = require("@supabase/auth-helpers-react");
const react_1 = require("react");
function AuthProvider({ children }) {
    const [supabase] = (0, react_1.useState)(() => (0, auth_helpers_nextjs_1.createClientComponentClient)());
    return ((0, jsx_runtime_1.jsx)(auth_helpers_react_1.SessionContextProvider, { supabaseClient: supabase, children: children }));
}
