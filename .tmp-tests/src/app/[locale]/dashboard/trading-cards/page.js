"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TradingCardsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const trading_cards_client_1 = require("../../../../components/trading-cards/trading-cards-client");
const constants_1 = require("../../../../lib/constants");
const ensureUserProfile_1 = require("../../../../lib/server/ensureUserProfile");
const supabase_1 = require("../../../../lib/supabase");
async function TradingCardsPage({ params, }) {
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
        console.error('[trading-cards] failed to ensure profile', error);
        (0, navigation_1.redirect)(`/${locale}/login`);
    }
    const [{ data: userCards, error: cardsError }, { data: shopCards, error: shopError }, { data: dailyLedgerRows, error: dailyLedgerError },] = await Promise.all([
        supabase_1.supabaseAdmin.from('user_cards').select('card_id').eq('user_id', user.id),
        supabase_1.supabaseAdmin.from('shop_cards').select('*').order('price', { ascending: true }),
        supabase_1.supabaseAdmin
            .from('anima_points_ledger')
            .select('created_at')
            .eq('user_id', user.id)
            .eq('reason', 'daily_pearl_pack')
            .order('created_at', { ascending: false })
            .limit(1),
    ]);
    if (cardsError || shopError || dailyLedgerError || !profile) {
        console.error('[trading-cards] failed to load profile context', cardsError || shopError || dailyLedgerError);
        (0, navigation_1.redirect)(`/${locale}/login`);
    }
    const ownedCardCounts = (userCards ?? []).reduce((acc, entry) => {
        const cardId = entry.card_id;
        if (cardId) {
            acc[cardId] = (acc[cardId] ?? 0) + 1;
        }
        return acc;
    }, {});
    return ((0, jsx_runtime_1.jsx)(trading_cards_client_1.TradingCardsClient, { locale: locale, balance: profile.anima_points_balance, shopCards: (shopCards ?? []), ownedCardCounts: ownedCardCounts, isAdmin: profile.role === 'admin', nextDailyPearlPackAvailableAt: dailyLedgerRows?.[0]?.created_at
            ? new Date(new Date(dailyLedgerRows[0].created_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
            : null }));
}
