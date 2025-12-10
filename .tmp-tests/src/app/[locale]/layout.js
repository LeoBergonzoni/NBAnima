"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LocaleLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
const image_1 = __importDefault(require("next/image"));
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const language_toggle_1 = require("../../components/language-toggle");
const locale_sync_1 = require("../../components/locale-sync");
const locale_provider_1 = require("../../components/providers/locale-provider");
const user_nav_button_1 = require("../../components/user-nav-button");
const constants_1 = require("../../lib/constants");
const dictionaries_1 = require("../../locales/dictionaries");
const supabase_1 = require("../../lib/supabase");
const ensureUserProfile_1 = require("../../lib/server/ensureUserProfile");
const LOGO_SRC = '/logo.png';
async function LocaleLayout({ children, params, }) {
    const { locale: rawLocale } = await params;
    const locale = constants_1.SUPPORTED_LOCALES.includes(rawLocale) ? rawLocale : undefined;
    if (!locale) {
        (0, navigation_1.notFound)();
    }
    const dictionary = await (0, dictionaries_1.getDictionary)(locale);
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, } = await supabase.auth.getUser();
    let role = null;
    if (user) {
        try {
            const profile = await (0, ensureUserProfile_1.ensureUserProfile)(user.id, user.email);
            role = profile.role ?? null;
        }
        catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[layout] unable to load user role', error);
            }
        }
    }
    return ((0, jsx_runtime_1.jsxs)(locale_provider_1.LocaleProvider, { value: { locale, dictionary }, children: [(0, jsx_runtime_1.jsx)(locale_sync_1.LocaleSync, { locale: locale }), (0, jsx_runtime_1.jsxs)("div", { className: "relative min-h-screen overflow-hidden bg-navy-900 text-slate-100", children: [(0, jsx_runtime_1.jsx)("div", { className: "pointer-events-none absolute inset-0 bg-grid-overlay opacity-60" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8", children: [(0, jsx_runtime_1.jsxs)("header", { className: "border-b border-white/5 pb-4 sm:pb-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between sm:hidden", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}`, className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "relative h-12 w-12 overflow-hidden rounded-2xl border border-accent-gold/40 shadow-card", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: LOGO_SRC, alt: constants_1.APP_TITLE, fill: true, className: "object-cover", priority: true }) }), (0, jsx_runtime_1.jsx)("p", { className: "text-base font-semibold text-white", children: "NBAnima" })] }), role === 'admin' ? ((0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}/admin`, className: "inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-navy-900/60 px-3 py-1 text-xs font-semibold text-accent-gold transition hover:border-accent-gold", children: [dictionary.common.admin, (0, jsx_runtime_1.jsx)("span", { "aria-hidden": true, children: "\u2197" })] })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "hidden items-center justify-between gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}`, className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "relative h-12 w-12 overflow-hidden rounded-2xl border border-accent-gold/40 shadow-card", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: LOGO_SRC, alt: constants_1.APP_TITLE, fill: true, className: "object-cover", priority: true }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "hidden text-sm uppercase tracking-widest text-accent-gold/80 sm:block", children: constants_1.APP_TITLE }), (0, jsx_runtime_1.jsx)("p", { className: "text-base font-semibold text-white", children: "NBAnima" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4", children: [(0, jsx_runtime_1.jsx)(language_toggle_1.LanguageToggle, { locale: locale }), (0, jsx_runtime_1.jsx)(user_nav_button_1.UserNavButton, { locale: locale, label: dictionary.user.title })] })] })] }), (0, jsx_runtime_1.jsx)("main", { className: "flex-1 py-8", children: children }), (0, jsx_runtime_1.jsxs)("footer", { className: "mt-auto flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["\u00A9 ", new Date().getFullYear(), " NBAnima"] }), (0, jsx_runtime_1.jsx)("span", { children: constants_1.APP_TITLE })] })] })] })] }));
}
