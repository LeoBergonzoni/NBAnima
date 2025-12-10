"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.RostersAdminClient = RostersAdminClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
function RostersAdminClient() {
    const [season, setSeason] = (0, react_1.useState)(String(new Date().getFullYear()));
    const [espnError, setEspnError] = (0, react_1.useState)(null);
    const [espnLoading, setEspnLoading] = (0, react_1.useState)(false);
    const [espnData, setEspnData] = (0, react_1.useState)([]);
    const [syncError, setSyncError] = (0, react_1.useState)(null);
    const [syncLoading, setSyncLoading] = (0, react_1.useState)(false);
    const [syncResult, setSyncResult] = (0, react_1.useState)(null);
    const handleLoadEspn = async () => {
        setEspnError(null);
        setEspnLoading(true);
        try {
            const res = await fetch(`/api/admin/rosters/espn?season=${encodeURIComponent(season)}`, {
                cache: 'no-store',
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? 'ESPN fetch failed');
            }
            const body = await res.json();
            setEspnData(body.teams ?? []);
            if (body.errors && body.errors.length > 0) {
                setEspnError(`Alcune squadre non sono state caricate (${body.errors.length})`);
            }
        }
        catch (err) {
            setEspnData([]);
            setEspnError(err.message ?? 'ESPN fetch failed');
        }
        finally {
            setEspnLoading(false);
        }
    };
    const handleSyncEspn = async () => {
        setSyncError(null);
        setSyncResult(null);
        setSyncLoading(true);
        try {
            const res = await fetch(`/api/admin/rosters/espn/sync?season=${encodeURIComponent(season)}`, {
                method: 'POST',
                cache: 'no-store',
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error ?? 'Sync fallita');
            }
            setSyncResult({
                teamsProcessed: body.teamsProcessed ?? 0,
                playersUpserted: body.playersUpserted ?? 0,
                playersMoved: body.playersMoved ?? 0,
                deactivated: body.deactivated ?? 0,
                missingTeams: body.missingTeams ?? [],
                fetchErrors: body.fetchErrors ?? [],
            });
            if (body.fetchErrors && body.fetchErrors.length > 0) {
                setSyncError(`Alcune squadre non sono state caricate (${body.fetchErrors.length})`);
            }
        }
        catch (err) {
            setSyncResult(null);
            setSyncError(err.message ?? 'Sync fallita');
        }
        finally {
            setSyncLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: (0, jsx_runtime_1.jsxs)("section", { className: "space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-white", children: "Preview rosters da ESPN" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-300", children: ["Non salva nulla: scarica e mostra i roster correnti da ESPN (season: ", season, ")."] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-200", children: ["Season", (0, jsx_runtime_1.jsx)("input", { className: "w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400", value: season, onChange: (e) => setSeason(e.target.value), inputMode: "numeric", pattern: "\\\\d{4}" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleLoadEspn, disabled: espnLoading || syncLoading, className: "inline-flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-indigo-950 shadow hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-800 disabled:text-indigo-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RotateCw, { className: `h-4 w-4 ${espnLoading ? 'animate-spin' : ''}` }), espnLoading ? 'Carico...' : 'Carica da ESPN'] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleSyncEspn, disabled: syncLoading || espnLoading, className: "inline-flex items-center justify-center gap-2 rounded-md border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 shadow hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:border-emerald-800 disabled:text-emerald-500", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RotateCw, { className: `h-4 w-4 ${syncLoading ? 'animate-spin' : ''}` }), syncLoading ? 'Sincronizzo...' : 'Sincronizza su Supabase'] })] })] }), espnError ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-md border border-amber-400/40 bg-amber-950/60 px-4 py-3 text-sm text-amber-100", children: espnError })) : null, espnData.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3", children: espnData.map((team) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-white/10 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-baseline justify-between gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: team.team.abbr }), (0, jsx_runtime_1.jsx)("h3", { className: "text-base font-semibold text-white", children: team.team.name })] }), (0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-100", children: team.players.length })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 space-y-1 text-sm text-slate-200 max-h-64 overflow-y-auto", children: team.players.map((p) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded px-2 py-1 hover:bg-white/5", children: [(0, jsx_runtime_1.jsx)("span", { className: "truncate", children: p.fullName || p.id }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-400", children: p.position ?? '—' })] }, p.id))) })] }, team.team.id))) })) : ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Nessun dato ESPN caricato." })), syncError ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-md border border-amber-400/40 bg-amber-950/60 px-4 py-3 text-sm text-amber-100", children: syncError })) : null, syncResult ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: "Ultima sync ESPN \u2192 Supabase" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 grid grid-cols-2 gap-2 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Squadre processate: ", syncResult.teamsProcessed] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Giocatori upsertati: ", syncResult.playersUpserted] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Cambi squadra: ", syncResult.playersMoved] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Disattivati: ", syncResult.deactivated] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Missing team: ", syncResult.missingTeams.length] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Errori fetch: ", syncResult.fetchErrors.length] })] }), syncResult.missingTeams.length > 0 ? ((0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-xs text-amber-200", children: ["Team non mappati (abbr): ", syncResult.missingTeams.join(', ')] })) : null] })) : null] }) }));
}
