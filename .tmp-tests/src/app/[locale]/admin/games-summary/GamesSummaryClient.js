"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesSummaryClient = GamesSummaryClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const lucide_react_1 = require("lucide-react");
const react_1 = require("react");
const useTeamRecords_1 = require("../../../../hooks/useTeamRecords");
const defaultNyDate = (0, date_fns_tz_1.formatInTimeZone)((0, date_fns_1.subDays)(new Date(), 1), 'America/New_York', 'yyyy-MM-dd');
const formatLocalTipoff = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '—';
    }
    return (0, date_fns_1.format)(parsed, 'PPpp');
};
const resolveErrorMessage = (status, fallback) => {
    if (status === 401) {
        return 'Autenticazione o API key BallDontLie non valida (401).';
    }
    if (status === 429) {
        return 'Limite di richieste BallDontLie raggiunto (429). Riprova tra qualche minuto.';
    }
    return fallback ?? 'Errore nel recupero delle partite dal provider.';
};
function GamesSummaryClient({ locale, dictionary, }) {
    void locale;
    const [selectedDate, setSelectedDate] = (0, react_1.useState)(defaultNyDate);
    const [games, setGames] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const teamIds = (0, react_1.useMemo)(() => {
        const ids = new Set();
        games.forEach(({ game }) => {
            if (game?.home_team?.id !== undefined) {
                ids.add(String(game.home_team.id));
            }
            if (game?.visitor_team?.id !== undefined) {
                ids.add(String(game.visitor_team.id));
            }
        });
        return Array.from(ids);
    }, [games]);
    // Placeholder: this will surface real W–L records once `/v1/standings` is available (GOAT)
    // or after computing wins/losses from `/v1/games` history.
    const { records } = (0, useTeamRecords_1.useTeamRecords)(teamIds);
    const handleLoad = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/games-summary?date=${encodeURIComponent(selectedDate)}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = resolveErrorMessage(response.status, payload?.error);
                throw new Error(message);
            }
            setGames(Array.isArray(payload?.games) ? payload.games : []);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Impossibile caricare le partite.';
            setError(message);
            setGames([]);
        }
        finally {
            setIsLoading(false);
        }
    };
    const renderPerformers = (label, performers) => {
        const list = Array.isArray(performers) ? performers.filter((p) => p?.player) : [];
        if (list.length === 0) {
            return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "\u2014" })] }));
        }
        return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 space-y-1", children: list.map((performer) => {
                        const name = `${performer.player?.first_name ?? ''} ${performer.player?.last_name ?? ''}`.trim();
                        const teamName = performer.team?.full_name ?? performer.team?.abbreviation ?? '—';
                        return ((0, jsx_runtime_1.jsxs)("p", { className: "text-sm font-semibold text-white", children: [name, (0, jsx_runtime_1.jsxs)("span", { className: "text-slate-400", children: [" \u00B7 ", teamName] }), (0, jsx_runtime_1.jsxs)("span", { className: "ml-1 text-xs text-accent-gold", children: ["(", performer.value ?? 0, ")"] })] }, performer.player?.id));
                    }) })] }));
    };
    const renderRecord = (teamId) => {
        if (teamId === undefined) {
            return 'W–L —';
        }
        const record = records[String(teamId)];
        if (record) {
            return `W–L ${record.wins}-${record.losses}`;
        }
        return 'W–L —';
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold uppercase tracking-wide text-accent-gold", children: "Admin \u00B7 BallDontLie All-Star" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold text-white", children: "Riepilogo partite NBA" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Seleziona una data (America/New_York) e carica le partite finalizzate con i migliori giocatori." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Data (NYC)", (0, jsx_runtime_1.jsx)("input", { type: "date", value: selectedDate, onChange: (event) => setSelectedDate(event.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-navy-800/80 px-3 py-2 text-sm text-white shadow-inner outline-none transition focus:border-accent-gold" })] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleLoad, disabled: isLoading || !selectedDate, className: "inline-flex items-center justify-center gap-2 rounded-lg border border-accent-gold/60 bg-accent-gold/20 px-4 py-2 text-sm font-semibold text-accent-gold shadow-md transition hover:border-accent-gold hover:bg-accent-gold/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400", children: [isLoading ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4" }), isLoading ? dictionary.common.loading : 'Carica partite del giorno'] })] })] }), error ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100", children: error })) : null, isLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3 rounded-xl border border-white/5 bg-navy-900/60 p-4 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-5 w-5 animate-spin text-accent-gold" }), (0, jsx_runtime_1.jsx)("span", { children: "Recupero partite e statistiche..." })] })) : null, !isLoading && games.length === 0 && !error ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/5 bg-navy-900/60 p-4 text-sm text-slate-300", children: ["Nessuna partita finalizzata trovata per ", selectedDate, "."] })) : null, (0, jsx_runtime_1.jsx)("div", { className: "grid gap-4", children: games.map(({ game, topPerformers }) => {
                    const homeIsWinner = game.home_team_score > game.visitor_team_score;
                    const visitorIsWinner = game.visitor_team_score > game.home_team_score;
                    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-navy-900/60 p-4 shadow-card", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold uppercase tracking-wide text-accent-gold/80", children: formatLocalTipoff(game.date) }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: game.status })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("p", { className: (0, clsx_1.default)('text-base font-semibold', homeIsWinner ? 'text-emerald-300' : 'text-white'), children: game.home_team.full_name }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: [game.home_team.abbreviation, ' · ', renderRecord(game.home_team.id)] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('rounded-lg px-3 py-1 text-lg font-bold', homeIsWinner ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-white'), children: game.home_team_score }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-semibold text-slate-400", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('rounded-lg px-3 py-1 text-lg font-bold', visitorIsWinner
                                                    ? 'bg-emerald-500/20 text-emerald-200'
                                                    : 'bg-white/5 text-white'), children: game.visitor_team_score })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1 text-right sm:text-left", children: [(0, jsx_runtime_1.jsx)("p", { className: (0, clsx_1.default)('text-base font-semibold', visitorIsWinner ? 'text-emerald-300' : 'text-white'), children: game.visitor_team.full_name }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: [game.visitor_team.abbreviation, ' · ', renderRecord(game.visitor_team.id)] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 rounded-lg border border-white/5 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400", children: "Top performers" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 grid gap-3 sm:grid-cols-3", children: [renderPerformers('Punti', topPerformers.points), renderPerformers('Rimbalzi', topPerformers.rebounds), renderPerformers('Assist', topPerformers.assists)] })] })] }, game.id));
                }) })] }));
}
