"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const dashboard_client_1 = require("../../../components/dashboard/dashboard-client");
const constants_1 = require("../../../lib/constants");
const ensureUserProfile_1 = require("../../../lib/server/ensureUserProfile");
const supabase_1 = require("../../../lib/supabase");
async function DashboardPage({ params, }) {
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
        console.error('[dashboard] failed to ensure profile', error);
        (0, navigation_1.redirect)(`/${locale}/login`);
    }
    const [{ data: userCards, error: cardsError }, { data: shopCards, error: shopError }] = await Promise.all([
        supabase_1.supabaseAdmin.from('user_cards').select('card_id').eq('user_id', user.id),
        supabase_1.supabaseAdmin.from('shop_cards').select('*').order('price', { ascending: true }),
    ]);
    if (cardsError || shopError || !profile) {
        console.error('[dashboard] failed to load profile context', cardsError || shopError);
        (0, navigation_1.redirect)(`/${locale}/login`);
    }
    const ownedCardCounts = (userCards ?? []).reduce((acc, entry) => {
        const cardId = entry.card_id;
        if (cardId) {
            acc[cardId] = (acc[cardId] ?? 0) + 1;
        }
        return acc;
    }, {});
    const ownedCards = (shopCards ?? []).filter((card) => ownedCardCounts[card.id]);
    return ((0, jsx_runtime_1.jsx)(dashboard_client_1.DashboardClient, { locale: locale, balance: profile.anima_points_balance, balanceFormatted: profile.anima_points_balance?.toLocaleString(locale === 'it' ? 'it-IT' : 'en-US'), ownedCards: ownedCards, shopCards: (shopCards ?? []), role: profile.role }));
}
