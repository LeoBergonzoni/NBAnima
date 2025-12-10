"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GamesSummaryPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const GamesSummaryClient_1 = require("./GamesSummaryClient");
const constants_1 = require("../../../../lib/constants");
const supabase_1 = require("../../../../lib/supabase");
const dictionaries_1 = require("../../../../locales/dictionaries");
async function GamesSummaryPage({ params, }) {
    const { locale: rawLocale } = await params;
    const locale = constants_1.SUPPORTED_LOCALES.includes(rawLocale) ? rawLocale : undefined;
    if (!locale) {
        (0, navigation_1.notFound)();
    }
    const dictionary = await (0, dictionaries_1.getDictionary)(locale);
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        (0, navigation_1.redirect)(`/${locale}`);
    }
    const { data: profile } = await supabase_1.supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    if (profile?.role !== 'admin') {
        (0, navigation_1.redirect)(`/${locale}`);
    }
    return (0, jsx_runtime_1.jsx)(GamesSummaryClient_1.GamesSummaryClient, { locale: locale, dictionary: dictionary });
}
