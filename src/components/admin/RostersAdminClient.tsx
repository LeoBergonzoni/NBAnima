'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';

export function RostersAdminClient() {
  const [season, setSeason] = useState<string>(String(new Date().getFullYear()));
  const [espnError, setEspnError] = useState<string | null>(null);
  const [espnLoading, setEspnLoading] = useState(false);
  const [espnData, setEspnData] = useState<
    Array<{
      team: { id: string; abbr: string; name: string };
      players: Array<{ id: string; fullName: string; position: string | null; jersey: string | null }>;
    }>
  >([]);

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
    } catch (err) {
      setEspnData([]);
      setEspnError((err as Error).message ?? 'ESPN fetch failed');
    } finally {
      setEspnLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Preview rosters da ESPN</h2>
            <p className="text-sm text-slate-300">
              Non salva nulla: scarica e mostra i roster correnti da ESPN (season: {season}).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            Season
            <input
              className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              inputMode="numeric"
              pattern="\\d{4}"
            />
          </label>
          <button
            type="button"
            onClick={handleLoadEspn}
            disabled={espnLoading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-indigo-950 shadow hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-800 disabled:text-indigo-200"
          >
            <RotateCw className={`h-4 w-4 ${espnLoading ? 'animate-spin' : ''}`} />
            {espnLoading ? 'Carico...' : 'Carica da ESPN'}
          </button>
        </div>
        {espnError ? (
          <div className="rounded-md border border-amber-400/40 bg-amber-950/60 px-4 py-3 text-sm text-amber-100">
            {espnError}
          </div>
        ) : null}
        {espnData.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {espnData.map((team) => (
              <div key={team.team.id} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{team.team.abbr}</p>
                    <h3 className="text-base font-semibold text-white">{team.team.name}</h3>
                  </div>
                  <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-100">
                    {team.players.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-200 max-h-64 overflow-y-auto">
                  {team.players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-white/5">
                      <span className="truncate">{p.fullName || p.id}</span>
                      <span className="text-[11px] uppercase text-slate-400">{p.position ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nessun dato ESPN caricato.</p>
        )}
      </section>
    </div>
  );
}
