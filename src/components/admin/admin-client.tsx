'use client';

import clsx from 'clsx';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import useSWR from 'swr';

import {
  adjustUserBalanceAction,
  assignCardAction,
  revokeCardAction,
  saveHighlightsAction,
} from '@/app/[locale]/admin/actions';
import { useGames } from '@/hooks/useGames';
import type { Locale } from '@/lib/constants';
import type { Dictionary } from '@/locales/dictionaries';

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to load data');
  }
  return response.json();
};

const fullName = (p?: { first_name?: string | null; last_name?: string | null }) =>
  [p?.first_name ?? '', p?.last_name ?? ''].join(' ').trim() || '—';

const fmtMatchup = (g?: {
  away_team_abbr?: string | null;
  home_team_abbr?: string | null;
}) => `${g?.away_team_abbr ?? 'AWY'} @ ${g?.home_team_abbr ?? 'HOME'}`;

const TeamBadge = ({ kind }: { kind: 'HOME' | 'AWAY' }) => (
  <span
    className={`ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
      kind === 'HOME'
        ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
        : 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30'
    }`}
  >
    {kind}
  </span>
);

interface ShopCard {
  id: string;
  name: string;
  rarity: string;
  price: number;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  anima_points_balance: number;
  role: string;
  user_cards?: Array<{ card: ShopCard | null }>;
}

interface HighlightResult {
  player_id: string;
  rank: number;
  result_date: string;
}

interface PicksPreviewTeam {
  game_id: string;
  selected_team_id: string;
  game?: {
    id?: string | null;
    home_team_abbr: string | null;
    away_team_abbr: string | null;
    home_team_name: string | null;
    away_team_name: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
  } | null;
}

interface PicksPreviewPlayer {
  game_id: string;
  category: string;
  player_id?: string;
  player?: {
    first_name?: string | null;
    last_name?: string | null;
    position?: string | null;
  } | null;
  game?: {
    id?: string | null;
    home_team_name?: string | null;
    home_team_abbr?: string | null;
    home_team_id?: string | null;
    away_team_name?: string | null;
    away_team_abbr?: string | null;
    away_team_id?: string | null;
  } | null;
}

interface PicksPreviewHighlight {
  player_id?: string;
  rank: number;
  player?: {
    first_name?: string | null;
    last_name?: string | null;
    position?: string | null;
  } | null;
}

interface PicksPreview {
  pickDate: string;
  teams: PicksPreviewTeam[];
  players: PicksPreviewPlayer[];
  highlights: PicksPreviewHighlight[];
}

interface AdminClientProps {
  locale: Locale;
  dictionary: Dictionary;
  users: AdminUser[];
  shopCards: ShopCard[];
  highlights: HighlightResult[];
}

