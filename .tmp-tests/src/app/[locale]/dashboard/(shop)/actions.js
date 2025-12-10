"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyCardAction = buyCardAction;
exports.buyPackAction = buyPackAction;
exports.claimDailyPearlPackAction = claimDailyPearlPackAction;
const cache_1 = require("next/cache");
const supabase_1 = require("../../../../lib/supabase");
const trading_packs_1 = require("../../../../config/trading-packs");
const formatDashboardPath = (locale) => {
    const normalized = locale && locale.length > 0 ? locale : 'it';
    return `/${normalized}/dashboard`;
};
async function buyCardAction({ cardId, locale, }) {
    if (!cardId) {
        return { ok: false, error: 'CARD_NOT_FOUND' };
    }
    try {
        const supabase = await (0, supabase_1.createServerSupabase)();
        const { data: { user }, error: authError, } = await supabase.auth.getUser();
        if (authError || !user) {
            return { ok: false, error: 'UNAUTHORIZED' };
        }
        const { data: card, error: cardError } = await supabase_1.supabaseAdmin
            .from('shop_cards')
            .select('id, price')
            .eq('id', cardId)
            .maybeSingle();
        if (cardError || !card) {
            return { ok: false, error: 'CARD_NOT_FOUND' };
        }
        const { data: userRow, error: userError } = await supabase_1.supabaseAdmin
            .from('users')
            .select('anima_points_balance')
            .eq('id', user.id)
            .maybeSingle();
        if (userError || !userRow) {
            return { ok: false, error: 'UNKNOWN' };
        }
        const balance = userRow.anima_points_balance ?? 0;
        if (balance < card.price) {
            return { ok: false, error: 'INSUFFICIENT_FUNDS' };
        }
        const { error: userCardsError } = await supabase_1.supabaseAdmin.from('user_cards').insert({
            user_id: user.id,
            card_id: cardId,
        });
        if (userCardsError) {
            return { ok: false, error: 'USER_CARDS_FAIL' };
        }
        const nextBalance = balance - card.price;
        const [{ error: ledgerError }, { error: userUpdateError }] = await Promise.all([
            supabase_1.supabaseAdmin.from('anima_points_ledger').insert({
                user_id: user.id,
                delta: -card.price,
                balance_after: nextBalance,
                reason: 'purchase_card',
            }),
            supabase_1.supabaseAdmin
                .from('users')
                .update({ anima_points_balance: nextBalance })
                .eq('id', user.id),
        ]);
        if (ledgerError || userUpdateError) {
            return { ok: false, error: 'LEDGER_OR_USER_UPDATE_FAIL' };
        }
        const dashboardPath = formatDashboardPath(locale);
        (0, cache_1.revalidatePath)(dashboardPath);
        (0, cache_1.revalidatePath)(`${dashboardPath}/trading-cards`);
        return { ok: true };
    }
    catch (error) {
        console.error('[buyCardAction]', error);
        return { ok: false, error: 'UNKNOWN' };
    }
}
const drawRarity = (odds) => {
    const roll = Math.random();
    if (roll <= odds.common) {
        return 'common';
    }
    if (roll <= odds.common + odds.rare) {
        return 'rare';
    }
    return 'legendary';
};
const selectRandomCard = (pool) => {
    if (!pool.length) {
        return null;
    }
    const index = Math.floor(Math.random() * pool.length);
    return pool[index] ?? null;
};
const drawCardsForPack = async (pack) => {
    const { data: cards, error: cardsError } = await supabase_1.supabaseAdmin
        .from('shop_cards')
        .select('id, name, description, rarity, price, image_url, accent_color, category, conference');
    if (cardsError || !cards?.length) {
        return { ok: false, error: 'NO_CARDS_AVAILABLE' };
    }
    const rarityPools = {
        common: cards.filter((card) => card.rarity === 'common'),
        rare: cards.filter((card) => card.rarity === 'rare' || card.rarity === 'epic'),
        legendary: cards.filter((card) => card.rarity === 'legendary'),
    };
    if (!rarityPools.common.length) {
        return { ok: false, error: 'NO_CARDS_AVAILABLE' };
    }
    const desiredRarities = ['common'];
    for (let index = 0; index < 3; index += 1) {
        desiredRarities.push(drawRarity(pack.odds));
    }
    const selectedCards = [];
    for (const rarity of desiredRarities) {
        const card = selectRandomCard(rarityPools[rarity]);
        if (!card) {
            return { ok: false, error: 'NO_CARDS_FOR_RARITY' };
        }
        selectedCards.push(card);
    }
    return { ok: true, cards: selectedCards };
};
async function buyPackAction({ packId, locale, adminOverride = false, }) {
    const pack = trading_packs_1.PACK_DEFINITION_MAP[packId];
    if (!pack) {
        return { ok: false, error: 'PACK_NOT_FOUND' };
    }
    try {
        const supabase = await (0, supabase_1.createServerSupabase)();
        const { data: { user }, error: authError, } = await supabase.auth.getUser();
        if (authError || !user) {
            return { ok: false, error: 'UNAUTHORIZED' };
        }
        const { data: userRow, error: userError } = await supabase_1.supabaseAdmin
            .from('users')
            .select('anima_points_balance, role')
            .eq('id', user.id)
            .maybeSingle();
        if (userError || !userRow) {
            return { ok: false, error: 'UNKNOWN' };
        }
        if (adminOverride && userRow.role !== 'admin') {
            return { ok: false, error: 'NOT_ADMIN_FOR_OVERRIDE' };
        }
        const packCost = adminOverride ? 0 : pack.price;
        const balance = userRow.anima_points_balance ?? 0;
        if (packCost > balance) {
            return { ok: false, error: 'INSUFFICIENT_FUNDS' };
        }
        const drawResult = await drawCardsForPack(pack);
        if (!drawResult.ok) {
            return { ok: false, error: drawResult.error };
        }
        const selectedCards = drawResult.cards;
        const { error: userCardsError } = await supabase_1.supabaseAdmin.from('user_cards').insert(selectedCards.map((card) => ({
            user_id: user.id,
            card_id: card.id,
        })));
        if (userCardsError) {
            return { ok: false, error: 'USER_CARDS_FAIL' };
        }
        const nextBalance = balance - packCost;
        if (packCost > 0) {
            const [{ error: ledgerError }, { error: userUpdateError }] = await Promise.all([
                supabase_1.supabaseAdmin.from('anima_points_ledger').insert({
                    user_id: user.id,
                    delta: -packCost,
                    balance_after: nextBalance,
                    reason: `purchase_pack_${pack.id}`,
                }),
                supabase_1.supabaseAdmin.from('users').update({ anima_points_balance: nextBalance }).eq('id', user.id),
            ]);
            if (ledgerError || userUpdateError) {
                return { ok: false, error: 'LEDGER_OR_USER_UPDATE_FAIL' };
            }
        }
        const dashboardPath = formatDashboardPath(locale);
        (0, cache_1.revalidatePath)(dashboardPath);
        (0, cache_1.revalidatePath)(`${dashboardPath}/trading-cards`);
        return { ok: true, cards: selectedCards, newBalance: nextBalance };
    }
    catch (error) {
        console.error('[buyPackAction]', error);
        return { ok: false, error: 'UNKNOWN' };
    }
}
async function claimDailyPearlPackAction({ locale, }) {
    const pack = trading_packs_1.PACK_DEFINITION_MAP.pearl;
    const now = Date.now();
    try {
        const supabase = await (0, supabase_1.createServerSupabase)();
        const { data: { user }, error: authError, } = await supabase.auth.getUser();
        if (authError || !user) {
            return { ok: false, error: 'UNAUTHORIZED' };
        }
        const { data: userRow, error: userError } = await supabase_1.supabaseAdmin
            .from('users')
            .select('anima_points_balance')
            .eq('id', user.id)
            .maybeSingle();
        if (userError || !userRow) {
            return { ok: false, error: 'UNKNOWN' };
        }
        const { data: lastClaim, error: lastClaimError } = await supabase_1.supabaseAdmin
            .from('anima_points_ledger')
            .select('created_at')
            .eq('user_id', user.id)
            .eq('reason', 'daily_pearl_pack')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (lastClaimError) {
            return { ok: false, error: 'UNKNOWN' };
        }
        const lastClaimAt = lastClaim?.created_at ? new Date(lastClaim.created_at).getTime() : null;
        const nextAvailableAt = lastClaimAt ? lastClaimAt + 24 * 60 * 60 * 1000 : null;
        if (nextAvailableAt && nextAvailableAt > now) {
            return { ok: false, error: 'DAILY_LIMIT', nextAvailableAt: new Date(nextAvailableAt).toISOString() };
        }
        const drawResult = await drawCardsForPack(pack);
        if (!drawResult.ok) {
            return { ok: false, error: drawResult.error };
        }
        const selectedCards = drawResult.cards;
        const { error: userCardsError } = await supabase_1.supabaseAdmin.from('user_cards').insert(selectedCards.map((card) => ({
            user_id: user.id,
            card_id: card.id,
        })));
        if (userCardsError) {
            return { ok: false, error: 'USER_CARDS_FAIL' };
        }
        const balance = userRow.anima_points_balance ?? 0;
        const [{ error: ledgerError }] = await Promise.all([
            supabase_1.supabaseAdmin.from('anima_points_ledger').insert({
                user_id: user.id,
                delta: 0,
                balance_after: balance,
                reason: 'daily_pearl_pack',
            }),
        ]);
        if (ledgerError) {
            return { ok: false, error: 'LEDGER_OR_USER_UPDATE_FAIL' };
        }
        const dashboardPath = formatDashboardPath(locale);
        (0, cache_1.revalidatePath)(dashboardPath);
        (0, cache_1.revalidatePath)(`${dashboardPath}/trading-cards`);
        const availableAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
        return { ok: true, cards: selectedCards, newBalance: balance, nextAvailableAt: availableAt };
    }
    catch (error) {
        console.error('[claimDailyPearlPackAction]', error);
        return { ok: false, error: 'UNKNOWN' };
    }
}
