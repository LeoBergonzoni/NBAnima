'use client';

import clsx from 'clsx';
import { useMemo } from 'react';

import {
  TeamAbbrPill,
  TeamSideBadge,
  combineName,
  formatDateNy,
  formatDateTimeNy,
  matchesTeamIdentity,
} from './cells';

export interface TeamPickRow {
  game_id: string;
  selected_team_id: string;
  selected_team_abbr?: string | null;
  selected_team_name?: string | null;
  pick_date?: string | null;
  result?: string | null;
  changes_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  game?: {
    id?: string | null;
    home_team_id?: string | null;
    away_team_id?: string | null;
    home_team_abbr?: string | null;
    away_team_abbr?: string | null;
    home_team_name?: string | null;
    away_team_name?: string | null;
  } | null;
}

const outcomeLabel = (value?: string | null) => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) {
    return { label: '—', className: 'text-slate-400' };
  }
  if (normalized === 'win' || normalized === 'won') {
    return {
      label: 'Win',
      className:
        'rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-200',
    };
  }
  if (normalized === 'loss' || normalized === 'lost') {
    return {
      label: 'Loss',
      className:
        'rounded-full border border-rose-400/40 bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-200',
    };
  }
  if (normalized === 'pending') {
    return {
      label: 'Pending',
      className:
        'rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200',
    };
  }
  if (normalized === 'push') {
    return {
      label: 'Push',
      className:
        'rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200',
    };
  }
  return { label: value ?? '—', className: 'text-slate-300' };
};

const sortRows = (rows: TeamPickRow[]) =>
  [...rows].sort((a, b) => {
    const dateCompare = (b.pick_date ?? '').localeCompare(a.pick_date ?? '');
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });

export interface PicksTeamsTableProps {
  rows: TeamPickRow[];
  title?: string;
  emptyMessage?: string;
  className?: string;
}

export const PicksTeamsTable = ({
  rows,
  title = 'Teams',
  emptyMessage = 'No team picks.',
  className,
}: PicksTeamsTableProps) => {
  const sortedRows = useMemo(() => sortRows(rows), [rows]);

  return (
    <section
      className={clsx(
        'space-y-3 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card',
        className,
      )}
    >
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      {sortedRows.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Data (NY)
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Matchup
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Scelta
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Esito
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Changes
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Created / Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-[13px] text-slate-200">
              {sortedRows.map((row) => {
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

                const isHomePick = matchesTeamIdentity(selected, home);
                const isAwayPick = matchesTeamIdentity(selected, away);
                const selectedAbbr =
                  selected.abbr ?? (isHomePick ? home.abbr : isAwayPick ? away.abbr : null);
                const selectedName =
                  selected.name ?? (isHomePick ? home.name : isAwayPick ? away.name : null);
                const selectedLabel = selectedName ?? row.selected_team_id ?? '—';

                const homeLabel = combineName(home.name, null, home.abbr ?? 'HOME');
                const awayLabel = combineName(away.name, null, away.abbr ?? 'AWAY');

                const outcome = outcomeLabel(row.result);
                const changes = row.changes_count ?? 0;
                const created = formatDateTimeNy(row.created_at);
                const updated = formatDateTimeNy(row.updated_at);

                return (
                  <tr key={`${row.game_id}-${row.selected_team_id}`}>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-300">
                      {formatDateNy(row.pick_date)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <TeamAbbrPill abbr={away.abbr ?? 'AWY'} variant="away" />
                          <span className="text-[11px] uppercase text-slate-500">at</span>
                          <TeamAbbrPill abbr={home.abbr ?? 'HOME'} variant="home" />
                        </div>
                        <p className="text-xs text-slate-400">
                          {awayLabel} @ {homeLabel}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center text-sm text-white">
                        <span className="font-semibold">{selectedLabel}</span>
                        {isHomePick ? <TeamSideBadge side="home" /> : null}
                        {isAwayPick ? <TeamSideBadge side="away" /> : null}
                      </div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {selectedAbbr ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-sm">
                      {outcome.className.startsWith('rounded-full') ? (
                        <span className={outcome.className}>{outcome.label}</span>
                      ) : (
                        <span className={outcome.className}>{outcome.label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-slate-200">{changes}</td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      <div>Created: {created}</div>
                      <div>Updated: {updated}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
