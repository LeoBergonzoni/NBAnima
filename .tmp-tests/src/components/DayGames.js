"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const BDL_ENDPOINT = 'https://www.balldontlie.io/api/v1/games';
const normalizeString = (value) => {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
};
const extractTeamDto = (team) => ({
    abbr: team?.abbreviation ?? undefined,
    providerTeamId: team?.id !== null && team?.id !== undefined ? normalizeString(team.id) : undefined,
    name: team?.full_name ?? team?.name ?? undefined,
});
const mapGameToDto = (game, dateNY) => {
    const startTime = typeof game?.start_time === 'string' && game.start_time.trim().length > 0
        ? game.start_time
        : typeof game?.date === 'string'
            ? game.date
            : null;
    return {
        provider: 'bdl',
        providerGameId: normalizeString(game?.id),
        season: normalizeString(game?.season),
        status: normalizeString(game?.status),
        dateNY,
        startTimeUTC: startTime,
        home: extractTeamDto(game?.home_team ?? null),
        away: extractTeamDto(game?.visitor_team ?? null),
    };
};
const DayGames = ({ dateNY }) => {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [bdlGames, setBdlGames] = (0, react_1.useState)([]);
    const [upsertedMap, setUpsertedMap] = (0, react_1.useState)({});
    const [submittingKey, setSubmittingKey] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const loadGames = async () => {
            setLoading(true);
            setError(null);
            setBdlGames([]);
            setUpsertedMap({});
            try {
                const params = new URLSearchParams({
                    'dates[]': dateNY,
                    per_page: '100',
                });
                const response = await fetch(`${BDL_ENDPOINT}?${params.toString()}`, {
                    cache: 'no-store',
                });
                if (!response.ok) {
                    throw new Error(`BallDontLie response ${response.status}`);
                }
                const payload = await response.json();
                const rawGames = Array.isArray(payload?.data) ? payload.data : [];
                const dtos = rawGames.map((game) => mapGameToDto(game, dateNY));
                if (cancelled) {
                    return;
                }
                setBdlGames(dtos);
                if (dtos.length === 0) {
                    setUpsertedMap({});
                    setLoading(false);
                    return;
                }
                const upsertResponse = await fetch('/api/games/upsert-batch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ date: dateNY, games: dtos }),
                });
                const upsertPayload = await upsertResponse.json();
                if (cancelled) {
                    return;
                }
                if (upsertResponse.ok && upsertPayload?.ok) {
                    const map = {};
                    const games = Array.isArray(upsertPayload?.games)
                        ? upsertPayload.games
                        : [];
                    games.forEach((game) => {
                        if (game?.providerGameId) {
                            map[game.providerGameId] = game;
                        }
                    });
                    setUpsertedMap(map);
                }
                else {
                    throw new Error(upsertPayload?.error
                        ? String(upsertPayload.error)
                        : 'Errore in /api/games/upsert-batch');
                }
            }
            catch (err) {
                if (cancelled) {
                    return;
                }
                const message = err instanceof Error ? err.message : 'Impossibile caricare le partite.';
                setError(message);
            }
            finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        loadGames();
        return () => {
            cancelled = true;
        };
    }, [dateNY]);
    const supabaseIdByProvider = (0, react_1.useMemo)(() => upsertedMap, [upsertedMap]);
    const handlePick = (0, react_1.useCallback)(async (game, side) => {
        const supabaseGame = supabaseIdByProvider[game.providerGameId];
        if (!supabaseGame) {
            window.alert('Partita non sincronizzata. Riprova tra pochi secondi.');
            return;
        }
        const teamInfo = side === 'home' ? game.home : game.away;
        const responseTeamAbbr = side === 'home' ? supabaseGame.home_abbr : supabaseGame.away_abbr;
        const abbr = teamInfo?.abbr ?? responseTeamAbbr ?? undefined;
        if (!abbr) {
            window.alert('Abbreviazione della squadra non disponibile.');
            return;
        }
        const submissionKey = `${game.providerGameId}-${side}`;
        setSubmittingKey(submissionKey);
        try {
            const providerGameId = game.providerGameId;
            const season = game.season;
            const status = supabaseGame?.status ?? game.status;
            const startTimeISO = game.startTimeUTC ?? null;
            const homeAbbr = game.home.abbr ?? supabaseGame?.home_abbr ?? undefined;
            const awayAbbr = game.away.abbr ?? supabaseGame?.away_abbr ?? undefined;
            const homeProviderTeamId = game.home.providerTeamId;
            const awayProviderTeamId = game.away.providerTeamId;
            const homeName = game.home.name ?? homeAbbr ?? null;
            const awayName = game.away.name ?? awayAbbr ?? null;
            const response = await fetch('/api/picks/team', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pickDate: dateNY,
                    game: {
                        gameId: supabaseGame.id,
                        gameProvider: 'bdl',
                        providerGameId,
                        dto: {
                            provider: 'bdl',
                            providerGameId: String(providerGameId),
                            season: String(season),
                            status,
                            dateNY,
                            startTimeUTC: startTimeISO ?? null,
                            home: {
                                abbr: homeAbbr,
                                providerTeamId: homeProviderTeamId ? String(homeProviderTeamId) : undefined,
                                name: homeName ?? undefined,
                            },
                            away: {
                                abbr: awayAbbr,
                                providerTeamId: awayProviderTeamId ? String(awayProviderTeamId) : undefined,
                                name: awayName ?? undefined,
                            },
                        },
                    },
                    selectedTeam: {
                        abbr,
                    },
                }),
            });
            const payload = await response.json();
            if (response.ok && payload?.ok) {
                window.alert(`Pick salvata: Vince ${abbr}!`);
            }
            else {
                const errorMessage = payload?.error ?? `Errore imprevisto (${response.status}).`;
                window.alert(`Errore nel salvataggio della pick: ${errorMessage}`);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            window.alert(`Errore di rete: ${message}`);
        }
        finally {
            setSubmittingKey((current) => (current === submissionKey ? null : current));
        }
    }, [dateNY, supabaseIdByProvider]);
    const renderContent = () => {
        if (loading) {
            return (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-muted-foreground", children: "Carico le partite..." });
        }
        if (error) {
            return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700", children: ["Errore: ", error] }));
        }
        if (bdlGames.length === 0) {
            return ((0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-muted-foreground", children: ["Nessuna partita trovata per ", dateNY, "."] }));
        }
        return ((0, jsx_runtime_1.jsx)("ul", { className: "flex flex-col gap-4", children: bdlGames.map((game) => {
                const supabaseGame = supabaseIdByProvider[game.providerGameId];
                const homeAbbr = game.home.abbr ?? supabaseGame?.home_abbr ?? 'HOME';
                const awayAbbr = game.away.abbr ?? supabaseGame?.away_abbr ?? 'AWAY';
                const isHomeSubmitting = submittingKey === `${game.providerGameId}-home`;
                const isAwaySubmitting = submittingKey === `${game.providerGameId}-away`;
                return ((0, jsx_runtime_1.jsxs)("li", { className: "flex flex-col gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-semibold", children: [homeAbbr, " vs ", awayAbbr] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-500", children: ["Stato: ", supabaseGame?.status ?? game.status] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "flex-1 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300", onClick: () => handlePick(game, 'home'), disabled: !supabaseGame || isHomeSubmitting, children: isHomeSubmitting ? 'Salvo...' : `Vince ${homeAbbr}` }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "flex-1 rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300", onClick: () => handlePick(game, 'away'), disabled: !supabaseGame || isAwaySubmitting, children: isAwaySubmitting ? 'Salvo...' : `Vince ${awayAbbr}` })] })] }, game.providerGameId));
            }) }));
    };
    return ((0, jsx_runtime_1.jsxs)("section", { className: "flex flex-col gap-4", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-lg font-semibold", children: ["Partite del ", dateNY] }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-500", children: "Aggiornate da BallDontLie" })] }), renderContent()] }));
};
exports.default = DayGames;
