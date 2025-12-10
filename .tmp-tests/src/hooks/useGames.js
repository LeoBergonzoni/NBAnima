"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGames = void 0;
const swr_1 = __importDefault(require("swr"));
const fetcher = async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to load games');
    }
    const payload = await response.json();
    if (Array.isArray(payload)) {
        return payload;
    }
    if (Array.isArray(payload?.games)) {
        return payload.games;
    }
    console.warn('[useGames] Unexpected games payload', payload);
    return [];
};
const useGames = (_locale) => {
    void _locale;
    const { data, error, isLoading, mutate } = (0, swr_1.default)('/api/games', fetcher, { revalidateOnFocus: false });
    const mapByProviderId = (Array.isArray(data) ? data : []).reduce((acc, game) => {
        const providerId = game?.provider_game_id;
        const supabaseId = game?.id;
        if (providerId && typeof providerId === 'string' && supabaseId && typeof supabaseId === 'string') {
            acc[providerId] = supabaseId;
        }
        return acc;
    }, {});
    return {
        games: data ?? [],
        isLoading,
        error,
        refresh: mutate,
        mapByProviderId,
    };
};
exports.useGames = useGames;
