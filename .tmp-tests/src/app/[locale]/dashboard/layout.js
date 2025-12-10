"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = exports.runtime = void 0;
exports.default = DashboardLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const AuthProvider_1 = require("../../../components/auth/AuthProvider");
const dashboard_mobile_nav_1 = require("../../../components/dashboard/dashboard-mobile-nav");
const supabase_1 = require("../../../lib/supabase");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
async function DashboardLayout({ children, params, }) {
    const { locale: rawLocale } = await params;
    const locale = rawLocale;
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        (0, navigation_1.redirect)(`/${locale}/login`);
    }
    return ((0, jsx_runtime_1.jsx)(AuthProvider_1.AuthProvider, { children: (0, jsx_runtime_1.jsxs)("div", { className: "relative pb-24 sm:pb-0", children: [children, (0, jsx_runtime_1.jsx)(dashboard_mobile_nav_1.DashboardMobileNav, { locale: locale })] }) }));
}
