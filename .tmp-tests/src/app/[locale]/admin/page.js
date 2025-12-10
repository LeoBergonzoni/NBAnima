"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const admin_client_1 = require("../../../components/admin/admin-client");
const constants_1 = require("../../../lib/constants");
const supabase_1 = require("../../../lib/supabase");
const dictionaries_1 = require("../../../locales/dictionaries");
async function AdminPage({ params, }) {
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
    const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    if (profileError || profile?.role !== 'admin') {
        (0, navigation_1.redirect)(`/${locale}`);
    }
    const [{ data: users }, { data: shopCards }, { data: highlights }] = await Promise.all([
        supabase_1.supabaseAdmin
            .from('users')
            .select('id, email, full_name, anima_points_balance, role, user_cards(id, card:shop_cards(id, name, rarity, price))'),
        supabase_1.supabaseAdmin
            .from('shop_cards')
            .select('*')
            .order('price', { ascending: true }),
        supabase_1.supabaseAdmin
            .from('results_highlights')
            .select('player_id, rank, result_date')
            .order('rank', { ascending: true })
            .eq('result_date', new Date().toISOString().slice(0, 10)),
    ]);
    return ((0, jsx_runtime_1.jsx)(admin_client_1.AdminClient, { locale: locale, dictionary: dictionary, users: users ?? [], shopCards: (shopCards ?? []), highlights: (highlights ?? []) }));
}
