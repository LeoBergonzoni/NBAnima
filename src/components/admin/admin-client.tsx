'use client';

import clsx from 'clsx';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import useSWR from 'swr';

import {
  adjustUserBalanceAction,
  assignCardAction,
  revokeCardAction,
  saveHighlightsAction,
  loadTeamWinners,
  loadPlayerWinners,
  publishTeamWinners,
  publishPlayerWinners,
  type LoadTeamWinnersResult,
  type LoadPlayerWinnersResult,
} from '@/app/[locale]/admin/actions';
import { PicksPlayersTable } from '@/components/picks/PicksPlayersTable';
import { PicksTeamsTable } from '@/components/picks/PicksTeamsTable';
import {
  PlayerSelect,
  type PlayerSelectResult,
} from '@/components/admin/PlayerSelect';
import { ADMIN_POINT_STEP } from '@/lib/admin';
import { TIMEZONES, type Locale } from '@/lib/constants';
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
  selected_team_abbr?: string | null;
  selected_team_name?: string | null;
  pick_date?: string | null;
  changes_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  result?: string | null;
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

const ADMIN_TABS = [
  'users',
  'picks',
  'winnersTeams',
  'winnersPlayers',
  'highlights',
] as const;

type AdminTab = (typeof ADMIN_TABS)[number];

type HighlightFormEntry = {
  rank: number;
  playerId: string;
  player?: PlayerSelectResult | null;
};

type PlayerWinnerOverridesState = Record<
  string,
  Record<string, PlayerSelectResult | null>
>;

