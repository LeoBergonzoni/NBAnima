'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import supabase from '../lib/supabaseClient';
import type { Database } from '../lib/supabase.types';

type TableSizeRow = {
  table_name: string | null;
  total_mb: number | null;
  approx_rows: number | null;
};

const formatNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('it-IT')
    : '—';

const formatMegabytes = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return `${value.toFixed(2)} MB`;
};

type KnownTable = keyof Database['public']['Tables'];
type ExportableTable = KnownTable | 'picks_teams_expanded' | 'weekly_xp_events';

type ExportTableConfig = {
  name: ExportableTable;
  column: string;
  type: 'date' | 'timestamp';
};

const EXPORT_TABLES: ExportTableConfig[] = [
  { name: 'games', column: 'game_date', type: 'date' },
  { name: 'picks_players', column: 'created_at', type: 'timestamp' },
  { name: 'picks_teams', column: 'created_at', type: 'timestamp' },
  { name: 'picks_teams_expanded', column: 'pick_date', type: 'date' },
  { name: 'results_players', column: 'settled_at', type: 'timestamp' },
  { name: 'results_team', column: 'settled_at', type: 'timestamp' },
  { name: 'weekly_xp_events', column: 'created_at', type: 'timestamp' },
];

const rowsToCsv = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) {
    return '';
  }
  const headers = Array.from(
    rows.reduce<Set<string>>((acc, row) => {
      Object.keys(row).forEach((key) => acc.add(key));
      return acc;
    }, new Set<string>()),
  );
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => JSON.stringify(row[header] ?? ''))
        .join(','),
    ),
  ];
  return lines.join('\n');
};

export function AdminStorageDashboard() {
  const [rows, setRows] = useState<TableSizeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(
    async ({ preserveMessage = false }: { preserveMessage?: boolean } = {}) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase.rpc('get_table_sizes');
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
      } catch (err) {
        console.error('Failed to load table sizes', err);
        const detail =
          err && typeof err === 'object' && 'message' in err && err.message
            ? String(err.message)
            : undefined;
        setError(detail ?? 'Impossibile caricare i dati dello storage.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('clean_old_game_data');
      if (error) {
        throw error;
      }
      await fetchData({ preserveMessage: true });
      setMessage('Cleanup completato e dati aggiornati.');
    } catch (err) {
      console.error('Failed to clean data', err);
      const detail =
        err && typeof err === 'object' && 'message' in err && err.message
          ? String(err.message)
          : undefined;
      setError(detail ?? 'Errore durante il cleanup.');
    } finally {
      setCleaning(false);
    }
  }, [fetchData]);

  const handleExport = useCallback(async () => {
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
        const filterValue =
          table.type === 'date' ? cutoffDate : cutoffTimestamp;
        const { data, error } = await supabase
          // Some tables/views might be missing from generated types; cast to keep TS happy.
          .from(table.name as KnownTable)
          .select('*')
          .lt(table.column, filterValue);
        if (error) {
          throw new Error(
            `Errore nel recupero di ${table.name}: ${error.message}`,
          );
        }
        const rows = (data ?? []) as Record<string, unknown>[];
        const csv = rowsToCsv(rows);
        const fileName = `${table.name}-${cutoffDate}.csv`;
        const { error: uploadError } = await supabase.storage
          .from('archive')
          .upload(fileName, new Blob([csv], { type: 'text/csv' }), {
            upsert: true,
          });
        if (uploadError) {
          throw new Error(
            `Errore nel caricamento di ${fileName}: ${uploadError.message}`,
          );
        }
      }

      setMessage(
        `Esportazione completata nel bucket archive (cutoff ${cutoffDate}).`,
      );
    } catch (err) {
      console.error('Failed to export archive', err);
      const detail =
        err && typeof err === 'object' && 'message' in err && err.message
          ? String(err.message)
          : undefined;
      setError(detail ?? 'Errore durante l\'esportazione in archive.');
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-navy-900/70 p-4 text-slate-200 shadow-lg sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Storage Supabase</h3>
          <p className="text-sm text-slate-400">
            Dimensioni tabelle e cleanup dei dati storici.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading || cleaning || exporting}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-navy-800/80 px-4 py-2 text-xs font-semibold text-white transition hover:border-accent-gold/40 hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Ricarica dati
          </button>
          <button
            type="button"
            onClick={handleCleanup}
            disabled={cleaning || loading || exporting}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-rose-900/60 px-4 py-2 text-xs font-semibold text-white transition hover:border-rose-300/60 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cleaning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Esegui cleanup ora
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || cleaning || loading}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-emerald-900/60 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300/60 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Esporta &gt;14 giorni in archive
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 inline-flex w-full items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-900/40 px-4 py-3 text-sm text-rose-100">
          <AlertCircle className="h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 inline-flex w-full items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span>{message}</span>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Tabella</th>
              <th className="px-4 py-3 text-left">Dimensione</th>
              <th className="px-4 py-3 text-left">Righe stimate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-navy-950/50">
            {loading ? (
              <tr>
                <td
                  colSpan={3}
                  className="whitespace-nowrap px-4 py-5 text-center text-slate-300"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Caricamento dati...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row, index) => (
                <tr key={row.table_name ?? `table-${index}`}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-white">
                    {row.table_name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-100">
                    {formatMegabytes(row.total_mb)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-100">
                    {formatNumber(row.approx_rows)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="whitespace-nowrap px-4 py-4 text-center text-slate-300"
                >
                  Nessun dato disponibile.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
