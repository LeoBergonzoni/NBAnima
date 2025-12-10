"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UserPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const user_profile_client_1 = require("../../../components/user/user-profile-client");
const constants_1 = require("../../../lib/constants");
const dashboard_mobile_nav_1 = require("../../../components/dashboard/dashboard-mobile-nav");
const ensureUserProfile_1 = require("../../../lib/server/ensureUserProfile");
const supabase_1 = require("../../../lib/supabase");
async function UserPage({ params, }) {
    const { locale: rawLocale } = await params;
    const locale = constants_1.SUPPORTED_LOCALES.includes(rawLocale) ? rawLocale : undefined;
    if (!locale) {
        (0, navigation_1.notFound)();
    }
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        (0, navigation_1.redirect)(`/${locale}/login`);
    }
    let profile = null;
    try {
        profile = await (0, ensureUserProfile_1.ensureUserProfile)(user.id, user.email);
    }
    catch (error) {
        console.error('[user] failed to load profile', error);
        (0, navigation_1.redirect)(`/${locale}/login`);
    }
    if (!profile) {
        (0, navigation_1.redirect)(`/${locale}/login`);
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "relative pb-24 sm:pb-0", children: [(0, jsx_runtime_1.jsx)(user_profile_client_1.UserProfileClient, { userId: user.id, email: user.email ?? '', fullName: profile.full_name, avatarUrl: profile.avatar_url ?? null, locale: locale }), (0, jsx_runtime_1.jsx)(dashboard_mobile_nav_1.DashboardMobileNav, { locale: locale })] }));
}