export const AdminClient = ({
  locale,
  dictionary,
  users,
  shopCards,
  highlights,
}: AdminClientProps) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [search, setSearch] = useState('');
  const [adjustPending, startAdjust] = useTransition();
  const [cardPending, startCardTransition] = useTransition();
  const [highlightPending, startHighlight] = useTransition();
  const [publishTeamsPending, startPublishTeams] = useTransition();
  const [publishPlayersPending, startPublishPlayers] = useTransition();
  const [selectedUser, setSelectedUser] = useState<string>(users[0]?.id ?? '');
  const [selectedCard, setSelectedCard] = useState<Record<string, string>>({});
  const [picksDate, setPicksDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [highlightDate, setHighlightDate] = useState(
    highlights[0]?.result_date ?? new Date().toISOString().slice(0, 10),
  );
  const [highlightForm, setHighlightForm] = useState<HighlightFormEntry[]>(
    highlights.map((entry) => ({
      rank: entry.rank,
      playerId: entry.player_id,
    })),
  );
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const defaultWinnersDate = useMemo(
    () =>
      formatInTimeZone(
        subDays(new Date(), 1),
        TIMEZONES.US_EASTERN,
        'yyyy-MM-dd',
      ),
    [],
  );

  const winnersDateOptions = useMemo(() => {
    const base = Array.from({ length: 14 }, (_, index) =>
      formatInTimeZone(
        subDays(new Date(), index + 1),
        TIMEZONES.US_EASTERN,
        'yyyy-MM-dd',
      ),
    );
    if (!base.includes(defaultWinnersDate)) {
      base.unshift(defaultWinnersDate);
    }
    return Array.from(new Set(base));
  }, [defaultWinnersDate]);

  const [winnersDate, setWinnersDate] = useState(defaultWinnersDate);
  const [teamWinnerOverrides, setTeamWinnerOverrides] = useState<
    Record<string, string>
  >({});
  const [playerWinnerOverrides, setPlayerWinnerOverrides] =
    useState<PlayerWinnerOverridesState>({});

  useEffect(() => {
    if (!statusMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

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

  const teamWinnersKey = useMemo(
    () =>
      winnersDate
        ? (['admin-team-winners', winnersDate] as const)
        : null,
    [winnersDate],
  );
  const playerWinnersKey = useMemo(
    () =>
      winnersDate
        ? (['admin-player-winners', winnersDate] as const)
        : null,
    [winnersDate],
  );

  const {
    data: teamWinnersData,
    isLoading: teamWinnersLoading,
    mutate: mutateTeamWinners,
    error: teamWinnersError,
  } = useSWR<LoadTeamWinnersResult>(
    teamWinnersKey,
    ([, date]) => loadTeamWinners(date),
    { revalidateOnFocus: false },
  );

  const {
    data: playerWinnersData,
    isLoading: playerWinnersLoading,
    mutate: mutatePlayerWinners,
    error: playerWinnersError,
  } = useSWR<LoadPlayerWinnersResult>(
    playerWinnersKey,
    ([, date]) => loadPlayerWinners(date),
    { revalidateOnFocus: false },
  );

  const baseTeamSelections = useMemo(() => {
    if (!teamWinnersData) {
      return {} as Record<string, string>;
    }
    return teamWinnersData.games.reduce<Record<string, string>>((acc, game) => {
      if (game.winnerTeamId) {
        acc[game.id] = game.winnerTeamId;
      }
      return acc;
    }, {});
  }, [teamWinnersData]);

  const basePlayerSelections = useMemo(() => {
    if (!playerWinnersData) {
      return {} as Record<string, Record<string, string>>;
    }
    return playerWinnersData.games.reduce<
      Record<string, Record<string, string>>
    >((acc, game) => {
      const categories: Record<string, string> = {};
      game.categories.forEach((category) => {
        if (category.winnerPlayerId) {
          categories[category.category] = category.winnerPlayerId;
        }
      });
      acc[game.id] = categories;
      return acc;
    }, {});
  }, [playerWinnersData]);

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
      const record = team as PicksPreviewTeam;
      const game = record.game;
      const key =
        (typeof game?.id === 'string' && game.id) ||
        (typeof record.game_id === 'string' && record.game_id) ||
        null;
      if (key && game) {
        map.set(key, game);
      }
    });
    (picksPreview?.players ?? []).forEach((player) => {
      const record = player as PicksPreviewPlayer;
      const game = record.game;
      const key =
        (typeof game?.id === 'string' && game.id) ||
        (typeof record.game_id === 'string' && record.game_id) ||
        null;
      if (key && game) {
        map.set(key, game);
      }
    });
    return map;
  }, [picksPreview?.teams, picksPreview?.players]);

  const defaultPickDate = picksPreview?.pickDate ?? picksDate;

  const teamTableRows = (picksPreview?.teams ?? []).map((team) => {
    const record = team as PicksPreviewTeam;
    const game =
      record.game ??
      (record.game_id ? gameById.get(record.game_id) : undefined) ??
      null;
    return {
      game_id: record.game_id,
      selected_team_id: record.selected_team_id,
      selected_team_abbr: record.selected_team_abbr ?? null,
      selected_team_name: record.selected_team_name ?? null,
      pick_date: record.pick_date ?? defaultPickDate,
      result: record.result ?? null,
      changes_count: record.changes_count ?? null,
      created_at: record.created_at ?? null,
      updated_at: record.updated_at ?? null,
      game,
    };
  });

  const playerTableRows = (picksPreview?.players ?? []).map((player) => {
    const record = player as PicksPreviewPlayer;
    const game =
      record.game ??
      (record.game_id ? gameById.get(record.game_id) : undefined) ??
      null;
    return {
      game_id: record.game_id,
      category: record.category,
      player_id: record.player_id ?? 'unknown',
      pick_date: record.pick_date ?? defaultPickDate,
      changes_count: record.changes_count ?? null,
      created_at: record.created_at ?? null,
      updated_at: record.updated_at ?? null,
      player: record.player ?? null,
      game,
    };
  });

  const formatCategoryLabel = useCallback(
    (category: string) => {
      const categories = dictionary.play.players.categories as Record<string, string>;
      return categories[category] ?? category;
    },
    [dictionary.play.players.categories],
  );

  const handleTeamWinnerChange = useCallback(
    (gameId: string, winnerId: string) => {
      setTeamWinnerOverrides((previous) => {
        const baseValue = baseTeamSelections[gameId] ?? '';
        if (!winnerId || winnerId === baseValue) {
          const next = { ...previous };
          delete next[gameId];
          return next;
        }
        return {
          ...previous,
          [gameId]: winnerId,
        };
      });
    },
    [baseTeamSelections],
  );

  const handlePlayerWinnerChange = useCallback(
    (
      gameId: string,
      category: string,
      selection: PlayerSelectResult | null,
    ) => {
      setPlayerWinnerOverrides((previous) => {
        const baseSelection = basePlayerSelections[gameId]?.[category] ?? '';
        const next = { ...previous };
        const current = { ...(next[gameId] ?? {}) };

        const selectedId = selection?.supabaseId ?? selection?.id ?? '';

        if (
          !selection ||
          !selectedId ||
          (selection.source === 'supabase' && selectedId === baseSelection)
        ) {
          delete current[category];
        } else {
          current[category] = { ...selection };
        }

        if (Object.keys(current).length === 0) {
          delete next[gameId];
        } else {
          next[gameId] = current;
        }

        return next;
      });
    },
    [basePlayerSelections],
  );

  const handleWinnersDateChange = useCallback((value: string) => {
    setWinnersDate(value);
    setTeamWinnerOverrides({});
    setPlayerWinnerOverrides({});
  }, []);

  const handlePublishTeamWinners = useCallback(() => {
    if (!teamWinnersData) {
      return;
    }
    const payload = teamWinnersData.games
      .map((game) => {
        const selected =
          teamWinnerOverrides[game.id] ?? baseTeamSelections[game.id] ?? null;
        return selected
          ? {
              gameId: game.id,
              winnerTeamId: selected,
            }
          : null;
      })
      .filter(
        (entry): entry is { gameId: string; winnerTeamId: string } =>
          entry !== null,
      );
    startPublishTeams(async () => {
      try {
        await publishTeamWinners(winnersDate, payload, locale);
        setStatusMessage({
          kind: 'success',
          message: 'Vincitori Teams pubblicati.',
        });
        await mutateTeamWinners();
        setTeamWinnerOverrides({});
      } catch (error) {
        setStatusMessage({
          kind: 'error',
          message:
            (error as Error)?.message ??
            'Pubblicazione vincitori Teams fallita.',
        });
      }
    });
  }, [
    teamWinnersData,
    teamWinnerOverrides,
    baseTeamSelections,
    winnersDate,
    locale,
    mutateTeamWinners,
    startPublishTeams,
  ]);

  const handlePublishPlayerWinners = useCallback(() => {
    if (!playerWinnersData) {
      return;
    }
    const payload = playerWinnersData.games
      .flatMap((game) =>
        game.categories.map((category) => {
          const override =
            playerWinnerOverrides[game.id]?.[category.category] ?? null;
          if (override) {
            return {
              gameId: game.id,
              category: category.category,
              player: override,
            };
          }
          const baseId =
            basePlayerSelections[game.id]?.[category.category] ?? '';
          if (baseId) {
            const label =
              category.options.find((option) => option.value === baseId)?.label ??
              baseId;
            return {
              gameId: game.id,
              category: category.category,
              player: {
                id: baseId,
                label,
                source: 'supabase',
                supabaseId: baseId,
              } satisfies PlayerSelectResult,
            };
          }
          return null;
        }),
      )
      .filter(
        (
          entry,
        ): entry is {
          gameId: string;
          category: string;
          player: PlayerSelectResult;
        } => entry !== null,
      );
    startPublishPlayers(async () => {
      try {
        await publishPlayerWinners(winnersDate, payload, locale);
        setStatusMessage({
          kind: 'success',
          message: 'Vincitori Players pubblicati.',
        });
        await mutatePlayerWinners();
        setPlayerWinnerOverrides({});
      } catch (error) {
        setStatusMessage({
          kind: 'error',
          message:
            (error as Error)?.message ??
            'Pubblicazione vincitori Players fallita.',
        });
      }
    });
  }, [
    playerWinnersData,
    playerWinnerOverrides,
    basePlayerSelections,
    winnersDate,
    locale,
    mutatePlayerWinners,
    startPublishPlayers,
  ]);

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

  const handleHighlightChange = (
    rank: number,
    selection: PlayerSelectResult | null,
  ) => {
    setHighlightForm((previous) => {
      const filtered = previous.filter((entry) => entry.rank !== rank);
      if (!selection) {
        return filtered;
      }
      const playerId = selection.supabaseId ?? selection.id;
      if (!playerId) {
        return filtered;
      }
      filtered.push({ rank, playerId, player: selection });
      return filtered.sort((a, b) => a.rank - b.rank);
    });
  };

  const handleHighlightsSave = () => {
    const payload = highlightForm
      .filter((entry) => entry.playerId)
      .map((entry) => ({
        rank: entry.rank,
        player:
          entry.player ??
          ({
            id: entry.playerId,
            label: entry.player?.label ?? entry.playerId,
            source: 'supabase',
            supabaseId: entry.playerId,
          } satisfies PlayerSelectResult),
      }));
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
        {ADMIN_TABS.map((tab) => {
          const label =
            tab === 'users'
              ? dictionary.admin.usersTab
              : tab === 'picks'
                ? dictionary.admin.picksTab
                : tab === 'winnersTeams'
                  ? 'Winners Teams'
                  : tab === 'winnersPlayers'
                    ? 'Winners Players'
                    : dictionary.admin.highlightsTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'rounded-full border px-4 py-2 text-sm font-semibold transition',
                activeTab === tab
                  ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                  : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/30',
              )}
            >
              {label}
            </button>
          );
        })}
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
                            onClick={() =>
                              handleBalanceAdjust(user.id, ADMIN_POINT_STEP)
                            }
                            className="inline-flex h-8 w-14 items-center justify-center rounded-full border border-accent-gold/40 text-accent-gold hover:bg-accent-gold/10"
                          >
                            {`+${ADMIN_POINT_STEP}`}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleBalanceAdjust(user.id, -ADMIN_POINT_STEP)
                            }
                            className="inline-flex h-8 w-14 items-center justify-center rounded-full border border-white/10 text-slate-300 hover:border-accent-gold/40"
                          >
                            {`-${ADMIN_POINT_STEP}`}
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
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <PicksTeamsTable
                  className="h-full"
                  title={dictionary.play.teams.title}
                  rows={teamTableRows}
                  emptyMessage="No team picks."
                />
                <PicksPlayersTable
                  className="h-full"
                  title={dictionary.play.players.title}
                  rows={playerTableRows}
                  emptyMessage="No player picks."
                  formatCategory={formatCategoryLabel}
                />
              </div>
              <div className="space-y-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-white">
                    {dictionary.common.highlights}
                  </h3>
                  <div className="space-y-1 text-sm text-slate-200">
                    {(picksPreview.highlights ?? []).map((highlight, index) => {
                      const record = highlight as PicksPreviewHighlight;
                      const name = fullName(record.player);
                      return (
                        <div
                          key={`${highlight.rank}-${index}`}
                          className="rounded-xl bg-navy-800/70 px-3 py-2"
                        >
                          <span className="mr-2 text-xs uppercase opacity-70">
                            RANK #{highlight.rank}
                          </span>
                          <strong>{name}</strong>
                          {record.player?.position ? (
                            <span className="text-xs opacity-60">
                              {' '}
                              · {record.player.position}
                            </span>
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

      {activeTab === 'winnersTeams' ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={winnersDate}
                onChange={(event) => handleWinnersDateChange(event.target.value)}
                className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
              />
              <select
                value={winnersDate}
                onChange={(event) => handleWinnersDateChange(event.target.value)}
                className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
              >
                {winnersDateOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {statusMessage ? (
              <div
                className={clsx(
                  'rounded-full px-4 py-2 text-xs font-semibold',
                  statusMessage.kind === 'success'
                    ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                    : 'border border-rose-400/40 bg-rose-400/10 text-rose-200',
                )}
              >
                {statusMessage.message}
              </div>
            ) : null}
          </div>
          {teamWinnersLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{dictionary.common.loading}</span>
            </div>
          ) : teamWinnersError ? (
            <p className="text-sm text-rose-400">
              {(teamWinnersError as Error)?.message ?? 'Errore nel caricamento.'}
            </p>
          ) : teamWinnersData ? (
            teamWinnersData.games.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Matchup</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Vincitore</th>
                      <th className="px-4 py-3 text-left">Pubblicazione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-[13px] text-slate-200">
                    {teamWinnersData.games.map((game) => {
                      const baseSelection = baseTeamSelections[game.id] ?? '';
                      const selection =
                        teamWinnerOverrides[game.id] ?? baseSelection;
                      return (
                        <tr key={game.id}>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">
                                {(game.awayTeam.abbr ?? 'AWY').toUpperCase()} @{' '}
                                {(game.homeTeam.abbr ?? 'HOME').toUpperCase()}
                              </span>
                              <span className="text-xs text-slate-400">
                                {(game.awayTeam.name ?? 'Away Team')}{' '}
                                vs {(game.homeTeam.name ?? 'Home Team')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-xs uppercase tracking-wide text-slate-400">
                            {game.status}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <select
                              value={selection}
                              onChange={(event) =>
                                handleTeamWinnerChange(game.id, event.target.value)
                              }
                              className="w-full rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
                            >
                              <option value="">—</option>
                              <option value={game.homeTeam.id}>
                                {(game.homeTeam.abbr ?? 'HOME').toUpperCase()} ·{' '}
                                {game.homeTeam.name ?? 'Home'}
                              </option>
                              <option value={game.awayTeam.id}>
                                {(game.awayTeam.abbr ?? 'AWY').toUpperCase()} ·{' '}
                                {game.awayTeam.name ?? 'Away'}
                              </option>
                            </select>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {game.winnerTeamId ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                                Pubblicato
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-400">
                                In attesa
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-300">
                Nessuna partita trovata per la data selezionata.
              </p>
            )
          ) : (
            <p className="text-sm text-slate-300">Nessun dato disponibile.</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePublishTeamWinners}
              disabled={
                publishTeamsPending ||
                teamWinnersLoading ||
                Boolean(teamWinnersError) ||
                !teamWinnersData
              }
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold',
                publishTeamsPending
                  ? 'border-white/10 bg-navy-800/70 text-slate-400'
                  : 'border-accent-gold/40 text-accent-gold hover:border-accent-gold',
              )}
            >
              {publishTeamsPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Pubblica vincitori
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'winnersPlayers' ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={winnersDate}
                onChange={(event) => handleWinnersDateChange(event.target.value)}
                className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
              />
              <select
                value={winnersDate}
                onChange={(event) => handleWinnersDateChange(event.target.value)}
                className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
              >
                {winnersDateOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {statusMessage ? (
              <div
                className={clsx(
                  'rounded-full px-4 py-2 text-xs font-semibold',
                  statusMessage.kind === 'success'
                    ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                    : 'border border-rose-400/40 bg-rose-400/10 text-rose-200',
                )}
              >
                {statusMessage.message}
              </div>
            ) : null}
          </div>
          {playerWinnersLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{dictionary.common.loading}</span>
            </div>
          ) : playerWinnersError ? (
            <p className="text-sm text-rose-400">
              {(playerWinnersError as Error)?.message ??
                'Errore nel caricamento.'}
            </p>
          ) : playerWinnersData ? (
            playerWinnersData.games.length > 0 ? (
              <div className="space-y-4">
                {playerWinnersData.games.map((game) => (
                  <div
                    key={game.id}
                    className="space-y-3 rounded-2xl border border-white/10 bg-navy-900/60 p-4"
                  >
                    <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {(game.awayTeam.abbr ?? 'AWY').toUpperCase()} @{' '}
                          {(game.homeTeam.abbr ?? 'HOME').toUpperCase()}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {(game.awayTeam.name ?? 'Away Team')} vs{' '}
                          {(game.homeTeam.name ?? 'Home Team')}
                        </p>
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">
                        {game.status}
                      </span>
                    </header>
                    <div className="space-y-3">
                      {game.categories.map((category) => {
                        const baseSelectionId =
                          basePlayerSelections[game.id]?.[category.category] ?? '';
                        const overrideSelection =
                          playerWinnerOverrides[game.id]?.[category.category] ??
                          null;
                        const selectionValue = overrideSelection
                          ? overrideSelection.supabaseId ?? overrideSelection.id
                          : baseSelectionId;
                        const published = Boolean(baseSelectionId);
                        return (
                          <div
                            key={`${game.id}-${category.category}`}
                            className="flex flex-col gap-2 rounded-xl border border-white/10 bg-navy-800/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-white">
                                {formatCategoryLabel(category.category)}
                              </span>
                              {published ? (
                                <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                                  Pubblicato
                                </span>
                              ) : (
                                <span className="inline-flex w-fit items-center rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
                                  In attesa
                                </span>
                              )}
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:w-64">
                              <PlayerSelect
                                value={selectionValue || undefined}
                                onChange={(selection) =>
                                  handlePlayerWinnerChange(
                                    game.id,
                                    category.category,
                                    selection,
                                  )
                                }
                                placeholder="Seleziona giocatore"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handlePlayerWinnerChange(
                                    game.id,
                                    category.category,
                                    null,
                                  )
                                }
                                className="self-start text-[11px] text-slate-400 hover:text-slate-200"
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-300">
                Nessuna categoria disponibile per la data selezionata.
              </p>
            )
          ) : (
            <p className="text-sm text-slate-300">Nessun dato disponibile.</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePublishPlayerWinners}
              disabled={
                publishPlayersPending ||
                playerWinnersLoading ||
                Boolean(playerWinnersError) ||
                !playerWinnersData
              }
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold',
                publishPlayersPending
                  ? 'border-white/10 bg-navy-800/70 text-slate-400'
                  : 'border-accent-gold/40 text-accent-gold hover:border-accent-gold',
              )}
            >
              {publishPlayersPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Pubblica vincitori
            </button>
          </div>
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
              const entry = highlightForm.find((item) => item.rank === rank);
              const selected =
                entry?.player?.supabaseId ??
                entry?.player?.id ??
                entry?.playerId ??
                '';
              return (
                <label key={rank} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4 text-xs text-slate-300">
                  <span className="font-semibold text-white">#{rank}</span>
                  <div className="flex flex-col gap-2">
                    <PlayerSelect
                      value={selected || undefined}
                      onChange={(selection) => handleHighlightChange(rank, selection)}
                      placeholder="Seleziona giocatore"
                    />
                    {selected ? (
                      <button
                        type="button"
                        onClick={() => handleHighlightChange(rank, null)}
                        className="self-start text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
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
