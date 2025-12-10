"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTeamPlayers = useTeamPlayers;
const react_1 = require("react");
const swr_1 = __importDefault(require("swr"));
// normalizza in stringa stabile
const s = (v) => (v == null ? '' : String(v).trim());
function useTeamPlayers(params) {
    // 🔑 chiave SWR deterministica e univoca per ogni matchup
    const homeKey = `${s(params.homeId)}|${s(params.homeAbbr)}|${s(params.homeName)}`;
    const awayKey = `${s(params.awayId)}|${s(params.awayAbbr)}|${s(params.awayName)}`;
    const swrKey = homeKey && awayKey ? ['team-players', homeKey, awayKey] : null;
    const fetcher = async () => {
        const search = new URLSearchParams({
            homeId: s(params.homeId),
            homeAbbr: s(params.homeAbbr),
            homeName: s(params.homeName),
            awayId: s(params.awayId),
            awayAbbr: s(params.awayAbbr),
            awayName: s(params.awayName),
        });
        const res = await fetch(`/api/players?${search.toString()}`, {
            cache: 'no-store',
            credentials: 'same-origin',
            next: { revalidate: 0 },
        });
        if (!res.ok) {
            // prova a estrarre un json d’errore per messaggi più utili
            let msg = 'Failed to load players';
            try {
                const body = (await res.json());
                if ('error' in body && body.error)
                    msg = body.error;
            }
            catch {
                // ignore
            }
            throw new Error(msg);
        }
        return (await res.json());
    };
    const { data, error, isLoading, mutate } = (0, swr_1.default)(swrKey, fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 0, // 👈 evita unione “aggressiva” tra key simili
        keepPreviousData: true, // 👈 UI più fluida mentre ricarica
    });
    const success = !!data && 'ok' in data && data.ok;
    const successData = success ? data : null;
    const homePlayers = (0, react_1.useMemo)(() => successData?.home ?? [], [successData]);
    const awayPlayers = (0, react_1.useMemo)(() => successData?.away ?? [], [successData]);
    const players = (0, react_1.useMemo)(() => [...homePlayers, ...awayPlayers], [homePlayers, awayPlayers]);
    const errorMessage = (0, react_1.useMemo)(() => {
        if (error)
            return String(error.message ?? error);
        if (data && 'ok' in data && !data.ok)
            return data.error || 'unresolved teams';
        return null;
    }, [data, error]);
    const missing = (0, react_1.useMemo)(() => {
        if (success)
            return [];
        if (data && 'ok' in data && !data.ok && data.missing) {
            try {
                return [JSON.stringify(data.missing)];
            }
            catch {
                return ['unresolved teams'];
            }
        }
        return [];
    }, [data, success]);
    return {
        players,
        homePlayers,
        awayPlayers,
        missing,
        isLoading,
        isError: Boolean(errorMessage),
        error: errorMessage,
        reload: mutate,
    };
}
