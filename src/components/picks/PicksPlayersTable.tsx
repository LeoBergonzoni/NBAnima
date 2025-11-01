'use client';

import clsx from 'clsx';
import { useMemo } from 'react';

import {
  TeamAbbrPill,
  formatDateNy,
  formatDateTimeNy,
  combineName,
} from './cells';

export interface PlayerPickRow {
  game_id: string;
  category: string;
  player_id: string;
  pick_date?: string | null;
  changes_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  player?: {
    first_name?: string | null;
    last_name?: string | null;
    position?: string | null;
    team_abbr?: string | null;
  } | null;
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

const sortRows = (rows: PlayerPickRow[]) =>
  [...rows].sort((a, b) => {
    const dateCompare = (b.pick_date ?? '').localeCompare(a.pick_date ?? '');
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });

export interface PicksPlayersTableProps {
  rows: PlayerPickRow[];
  title?: string;
  emptyMessage?: string;
  className?: string;
  formatCategory?: (category: string) => string;
}

export const PicksPlayersTable = ({
  rows,
  title = 'Players',
  emptyMessage = 'No player picks.',
  className,
  formatCategory,
}: PicksPlayersTableProps) => {
  const sortedRows = useMemo(() => sortRows(rows), [rows]);

  const formatCategoryLabel = useMemo(
    () =>
      formatCategory ??
      ((category: string) =>
        category
          .split('_')
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join(' ')),
    [formatCategory],
  );

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
                  Categoria / Posizione
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Giocatore
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Matchup
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
                const homeAbbr = row.game?.home_team_abbr ?? null;
                const awayAbbr = row.game?.away_team_abbr ?? null;
                const homeName = row.game?.home_team_name ?? homeAbbr ?? 'HOME';
                const awayName = row.game?.away_team_name ?? awayAbbr ?? 'AWAY';
                const baseName = combineName(
                  row.player?.first_name,
                  row.player?.last_name,
                );
                const playerName = baseName === '—' ? row.player_id : baseName;
                const changes = row.changes_count ?? 0;

                return (
                  <tr key={`${row.game_id}-${row.category}-${row.player_id}`}>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-300">
                      {formatDateNy(row.pick_date)}
                    </td>
                    <td className="px-4 py-3 align-top text-xs uppercase tracking-wide text-slate-300">
                      <div className="font-semibold text-white">
                        {formatCategoryLabel(row.category)}
                      </div>
                      {row.player?.position ? (
                        <div className="text-[11px] text-slate-400">
                          {row.player.position}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-white">{playerName}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          {row.player?.team_abbr ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <TeamAbbrPill abbr={awayAbbr ?? 'AWY'} variant="away" />
                          <span className="text-[11px] uppercase text-slate-500">at</span>
                          <TeamAbbrPill abbr={homeAbbr ?? 'HOME'} variant="home" />
                        </div>
                        <p className="text-xs text-slate-400">
                          {awayName} @ {homeName}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-slate-200">
                      {changes}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      <div>Created: {formatDateTimeNy(row.created_at)}</div>
                      <div>Updated: {formatDateTimeNy(row.updated_at)}</div>
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
