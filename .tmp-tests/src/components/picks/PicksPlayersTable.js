"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PicksPlayersTable = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const react_1 = require("react");
const cells_1 = require("./cells");
const sortRows = (rows) => [...rows].sort((a, b) => {
    const dateCompare = (b.pick_date ?? '').localeCompare(a.pick_date ?? '');
    if (dateCompare !== 0) {
        return dateCompare;
    }
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
});
const PicksPlayersTable = ({ rows, title = 'Players', emptyMessage = 'No player picks.', className, formatCategory, showDateColumn = true, showChangesColumn = true, showTimestampsColumn = true, showOutcomeColumn = true, }) => {
    const sortedRows = (0, react_1.useMemo)(() => sortRows(rows), [rows]);
    const formatCategoryLabel = (0, react_1.useMemo)(() => formatCategory ??
        ((category) => category
            .split('_')
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join(' ')), [formatCategory]);
    const outcomeLabel = (0, react_1.useMemo)(() => (value) => {
        const normalized = (value ?? '').trim().toLowerCase();
        if (!normalized) {
            return { label: '—', className: 'text-slate-400' };
        }
        if (normalized === 'win' || normalized === 'won') {
            return {
                label: 'Win',
                className: 'rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-200',
            };
        }
        if (normalized === 'loss' || normalized === 'lost') {
            return {
                label: 'Loss',
                className: 'rounded-full border border-rose-400/40 bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-200',
            };
        }
        if (normalized === 'pending') {
            return {
                label: 'Pending',
                className: 'rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200',
            };
        }
        if (normalized === 'push') {
            return {
                label: 'Push',
                className: 'rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200',
            };
        }
        return { label: value ?? '—', className: 'text-slate-300' };
    }, []);
    return ((0, jsx_runtime_1.jsxs)("section", { className: (0, clsx_1.default)('space-y-3 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card', className), children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-sm font-semibold text-white", children: title }), sortedRows.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: emptyMessage })) : ((0, jsx_runtime_1.jsx)("div", { className: "-mx-4 overflow-x-auto sm:mx-0", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full divide-y divide-white/10 text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [showDateColumn ? ((0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Data (NY)" })) : null, (0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Categoria / Posizione" }), (0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Giocatore" }), showOutcomeColumn ? ((0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Esito" })) : null, (0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Matchup" }), showChangesColumn ? ((0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Changes" })) : null, showTimestampsColumn ? ((0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Created / Updated" })) : null] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-white/10 text-[13px] text-slate-200", children: sortedRows.map((row) => {
                                const homeAbbr = row.game?.home_team_abbr ?? null;
                                const awayAbbr = row.game?.away_team_abbr ?? null;
                                const homeName = row.game?.home_team_name ?? homeAbbr ?? 'HOME';
                                const awayName = row.game?.away_team_name ?? awayAbbr ?? 'AWAY';
                                const baseName = (0, cells_1.combineName)(row.player?.first_name, row.player?.last_name);
                                const playerName = baseName === '—' ? row.player_id : baseName;
                                const changes = row.changes_count ?? 0;
                                const outcome = outcomeLabel(row.result);
                                return ((0, jsx_runtime_1.jsxs)("tr", { children: [showDateColumn ? ((0, jsx_runtime_1.jsx)("td", { className: "whitespace-nowrap px-4 py-3 align-top text-xs text-slate-300", children: (0, cells_1.formatDateNy)(row.pick_date) })) : null, (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 align-top text-xs uppercase tracking-wide text-slate-300", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: formatCategoryLabel(row.category) }), row.player?.position ? ((0, jsx_runtime_1.jsx)("div", { className: "text-[11px] text-slate-400", children: row.player.position })) : null] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: playerName }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: row.player?.team_abbr ?? '—' })] }) }), showOutcomeColumn ? ((0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top text-sm", children: outcome.className.startsWith('rounded-full') ? ((0, jsx_runtime_1.jsx)("span", { className: outcome.className, children: outcome.label })) : ((0, jsx_runtime_1.jsx)("span", { className: outcome.className, children: outcome.label })) })) : null, (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(cells_1.TeamAbbrPill, { abbr: awayAbbr ?? 'AWY', variant: "away" }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "at" }), (0, jsx_runtime_1.jsx)(cells_1.TeamAbbrPill, { abbr: homeAbbr ?? 'HOME', variant: "home" })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: [awayName, " @ ", homeName] })] }) }), showChangesColumn ? ((0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top text-sm text-slate-200", children: changes })) : null, showTimestampsColumn ? ((0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 align-top text-xs text-slate-300", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Created: ", (0, cells_1.formatDateTimeNy)(row.created_at)] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Updated: ", (0, cells_1.formatDateTimeNy)(row.updated_at)] })] })) : null] }, `${row.game_id}-${row.category}-${row.player_id}`));
                            }) })] }) }))] }));
};
exports.PicksPlayersTable = PicksPlayersTable;
