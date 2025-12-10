"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminStorageDashboard = AdminStorageDashboard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const supabaseClient_1 = __importDefault(require("../lib/supabaseClient"));
const formatNumber = (value) => typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('it-IT')
    : '—';
const formatMegabytes = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
    }
    return `${value.toFixed(2)} MB`;
};
const EXPORT_TABLES = [
    { name: 'games', column: 'game_date', type: 'date' },
    { name: 'picks_players', column: 'created_at', type: 'timestamp' },
    { name: 'picks_teams', column: 'created_at', type: 'timestamp' },
    { name: 'picks_teams_expanded', column: 'pick_date', type: 'date' },
    { name: 'results_players', column: 'settled_at', type: 'timestamp' },
    { name: 'results_team', column: 'settled_at', type: 'timestamp' },
    { name: 'weekly_xp_events', column: 'created_at', type: 'timestamp' },
];
const rowsToCsv = (rows) => {
    if (!rows.length) {
        return '';
    }
    const headers = Array.from(rows.reduce((acc, row) => {
        Object.keys(row).forEach((key) => acc.add(key));
        return acc;
    }, new Set()));
    const lines = [
        headers.join(','),
        ...rows.map((row) => headers
            .map((header) => JSON.stringify(row[header] ?? ''))
            .join(',')),
    ];
    return lines.join('\n');
};
function AdminStorageDashboard() {
    const [rows, setRows] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [cleaning, setCleaning] = (0, react_1.useState)(false);
    const [exporting, setExporting] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const fetchData = (0, react_1.useCallback)(async ({ preserveMessage = false } = {}) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabaseClient_1.default.rpc('get_table_sizes');
            if (error) {
                throw error;
            }
            setRows(data ?? []);
            if (!preserveMessage) {
                const nowLabel = new Intl.DateTimeFormat('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                }).format(new Date());
                setMessage(`Dati aggiornati alle ${nowLabel}`);
            }
        }
        catch (err) {
            console.error('Failed to load table sizes', err);
            const detail = err && typeof err === 'object' && 'message' in err && err.message
                ? String(err.message)
                : undefined;
            setError(detail ?? 'Impossibile caricare i dati dello storage.');
        }
        finally {
            setLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        void fetchData();
    }, [fetchData]);
    const handleCleanup = (0, react_1.useCallback)(async () => {
        setCleaning(true);
        setError(null);
        setMessage(null);
        try {
            const { error } = await supabaseClient_1.default.rpc('clean_old_game_data');
            if (error) {
                throw error;
            }
            await fetchData({ preserveMessage: true });
            setMessage('Cleanup completato e dati aggiornati.');
        }
        catch (err) {
            console.error('Failed to clean data', err);
            const detail = err && typeof err === 'object' && 'message' in err && err.message
                ? String(err.message)
                : undefined;
            setError(detail ?? 'Errore durante il cleanup.');
        }
        finally {
            setCleaning(false);
        }
    }, [fetchData]);
    const handleExport = (0, react_1.useCallback)(async () => {
        const confirmed = typeof window !== 'undefined' ? window.confirm('Esportare i dati più vecchi di 14 giorni in archive?') : false;
        if (!confirmed) {
            return;
        }
        setExporting(true);
        setError(null);
        setMessage(null);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);
        const cutoffDate = cutoff.toISOString().slice(0, 10);
        const cutoffTimestamp = cutoff.toISOString();
        try {
            for (const table of EXPORT_TABLES) {
                const filterValue = table.type === 'date' ? cutoffDate : cutoffTimestamp;
                const { data, error } = await supabaseClient_1.default
                    // Some tables/views might be missing from generated types; cast to keep TS happy.
                    .from(table.name)
                    .select('*')
                    .lt(table.column, filterValue);
                if (error) {
                    throw new Error(`Errore nel recupero di ${table.name}: ${error.message}`);
                }
                const rows = (data ?? []);
                const csv = rowsToCsv(rows);
                const fileName = `${table.name}-${cutoffDate}.csv`;
                const { error: uploadError } = await supabaseClient_1.default.storage
                    .from('archive')
                    .upload(fileName, new Blob([csv], { type: 'text/csv' }), {
                    upsert: true,
                });
                if (uploadError) {
                    throw new Error(`Errore nel caricamento di ${fileName}: ${uploadError.message}`);
                }
            }
            setMessage(`Esportazione completata nel bucket archive (cutoff ${cutoffDate}).`);
        }
        catch (err) {
            console.error('Failed to export archive', err);
            const detail = err && typeof err === 'object' && 'message' in err && err.message
                ? String(err.message)
                : undefined;
            setError(detail ?? 'Errore durante l\'esportazione in archive.');
        }
        finally {
            setExporting(false);
        }
    }, []);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-navy-900/70 p-4 text-slate-200 shadow-lg sm:p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: "Storage Supabase" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Dimensioni tabelle e cleanup dei dati storici." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => fetchData(), disabled: loading || cleaning || exporting, className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-navy-800/80 px-4 py-2 text-xs font-semibold text-white transition hover:border-accent-gold/40 hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-60", children: [loading ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4" })), "Ricarica dati"] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleCleanup, disabled: cleaning || loading || exporting, className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-rose-900/60 px-4 py-2 text-xs font-semibold text-white transition hover:border-rose-300/60 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60", children: [cleaning ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-4 w-4" })), "Esegui cleanup ora"] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleExport, disabled: exporting || cleaning || loading, className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-emerald-900/60 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300/60 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60", children: [exporting ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Archive, { className: "h-4 w-4" })), "Esporta >14 giorni in archive"] })] })] }), error ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 inline-flex w-full items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-900/40 px-4 py-3 text-sm text-rose-100", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertCircle, { className: "h-4 w-4 flex-none" }), (0, jsx_runtime_1.jsx)("span", { children: error })] })) : null, message ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-3 inline-flex w-full items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-4 w-4 flex-none" }), (0, jsx_runtime_1.jsx)("span", { children: message })] })) : null, (0, jsx_runtime_1.jsx)("div", { className: "mt-4 overflow-x-auto rounded-xl border border-white/10", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full divide-y divide-white/10 text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-white/5 text-xs uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Tabella" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Dimensione" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Righe stimate" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-white/10 bg-navy-950/50", children: loading ? ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 3, className: "whitespace-nowrap px-4 py-5 text-center text-slate-300", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: "Caricamento dati..." })] }) }) })) : rows.length ? (rows.map((row, index) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "whitespace-nowrap px-4 py-3 font-semibold text-white", children: row.table_name ?? '—' }), (0, jsx_runtime_1.jsx)("td", { className: "whitespace-nowrap px-4 py-3 text-slate-100", children: formatMegabytes(row.total_mb) }), (0, jsx_runtime_1.jsx)("td", { className: "whitespace-nowrap px-4 py-3 text-slate-100", children: formatNumber(row.approx_rows) })] }, row.table_name ?? `table-${index}`)))) : ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 3, className: "whitespace-nowrap px-4 py-4 text-center text-slate-300", children: "Nessun dato disponibile." }) })) })] }) })] }));
}
