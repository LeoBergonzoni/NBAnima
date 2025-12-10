"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PicksTeamsTable = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const react_1 = require("react");
const cells_1 = require("./cells");
const outcomeLabel = (value) => {
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
};
const sortRows = (rows) => [...rows].sort((a, b) => {
    const dateCompare = (b.pick_date ?? '').localeCompare(a.pick_date ?? '');
    if (dateCompare !== 0) {
        return dateCompare;
    }
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
});
const PicksTeamsTable = ({ rows, title = 'Teams', emptyMessage = 'No team picks.', className, showDateColumn = true, showChangesColumn = true, showTimestampsColumn = true, }) => {
    const sortedRows = (0, react_1.useMemo)(() => sortRows(rows), [rows]);
    return ((0, jsx_runtime_1.jsxs)("section", { className: (0, clsx_1.default)('space-y-3 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card', className), children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-sm font-semibold text-white", children: title }), sortedRows.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: emptyMessage })) : ((0, jsx_runtime_1.jsx)("div", { className: "-mx-4 overflow-x-auto sm:mx-0", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full divide-y divide-white/10 text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [showDateColumn ? ((0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Data (NY)" })) : null, (0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Matchup" }), (0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Scelta" }), (0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Esito" }), showChangesColumn ? ((0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Changes" })) : null, showTimestampsColumn ? ((0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-4 py-3 text-left", children: "Created / Updated" })) : null] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-white/10 text-[13px] text-slate-200", children: sortedRows.map((row) => {
                                const home = {
                                    id: row.game?.home_team_id ?? null,
                                    abbr: row.game?.home_team_abbr ?? null,
                                    name: row.game?.home_team_name ?? null,
                                };
                                const away = {
                                    id: row.game?.away_team_id ?? null,
                                    abbr: row.game?.away_team_abbr ?? null,
                                    name: row.game?.away_team_name ?? null,
                                };
                                const selected = {
                                    id: row.selected_team_id ?? null,
                                    abbr: row.selected_team_abbr ?? null,
                                    name: row.selected_team_name ?? null,
                                };
                                const isHomePick = (0, cells_1.matchesTeamIdentity)(selected, home);
                                const isAwayPick = (0, cells_1.matchesTeamIdentity)(selected, away);
                                const selectedAbbr = selected.abbr ?? (isHomePick ? home.abbr : isAwayPick ? away.abbr : null);
                                const normalizedSelectedName = selected.name && selected.name !== selected.id ? selected.name : null;
                                const selectedName = normalizedSelectedName ??
                                    (isHomePick ? home.name : isAwayPick ? away.name : null);
                                const selectedLabel = selectedName ?? row.selected_team_id ?? '—';
                                const homeLabel = (0, cells_1.combineName)(home.name, null, home.abbr ?? 'HOME');
                                const awayLabel = (0, cells_1.combineName)(away.name, null, away.abbr ?? 'AWAY');
                                const outcome = outcomeLabel(row.result);
                                const changes = row.changes_count ?? 0;
                                const created = (0, cells_1.formatDateTimeNy)(row.created_at);
                                const updated = (0, cells_1.formatDateTimeNy)(row.updated_at);
                                return ((0, jsx_runtime_1.jsxs)("tr", { children: [showDateColumn ? ((0, jsx_runtime_1.jsx)("td", { className: "whitespace-nowrap px-4 py-3 align-top text-xs text-slate-300", children: (0, cells_1.formatDateNy)(row.pick_date) })) : null, (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(cells_1.TeamAbbrPill, { abbr: away.abbr ?? 'AWY', variant: "away" }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "at" }), (0, jsx_runtime_1.jsx)(cells_1.TeamAbbrPill, { abbr: home.abbr ?? 'HOME', variant: "home" })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: [awayLabel, " @ ", homeLabel] })] }) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 align-top", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center text-sm text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: selectedLabel }), isHomePick ? (0, jsx_runtime_1.jsx)(cells_1.TeamSideBadge, { side: "home" }) : null, isAwayPick ? (0, jsx_runtime_1.jsx)(cells_1.TeamSideBadge, { side: "away" }) : null] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: selectedAbbr ?? '—' })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top text-sm", children: outcome.className.startsWith('rounded-full') ? ((0, jsx_runtime_1.jsx)("span", { className: outcome.className, children: outcome.label })) : ((0, jsx_runtime_1.jsx)("span", { className: outcome.className, children: outcome.label })) }), showChangesColumn ? ((0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top text-sm text-slate-200", children: changes })) : null, showTimestampsColumn ? ((0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 align-top text-xs text-slate-300", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Created: ", created] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Updated: ", updated] })] })) : null] }, `${row.game_id}-${row.selected_team_id}`));
                            }) })] }) }))] }));
};
exports.PicksTeamsTable = PicksTeamsTable;
