"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LocaleHomePage;
const jsx_runtime_1 = require("react/jsx-runtime");
const image_1 = __importDefault(require("next/image"));
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const how_to_play_1 = __importDefault(require("../../components/home/how-to-play"));
const onboarding_showcase_1 = require("../../components/home/onboarding-showcase");
const constants_1 = require("../../lib/constants");
const onboarding_1 = require("../../config/onboarding");
const dictionaries_1 = require("../../locales/dictionaries");
const supabase_1 = require("../../lib/supabase");
async function LocaleHomePage({ params, }) {
    const { locale: rawLocale } = await params;
    const locale = constants_1.SUPPORTED_LOCALES.includes(rawLocale)
        ? rawLocale
        : undefined;
    if (!locale) {
        (0, navigation_1.notFound)();
    }
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, } = await supabase.auth.getUser();
    if (user) {
        (0, navigation_1.redirect)(`/${locale}/dashboard`);
    }
    const dictionary = await (0, dictionaries_1.getDictionary)(locale);
    // Update the image paths inside `src/config/onboarding.ts` (or swap the files in `/public`)
    // to change the visuals rendered in the onboarding carousel.
    const onboardingCards = dictionary.home.onboarding.map((card, index) => ({
        title: card.title,
        description: card.description,
        image: onboarding_1.ONBOARDING_STEPS[index]?.img ?? '/logo.png',
    }));
    return ((0, jsx_runtime_1.jsxs)("main", { className: "min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 text-white", children: [(0, jsx_runtime_1.jsxs)("section", { className: "relative isolate mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pb-16 pt-8 text-center sm:px-6 lg:px-8 md:pt-12", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_55%)]" }), (0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 -z-20 bg-gradient-to-b from-transparent via-navy-950/60 to-navy-950" }), (0, jsx_runtime_1.jsx)(image_1.default, { src: "/NBAnimasfondo.png", alt: "NBAnima logo", width: 1000, height: 1000, priority: true, className: "mx-auto h-auto w-full max-w-[680px] rounded-3xl border border-accent-gold/40 bg-navy-900/60 p-4 shadow-card backdrop-blur" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: (0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold leading-tight text-white sm:text-5xl", children: dictionary.home.heroTitle }) }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2 text-slate-300 sm:max-w-2xl", children: (0, jsx_runtime_1.jsx)("p", { className: "text-base sm:text-lg", children: dictionary.home.heroSubtitle }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex w-full flex-col gap-3 sm:flex-row sm:justify-center", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: `/${locale}/signup`, className: "inline-flex min-h-[44px] min-w-[180px] items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold px-6 py-2.5 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110", children: dictionary.home.ctaRegister }), (0, jsx_runtime_1.jsx)(link_1.default, { href: `/${locale}/login`, className: "inline-flex min-h-[44px] min-w-[180px] items-center justify-center rounded-2xl border border-white/15 bg-navy-900/80 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition hover:border-accent-gold/60", children: dictionary.home.ctaLogin })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "relative mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8 md:pb-16", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-8 space-y-2", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-semibold text-white sm:text-3xl", children: "NBAnima Onboarding" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Scopri come funziona il gioco e preparati a dominare la stagione NBA." })] }), (0, jsx_runtime_1.jsx)(onboarding_showcase_1.OnboardingShowcase, { cards: onboardingCards })] }), (0, jsx_runtime_1.jsx)(how_to_play_1.default, { content: dictionary.home.howToPlay, signupHref: `/${locale}/signup` }), (0, jsx_runtime_1.jsx)("section", { id: "auth-cta", className: "mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center gap-3 sm:flex-row sm:justify-center", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: `/${locale}/signup`, className: "inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-r from-accent-gold via-accent-coral to-accent-gold px-6 py-2.5 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 sm:w-auto", children: dictionary.home.ctaRegister }), (0, jsx_runtime_1.jsx)(link_1.default, { href: `/${locale}/login`, className: "inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-white/15 bg-navy-900/70 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition hover:border-accent-gold/60 sm:w-auto", children: dictionary.home.ctaLogin })] }) })] }));
}