export const AdminClient = ({
  locale,
  dictionary,
  users,
  shopCards,
  highlights,
}: AdminClientProps) => {
  const [activeTab, setActiveTab] = useState<'users' | 'picks' | 'highlights'>(
    'users',
  );
  const [search, setSearch] = useState('');
  const [adjustPending, startAdjust] = useTransition();
  const [cardPending, startCardTransition] = useTransition();
  const [highlightPending, startHighlight] = useTransition();
  const [selectedUser, setSelectedUser] = useState<string>(
    users[0]?.id ?? '',
  );
  const [selectedCard, setSelectedCard] = useState<Record<string, string>>({});
  const [picksDate, setPicksDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [highlightDate, setHighlightDate] = useState(
    highlights[0]?.result_date ?? new Date().toISOString().slice(0, 10),
  );
  const [highlightForm, setHighlightForm] = useState<
    Array<{ rank: number; playerId: string }>
  >(
    highlights.map((entry) => ({
      rank: entry.rank,
      playerId: entry.player_id,
    })),
  );

  const filteredUsers = useMemo(() => {
    if (!search.trim()) {
      return users;
    }
    const query = search.toLowerCase();
    return users.filter((user) =>
      [user.full_name ?? '', user.email]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [users, search]);

  const { data: picksPreview, isLoading: picksLoading } = useSWR<PicksPreview>(
    selectedUser
      ? `/api/picks?date=${picksDate}&userId=${selectedUser}`
      : null,
    fetcher,
  );

  const gameById = useMemo(() => {
    const map = new Map<
      string,
      {
        id?: string | null;
        home_team_name?: string | null;
        home_team_abbr?: string | null;
        home_team_id?: string | null;
        away_team_name?: string | null;
        away_team_abbr?: string | null;
        away_team_id?: string | null;
      }
    >();
    (picksPreview?.teams ?? []).forEach((team) => {
      const record = team as any;
      const game = record.game;
      const key =
        (typeof game?.id === 'string' && game.id) ||
        (typeof team.game_id === 'string' && team.game_id) ||
        null;
      if (key && game) {
        map.set(key, game);
      }
    });
    (picksPreview?.players ?? []).forEach((player) => {
      const record = player as any;
      const game = record.game;
      const key =
        (typeof game?.id === 'string' && game.id) ||
        (typeof player.game_id === 'string' && player.game_id) ||
        null;
      if (key && game) {
        map.set(key, game);
      }
    });
    return map;
  }, [picksPreview?.teams, picksPreview?.players]);

  const { games } = useGames(locale);
  const [highlightOptions, setHighlightOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);

  useEffect(() => {
    if (activeTab !== 'highlights' || games.length === 0) {
      return;
    }

    let cancelled = false;

    const loadPlayers = async () => {
      try {
        const results = await Promise.all(
          games.map((game) =>
            fetch(`/api/players?gameId=${game.id}`)
              .then((response) => (response.ok ? response.json() : []))
              .catch(() => []),
          ),
        );

        if (cancelled) {
          return;
        }

        const unique = new Map<string, string>();
        (results.flat() as Array<{ id: string; fullName: string }>)
          .forEach((player) => {
            if (!unique.has(player.id)) {
              unique.set(player.id, player.fullName ?? player.id);
            }
          });

        setHighlightOptions(
          Array.from(unique.entries()).map(([id, label]) => ({ id, label })),
        );
      } catch (error) {
        console.error('Failed to load highlight players', error);
      }
    };

    loadPlayers();

    return () => {
      cancelled = true;
    };
  }, [activeTab, games]);

  const handleBalanceAdjust = (userId: string, delta: number) => {
    startAdjust(() =>
      adjustUserBalanceAction({ userId, delta, locale }).catch((error) => {
        console.error('Failed to adjust balance', error);
      }),
    );
  };

  const handleAssignCard = (userId: string) => {
    const cardId = selectedCard[userId];
    if (!cardId) return;
    startCardTransition(() =>
      assignCardAction({ userId, cardId, locale }).catch((error) => {
        console.error('Failed to assign card', error);
      }),
    );
  };

  const handleRevokeCard = (userId: string, cardId: string) => {
    startCardTransition(() =>
      revokeCardAction({ userId, cardId, locale }).catch((error) => {
        console.error('Failed to revoke card', error);
      }),
    );
  };

  const handleHighlightChange = (rank: number, playerId: string) => {
    setHighlightForm((previous) => {
      const filtered = previous.filter((entry) => entry.rank !== rank);
      if (!playerId) {
        return filtered;
      }
      filtered.push({ rank, playerId });
      return filtered.sort((a, b) => a.rank - b.rank);
    });
  };

  const handleHighlightsSave = () => {
    const payload = highlightForm.filter((entry) => entry.playerId);
    startHighlight(() =>
      saveHighlightsAction({
        date: highlightDate,
        highlights: payload,
        locale,
      }).catch((error) => {
        console.error('Failed to save highlights', error);
      }),
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        {['users', 'picks', 'highlights'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={clsx(
              'rounded-full border px-4 py-2 text-sm font-semibold transition',
              activeTab === tab
                ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/30',
            )}
          >
            {tab === 'users'
              ? dictionary.admin.usersTab
              : tab === 'picks'
                ? dictionary.admin.picksTab
                : dictionary.admin.highlightsTab}
          </button>
        ))}
      </header>

      {activeTab === 'users' ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold text-white">
              {dictionary.admin.usersTab}
            </h2>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={dictionary.admin.searchPlaceholder}
              className="w-full max-w-xs rounded-full border border-white/10 bg-navy-800/70 px-4 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-navy-900/80 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">{dictionary.admin.usersTab}</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">{dictionary.admin.balance}</th>
                  <th className="px-4 py-3 text-left">{dictionary.admin.cards}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-slate-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">
                          {user.full_name ?? '—'}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span>{user.anima_points_balance}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleBalanceAdjust(user.id, 50)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent-gold/40 text-accent-gold hover:bg-accent-gold/10"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBalanceAdjust(user.id, -50)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-300 hover:border-accent-gold/40"
                          >
                            —
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {(user.user_cards ?? [])
                          .map((record) => record.card)
                          .filter(Boolean)
                          .map((card) => (
                            <span
                              key={`${user.id}-${card!.id}`}
                              className="flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-xs"
                            >
                              {card!.name}
                              <button
                                type="button"
                                onClick={() => handleRevokeCard(user.id, card!.id)}
                                className="text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedCard[user.id] ?? ''}
                          onChange={(event) =>
                            setSelectedCard((previous) => ({
                              ...previous,
                              [user.id]: event.target.value,
                            }))
                          }
                          className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-xs text-white focus:border-accent-gold focus:outline-none"
                        >
                          <option value="">{dictionary.shop.title}</option>
                          {shopCards.map((card) => (
                            <option key={card.id} value={card.id}>
                              {card.name} · {card.rarity}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAssignCard(user.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold text-accent-gold hover:border-accent-gold"
                        >
                          <Pencil className="h-3 w-3" />
                          {dictionary.shop.buy}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {adjustPending || cardPending ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Syncing changes…</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'picks' ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
                className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name ?? user.email}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={picksDate}
                onChange={(event) => setPicksDate(event.target.value)}
                className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
              />
            </div>
          </div>
          {picksLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{dictionary.common.loading}</span>
            </div>
          ) : picksPreview ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-white">Teams</h3>
                  <div className="space-y-2 text-sm">
                    {(picksPreview.teams ?? []).map((team, index) => {
                      const record = team as any;
                      const key =
                        (typeof record.game?.id === 'string' && record.game.id) ||
                        (typeof team.game_id === 'string' && team.game_id) ||
                        undefined;
                      const game = record.game ?? (key ? gameById.get(key) : undefined);
                      const isHome =
                        Boolean(game?.home_team_id) &&
                        team.selected_team_id === game?.home_team_id;
                      const isAway =
                        Boolean(game?.away_team_id) &&
                        team.selected_team_id === game?.away_team_id;
                      const chosenAbbr = isHome
                        ? game?.home_team_abbr ?? 'HOME'
                        : isAway
                          ? game?.away_team_abbr ?? 'AWY'
                          : '???';
                      const chosenName = isHome
                        ? game?.home_team_name ?? 'Home team'
                        : isAway
                          ? game?.away_team_name ?? 'Away team'
                          : 'Unknown team';

                      return (
                        <div key={`${team.game_id}-${index}`} className="rounded border border-white/10 p-2">
                          <div className="text-slate-300">{fmtMatchup(game)}</div>
                          <div className="mt-1 text-slate-100">
                            <strong className="mr-2">{chosenAbbr}</strong>
                            <span className="opacity-90">{chosenName}</span>
                            {isHome ? <TeamBadge kind="HOME" /> : null}
                            {isAway ? <TeamBadge kind="AWAY" /> : null}
                            {!isHome && !isAway ? (
                              <span className="ml-2 text-[11px] text-amber-300/80">
                                not matching home/away
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {(picksPreview.teams?.length ?? 0) === 0 ? (
                      <div className="text-slate-400">No team picks.</div>
                    ) : null}
                  </div>
                </section>
              </div>
              <div className="space-y-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-white">Players</h3>
                  <div className="space-y-2 text-sm text-slate-200">
                    {(picksPreview.players ?? []).map((player, index) => {
                      const record = player as any;
                      const game = record.game ?? gameById.get(player.game_id);
                      const name = fullName(record.player);
                      return (
                        <div key={`${player.game_id}-${player.category}-${index}`} className="rounded-xl bg-navy-800/70 px-3 py-2">
                          <div className="text-xs opacity-70">{fmtMatchup(game)}</div>
                          <div>
                            <span className="mr-2 text-xs uppercase opacity-70">
                              {player.category}
                            </span>
                            <strong>{name}</strong>
                            {record.player?.position ? (
                              <span className="text-xs opacity-60"> · {record.player.position}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {(picksPreview.players?.length ?? 0) === 0 ? (
                      <div className="rounded-xl bg-navy-800/70 px-3 py-2 text-xs text-slate-400">
                        No player picks.
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
              <div className="space-y-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4 md:col-span-2">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-white">
                    {dictionary.common.highlights}
                  </h3>
                  <div className="space-y-1 text-sm text-slate-200">
                    {(picksPreview.highlights ?? []).map((highlight, index) => {
                      const record = highlight as any;
                      const name = fullName(record.player);
                      return (
                        <div key={`${highlight.rank}-${index}`} className="rounded-xl bg-navy-800/70 px-3 py-2">
                          <span className="mr-2 text-xs uppercase opacity-70">
                            RANK #{highlight.rank}
                          </span>
                          <strong>{name}</strong>
                          {record.player?.position ? (
                            <span className="text-xs opacity-60"> · {record.player.position}</span>
                          ) : null}
                        </div>
                      );
                    })}
                    {(picksPreview.highlights?.length ?? 0) === 0 ? (
                      <div className="rounded-xl bg-navy-800/70 px-3 py-2 text-xs text-slate-400">
                        No highlight picks.
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-300">Nessun pick registrato.</p>
          )}
        </section>
      ) : null}

      {activeTab === 'highlights' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={highlightDate}
              onChange={(event) => setHighlightDate(event.target.value)}
              className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 10 }).map((_, index) => {
              const rank = index + 1;
              const selected = highlightForm.find((entry) => entry.rank === rank)?.playerId ?? '';
              return (
                <label key={rank} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4 text-xs text-slate-300">
                  <span className="font-semibold text-white">#{rank}</span>
                  <select
                    value={selected}
                    onChange={(event) => handleHighlightChange(rank, event.target.value)}
                    className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
                  >
                    <option value="">—</option>
                    {highlightOptions.map((option) => (
                      <option key={`${rank}-${option.id}`} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleHighlightsSave}
            className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 px-4 py-2 text-sm font-semibold text-accent-gold hover:border-accent-gold"
            disabled={highlightPending}
          >
            {highlightPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {dictionary.admin.applyHighlights}
          </button>
        </section>
      ) : null}
    </div>
  );
};
