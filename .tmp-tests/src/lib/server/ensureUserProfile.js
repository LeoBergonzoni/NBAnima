"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUserProfile = void 0;
const supabase_1 = require("../../lib/supabase");
const ensureUserProfile = async (userId, email) => {
    const admin = (0, supabase_1.createAdminSupabaseClient)();
    const { data, error } = await admin
        .from('users')
        .select('full_name, anima_points_balance, role, avatar_url')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    if (data) {
        return data;
    }
    const fallbackEmail = email ?? `${userId}@nb-anima.local`;
    const nowIso = new Date().toISOString();
    const { data: inserted, error: insertError } = await admin
        .from('users')
        .upsert({
        id: userId,
        email: fallbackEmail,
        role: 'user',
        anima_points_balance: 0,
        full_name: null,
        avatar_url: null,
        created_at: nowIso,
        updated_at: nowIso,
    }, {
        onConflict: 'id',
    })
        .select('full_name, anima_points_balance, role, avatar_url')
        .single();
    if (insertError) {
        throw insertError;
    }
    if (inserted) {
        return inserted;
    }
    const { data: fetched, error: fetchError } = await admin
        .from('users')
        .select('full_name, anima_points_balance, role, avatar_url')
        .eq('id', userId)
        .maybeSingle();
    if (fetchError || !fetched) {
        throw fetchError ?? new Error('Failed to read user profile');
    }
    return fetched;
};
exports.ensureUserProfile = ensureUserProfile;
