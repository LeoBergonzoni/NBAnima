"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertPlayers = void 0;
const dedupePlayers = (players) => {
    const map = new Map();
    players.forEach((player) => {
        if (!player.provider || !player.provider_player_id) {
            return;
        }
        const key = `${player.provider}:${player.provider_player_id}`;
        map.set(key, player);
    });
    return Array.from(map.values());
};
const upsertPlayers = async (supabaseAdmin, players) => {
    const uniquePlayers = dedupePlayers(players);
    if (uniquePlayers.length === 0) {
        return { data: [], error: null };
    }
    return supabaseAdmin
        .from('player')
        .upsert(uniquePlayers, {
        onConflict: 'provider,provider_player_id',
        ignoreDuplicates: false,
    })
        .select('id, provider, provider_player_id');
};
exports.upsertPlayers = upsertPlayers;
