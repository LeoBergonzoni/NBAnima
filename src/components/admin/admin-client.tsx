'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import useSWR from 'swr';

import {
  adjustUserBalanceAction,
  assignCardAction,
  assignWeeklyXpPrizesAction,
  revokeCardAction,
  saveHighlightsAction,
  loadTeamWinners,
  loadPlayerWinners,
  publishTeamWinners,
  publishPlayerWinners,
  type LoadTeamWinnersResult,
  type LoadPlayerWinnersResult,
  type PlayerWinnerOption,
} from '@/app/[locale]/admin/actions';
import { PicksPlayersTable } from '@/components/picks/PicksPlayersTable';
import { PicksTeamsTable } from '@/components/picks/PicksTeamsTable';
import {
  PlayerSelect,
  type PlayerSelectResult,
} from '@/components/admin/PlayerSelect';
import { AdminStorageDashboard } from '@/components/AdminStorageDashboard';
import { ADMIN_POINT_STEP } from '@/lib/admin';
import { TIMEZONES, type Locale } from '@/lib/constants';
import type { Dictionary } from '@/locales/dictionaries';
import { formatDateNy, formatDateTimeNy } from '@/components/picks/cells';

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to load data');
  }
  return response.json();
};

const fullName = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
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
  user_cards?: Array<{ id: string; card: ShopCard | null }>;
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
  'storage',
  'rosters',
] as const;

type AdminTab = (typeof ADMIN_TABS)[number];

type HighlightFormEntry = {
  rank: number;
  playerId: string;
  player?: PlayerSelectResult | null;
};

type PlayerWinnerOverridesState = Record<
  string,
  Record<string, Array<PlayerSelectResult | null>>
>;

type SummaryPerformer = {
  player: { id: number; first_name: string; last_name: string } | null;
  team: { abbreviation?: string | null } | null;
  value: number;
};

type SummaryGame = {
  id: number;
  home_team: { abbreviation?: string | null };
  visitor_team: { abbreviation?: string | null };
  home_team_score: number;
  visitor_team_score: number;
  status: string;
  date: string;
  topPerformers: {
    points: SummaryPerformer[];
    rebounds: SummaryPerformer[];
    assists: SummaryPerformer[];
  };
};

type GamesSummaryResponse = {
  date: string;
  games: Array<{ game: SummaryGame; topPerformers: SummaryGame['topPerformers'] }>;
};

function ResponsiveTable({
  headers,
  children,
}: {
  headers: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10 bg-navy-900/60 touch-scroll">
      <table className="min-w-full text-sm text-left text-slate-200">
        {headers}
        {children}
      </table>
    </div>
  );
}

function MobileList({ children }: { children: ReactNode }) {
  return <ul className="md:hidden flex flex-col gap-3">{children}</ul>;
}

const resolveOutcomeDisplay = (value?: string | null) => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'win' || normalized === 'won') {
    return { label: '✓ Win', className: 'text-emerald-300' };
  }
  if (normalized === 'loss' || normalized === 'lost') {
    return { label: '✗ Loss', className: 'text-rose-300' };
  }
  if (normalized === 'pending') {
    return { label: '• Pending', className: 'text-amber-300' };
  }
  if (normalized === 'push') {
    return { label: 'Push', className: 'text-slate-200' };
  }
  return { label: '—', className: 'text-slate-400' };
};

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
  const [weeklyPrizesPending, startWeeklyPrizes] = useTransition();
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
  } = useSWR<
    LoadTeamWinnersResult,
    Error,
    readonly ['admin-team-winners', string] | null
  >(
    teamWinnersKey,
    ([, date]) => loadTeamWinners(date),
    { revalidateOnFocus: false },
  );

  const {
    data: playerWinnersData,
    isLoading: playerWinnersLoading,
    mutate: mutatePlayerWinners,
    error: playerWinnersError,
  } = useSWR<
    LoadPlayerWinnersResult,
    Error,
    readonly ['admin-player-winners', string] | null
  >(
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
      return {} as Record<string, Record<string, string[]>>;
    }
    return playerWinnersData.games.reduce<
      Record<string, Record<string, string[]>>
    >((acc, game) => {
      const categories: Record<string, string[]> = {};
      game.categories.forEach((category) => {
        categories[category.category] = category.winnerPlayerIds ?? [];
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

  const picksTeamWinnersKey = useMemo(
    () =>
      activeTab === 'picks' && selectedUser && defaultPickDate
        ? (['admin-picks-team-winners', defaultPickDate] as const)
        : null,
    [activeTab, selectedUser, defaultPickDate],
  );

  const picksPlayerWinnersKey = useMemo(
    () =>
      activeTab === 'picks' && selectedUser && defaultPickDate
        ? (['admin-picks-player-winners', defaultPickDate] as const)
        : null,
    [activeTab, selectedUser, defaultPickDate],
  );

  const { data: picksTeamWinnersData } = useSWR<
    LoadTeamWinnersResult,
    Error,
    readonly ['admin-picks-team-winners', string] | null
  >(
    picksTeamWinnersKey,
    ([, date]) => loadTeamWinners(date),
    { revalidateOnFocus: false },
  );

  const { data: picksPlayerWinnersData } = useSWR<
    LoadPlayerWinnersResult,
    Error,
    readonly ['admin-picks-player-winners', string] | null
  >(
    picksPlayerWinnersKey,
    ([, date]) => loadPlayerWinners(date),
    { revalidateOnFocus: false },
  );

  const teamWinnersByGameIdForPicks = useMemo<Record<string, string | null> | null>(() => {
    if (!picksTeamWinnersData) {
      return null;
    }
    return picksTeamWinnersData.games.reduce<Record<string, string | null>>((acc, game) => {
      acc[game.id] = game.winnerTeamId ?? null;
      return acc;
    }, {});
  }, [picksTeamWinnersData]);

  const playerWinnersByKeyForPicks = useMemo<Record<string, string[]> | null>(() => {
    if (!picksPlayerWinnersData) {
      return null;
    }
    return picksPlayerWinnersData.games.reduce<Record<string, string[]>>((acc, game) => {
      game.categories.forEach((category) => {
        acc[`${game.id}:${category.category}`] = category.winnerPlayerIds ?? [];
      });
      return acc;
    }, {});
  }, [picksPlayerWinnersData]);

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
      result: (() => {
        const fallbackResult = record.result ?? null;
        if (!record.game_id) {
          return fallbackResult;
        }
        const winnerId = teamWinnersByGameIdForPicks
          ? teamWinnersByGameIdForPicks[record.game_id]
          : undefined;
        if (winnerId === undefined) {
          return fallbackResult;
        }
        if (!winnerId) {
          return 'pending';
        }
        if (!record.selected_team_id) {
          return fallbackResult;
        }
        return winnerId.trim().toLowerCase() === record.selected_team_id.trim().toLowerCase()
          ? 'win'
          : 'loss';
      })(),
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
      result: (() => {
        const key = record.game_id ? `${record.game_id}:${record.category}` : undefined;
        const winnerIds =
          key && playerWinnersByKeyForPicks
            ? playerWinnersByKeyForPicks[key]
            : undefined;
        const fallback = (record as { result?: string | null }).result ?? null;
        if (winnerIds === undefined) {
          return fallback;
        }
        if (!winnerIds || winnerIds.length === 0) {
          return 'pending';
        }
        if (!record.player_id) {
          return fallback;
        }
        const normalizedPick = record.player_id.trim().toLowerCase();
        const isWinner = winnerIds.some(
          (winner) => winner.trim().toLowerCase() === normalizedPick,
        );
        return isWinner
          ? 'win'
          : 'loss';
      })(),
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

  const resolvePlayerOptionLabel = useCallback(
    (gameId: string, categoryId: string, playerId: string) => {
      const game = playerWinnersData?.games.find((entry) => entry.id === gameId);
      const category = game?.categories.find((entry) => entry.category === categoryId);
      const option = category?.options.find((entry) => entry.value === playerId);
      return option?.label ?? playerId;
    },
    [playerWinnersData],
  );

  const buildSelectionFromBase = useCallback(
    (gameId: string, categoryId: string, playerId: string): PlayerSelectResult => ({
      id: playerId,
      supabaseId: playerId,
      source: 'supabase',
      label: resolvePlayerOptionLabel(gameId, categoryId, playerId),
    }),
    [resolvePlayerOptionLabel],
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
      index: number,
      selection: PlayerSelectResult | null,
    ) => {
      setPlayerWinnerOverrides((previous) => {
        const next = { ...previous };
        const perGame = { ...(next[gameId] ?? {}) };
        const baseIds = basePlayerSelections[gameId]?.[category] ?? [];
        const existing = perGame[category]
          ? [...perGame[category]!]
          : baseIds.map((playerId) =>
              buildSelectionFromBase(gameId, category, playerId),
            );

        while (existing.length <= index) {
          existing.push(null);
        }

        existing[index] = selection;

        const normalized = existing
          .filter(
            (entry): entry is PlayerSelectResult =>
              Boolean(entry && (entry.supabaseId ?? entry.id)),
          )
          .map((entry) => (entry.supabaseId ?? entry.id)!)
          .sort();

        const baseNormalized = baseIds.slice().sort();
        const hasPlaceholders = existing.some(
          (entry) => !entry || !(entry.supabaseId ?? entry.id),
        );

        if (
          !hasPlaceholders &&
          normalized.length === baseNormalized.length &&
          normalized.every((value, idx) => value === baseNormalized[idx])
        ) {
          delete perGame[category];
        } else {
          perGame[category] = existing;
        }

        if (Object.keys(perGame).length === 0) {
          delete next[gameId];
        } else {
          next[gameId] = perGame;
        }

        return next;
      });
    },
    [basePlayerSelections, buildSelectionFromBase],
  );

  const handleAddPlayerWinner = useCallback(
    (gameId: string, category: string) => {
      setPlayerWinnerOverrides((previous) => {
        const next = { ...previous };
        const perGame = { ...(next[gameId] ?? {}) };
        const baseIds = basePlayerSelections[gameId]?.[category] ?? [];
        const existing = perGame[category]
          ? [...perGame[category]!]
          : baseIds.map((playerId) =>
              buildSelectionFromBase(gameId, category, playerId),
            );

        existing.push(null);
        perGame[category] = existing;
        next[gameId] = perGame;
        return next;
      });
    },
    [basePlayerSelections, buildSelectionFromBase],
  );

  const handleRemovePlayerWinner = useCallback(
    (gameId: string, category: string, index: number) => {
      setPlayerWinnerOverrides((previous) => {
        const next = { ...previous };
        const perGame = { ...(next[gameId] ?? {}) };
        const baseIds = basePlayerSelections[gameId]?.[category] ?? [];
        const existing = perGame[category]
          ? [...perGame[category]!]
          : baseIds.map((playerId) =>
              buildSelectionFromBase(gameId, category, playerId),
            );

        if (index < 0 || index >= existing.length) {
          return previous;
        }

        existing.splice(index, 1);

        const hasNonNull = existing.some(
          (entry) => entry && (entry.supabaseId ?? entry.id),
        );
        if (!hasNonNull) {
          existing.length = 0;
        }

        const normalized = existing
          .filter(
            (entry): entry is PlayerSelectResult =>
              Boolean(entry && (entry.supabaseId ?? entry.id)),
          )
          .map((entry) => (entry.supabaseId ?? entry.id)!)
          .sort();

        const baseNormalized = baseIds.slice().sort();

        if (existing.length === 0 && baseNormalized.length === 0) {
          delete perGame[category];
        } else if (
          existing.length > 0 &&
          normalized.length === baseNormalized.length &&
          normalized.every((value, idx) => value === baseNormalized[idx])
        ) {
          delete perGame[category];
        } else {
          perGame[category] = existing;
        }

        if (Object.keys(perGame).length === 0) {
          delete next[gameId];
        } else {
          next[gameId] = perGame;
        }

        return next;
      });
    },
    [basePlayerSelections, buildSelectionFromBase],
  );

  const handleResetPlayerWinnerCategory = useCallback(
    (gameId: string, category: string) => {
      setPlayerWinnerOverrides((previous) => {
        const existing = previous[gameId]?.[category];
        if (!existing) {
          return previous;
        }
        const next = { ...previous };
        const perGame = { ...next[gameId] };
        delete perGame[category];
        if (Object.keys(perGame).length === 0) {
          delete next[gameId];
        } else {
          next[gameId] = perGame;
        }
        return next;
      });
    },
    [],
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
    const payload = Object.entries(playerWinnerOverrides)
      .flatMap(([gameId, categories]) =>
        Object.entries(categories).map(([categoryId, selections]) => {
          const entries = (selections ?? []).filter(
            (selection): selection is PlayerSelectResult =>
              Boolean(selection && (selection.supabaseId ?? selection.id)),
          );

          const normalized = entries
            .map((selection) => (selection.supabaseId ?? selection.id)!)
            .sort();
          const baseNormalized = (basePlayerSelections[gameId]?.[categoryId] ?? [])
            .slice()
            .sort();
          const hasPlaceholders = (selections ?? []).some(
            (selection) => !selection || !(selection.supabaseId ?? selection.id),
          );

          if (
            !hasPlaceholders &&
            normalized.length === baseNormalized.length &&
            normalized.every((value, idx) => value === baseNormalized[idx])
          ) {
            return null;
          }

          const seen = new Set<string>();
          const deduped: PlayerSelectResult[] = [];
          entries.forEach((entry) => {
            const id = entry.supabaseId ?? entry.id;
            if (id && !seen.has(id)) {
              seen.add(id);
              deduped.push(entry);
            }
          });

          return {
            gameId,
            category: categoryId,
            players: deduped,
          };
        }),
      )
      .filter(
        (
          entry,
        ): entry is {
          gameId: string;
          category: string;
          players: PlayerSelectResult[];
        } => entry !== null,
      );

    if (payload.length === 0) {
      setStatusMessage({
        kind: 'success',
        message: 'Nessuna modifica da pubblicare.',
      });
      return;
    }

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

  const handleAssignWeeklyPrizes = useCallback(() => {
    startWeeklyPrizes(async () => {
      try {
        const result = await assignWeeklyXpPrizesAction({ locale });
        const message =
          result.skippedCount > 0
            ? dictionary.admin.weeklyPrizesPartial
                .replace('{awarded}', String(result.awardedCount))
                .replace('{skipped}', String(result.skippedCount))
            : dictionary.admin.weeklyPrizesSuccess;
        setStatusMessage({ kind: 'success', message });
      } catch (error) {
        setStatusMessage({
          kind: 'error',
          message:
            (error as Error)?.message ?? dictionary.admin.weeklyPrizesError,
        });
      }
    });
  }, [
    dictionary.admin.weeklyPrizesPartial,
    dictionary.admin.weeklyPrizesSuccess,
    dictionary.admin.weeklyPrizesError,
    locale,
  ]);

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
      .map((entry) => {
        const player: PlayerSelectResult =
          entry.player ?? {
            id: entry.playerId,
            label: entry.playerId,
            source: 'supabase',
            supabaseId: entry.playerId,
          };

        return {
          rank: entry.rank,
          player,
        };
      });
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

  const loadGamesSummary = useCallback(
    async (): Promise<GamesSummaryResponse | null> => {
      try {
        const response = await fetch(
          `/api/admin/games-summary?date=${encodeURIComponent(winnersDate)}`,
          { cache: 'no-store' },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error ?? 'Impossibile recuperare il games summary');
        }
        return payload as GamesSummaryResponse;
      } catch (error) {
        setStatusMessage({
          kind: 'error',
          message:
            (error as Error)?.message ?? 'Errore durante il caricamento del games summary.',
        });
        return null;
      }
    },
    [winnersDate],
  );

  const autofillTeamWinners = useCallback(async () => {
    const summary = await loadGamesSummary();
    if (!summary || !teamWinnersData) {
      return;
    }

    const overrides: Record<string, string> = {};
    teamWinnersData.games.forEach((game) => {
      const homeAbbr = game.homeTeam.abbr?.toUpperCase() ?? '';
      const awayAbbr = game.awayTeam.abbr?.toUpperCase() ?? '';

      const match = summary.games.find(
        (entry) =>
          entry.game.home_team.abbreviation?.toUpperCase() === homeAbbr &&
          entry.game.visitor_team.abbreviation?.toUpperCase() === awayAbbr,
      );

      if (!match) {
        return;
      }

      const { game: summaryGame } = match;
      const homeScore = summaryGame.home_team_score ?? 0;
      const awayScore = summaryGame.visitor_team_score ?? 0;
      if (homeScore === awayScore) {
        return;
      }
      const winnerTeamId =
        homeScore > awayScore ? game.homeTeam.id : game.awayTeam.id;
      overrides[game.id] = winnerTeamId;
    });

    setTeamWinnerOverrides(overrides);
    setStatusMessage({
      kind: 'success',
      message: dictionary.admin.fillFromGamesSummary,
    });
  }, [loadGamesSummary, teamWinnersData, dictionary.admin.fillFromGamesSummary]);

  const stripDiacritics = (value: string) =>
    value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

  const normalizeName = (value?: string | null) =>
    stripDiacritics(value ?? '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .trim();

  const normalizeToken = (value?: string | number | null) =>
    stripDiacritics((value ?? '').toString())
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const matchPerformerToOption = (
    performer: SummaryPerformer,
    options: PlayerWinnerOption[],
  ): PlayerSelectResult | null => {
    const performerId = normalizeToken(performer.player?.id);
    const first = normalizeName(performer.player?.first_name);
    const last = normalizeName(performer.player?.last_name);
    const fullName = normalizeName(`${performer.player?.first_name ?? ''} ${performer.player?.last_name ?? ''}`);
    const teamAbbr = performer.team?.abbreviation?.toUpperCase() ?? null;
    const teamToken = normalizeName(teamAbbr);

    const scored = options
      .map((option) => {
        const optionId = normalizeToken(option.value);
        const optionLabel = normalizeName(option.label);
        const optionProviderId = normalizeToken(option.meta?.providerPlayerId);
        const optionTeamToken = normalizeName(option.meta?.teamAbbr);

        let score = 0;
        if (performerId && optionProviderId && performerId === optionProviderId) {
          score += 8;
        }
        if (performerId && optionId && performerId === optionId) {
          score += 6;
        }
        if (fullName && optionLabel.includes(fullName)) {
          score += 4;
        }
        if (first && last && optionLabel.includes(first) && optionLabel.includes(last)) {
          score += 3;
        }
        if (last && optionLabel.includes(last)) {
          score += 1.5;
        }
        if (teamToken && optionTeamToken && optionTeamToken === teamToken) {
          score += 1;
        } else if (teamToken && optionLabel.includes(teamToken)) {
          score += 0.5;
        }

        return { option, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.option.label.length - b.option.label.length);

    const best = scored[0]?.option ?? null;

    if (best) {
      return {
        id: best.value,
        label: best.label,
        source: 'supabase',
        supabaseId: best.value,
        providerPlayerId: best.meta?.providerPlayerId ?? best.value,
        teamAbbr: best.meta?.teamAbbr ?? teamAbbr,
        firstName: performer.player?.first_name ?? undefined,
        lastName: performer.player?.last_name ?? undefined,
        position: best.meta?.position ?? undefined,
      };
    }

    if (!performer.player) {
      return null;
    }

    const name = `${performer.player.first_name ?? ''} ${performer.player.last_name ?? ''}`.trim();
    const label = teamAbbr ? `${name} — ${teamAbbr}` : name || String(performer.player.id);
    return {
      id: String(performer.player.id),
      label,
      source: 'roster',
      providerPlayerId: String(performer.player.id),
      teamAbbr,
      firstName: performer.player.first_name ?? undefined,
      lastName: performer.player.last_name ?? undefined,
    };
  };

  const categoryKeyToSummary = (category: string) => {
    const normalized = category.toLowerCase();
    if (normalized.includes('assist')) {
      return 'assists' as const;
    }
    if (normalized.includes('rebound')) {
      return 'rebounds' as const;
    }
    return 'points' as const;
  };

  const autofillPlayerWinners = useCallback(async () => {
    const summary = await loadGamesSummary();
    if (!summary || !playerWinnersData) {
      return;
    }

    const overrides: PlayerWinnerOverridesState = {};

    playerWinnersData.games.forEach((game) => {
      const homeAbbr = game.homeTeam.abbr?.toUpperCase() ?? '';
      const awayAbbr = game.awayTeam.abbr?.toUpperCase() ?? '';

      const match = summary.games.find(
        (entry) =>
          entry.game.home_team.abbreviation?.toUpperCase() === homeAbbr &&
          entry.game.visitor_team.abbreviation?.toUpperCase() === awayAbbr,
      );

      if (!match) {
        return;
      }

      const perCategory: Record<string, Array<PlayerSelectResult | null>> = {};
      game.categories.forEach((category) => {
        const key = categoryKeyToSummary(category.category);
        const performers =
          match.topPerformers[key as keyof SummaryGame['topPerformers']] ?? [];
        const selections = performers
          .map((performer) => matchPerformerToOption(performer, category.options))
          .filter((value): value is PlayerSelectResult => Boolean(value));

        if (selections.length > 0) {
          perCategory[category.category] = selections;
        }
      });

      if (Object.keys(perCategory).length > 0) {
        overrides[game.id] = perCategory;
      }
    });

    setPlayerWinnerOverrides(overrides);
    setStatusMessage({
      kind: 'success',
      message: dictionary.admin.fillFromGamesSummary,
    });
  }, [loadGamesSummary, playerWinnersData, dictionary.admin.fillFromGamesSummary]);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-4 md:py-6">
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 md:mx-0 bg-navy-950/80 backdrop-blur supports-[backdrop-filter]:bg-navy-950/60">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/${locale}/dashboard`}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
              >
                {dictionary.admin.backToDashboard}
              </Link>
              <Link
                href={`/${locale}/admin/games-summary`}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-accent-gold/50 bg-accent-gold/15 px-4 py-1.5 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
              >
                {dictionary.admin.gamesSummaryLink}
              </Link>
            </div>
            <header className="flex w-full flex-1 gap-2 overflow-x-auto pb-1 text-sm text-white touch-scroll">
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
                          : tab === 'storage'
                            ? 'Storage'
                            : tab === 'rosters'
                              ? 'Rosters'
                              : dictionary.admin.highlightsTab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      'flex-none whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition min-h-[44px]',
                      activeTab === tab
                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                        : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/40',
                    )}
                    aria-pressed={activeTab === tab}
                  >
                    {label}
                  </button>
                );
              })}
            </header>
          </div>
        </div>
      </div>

      <div className="space-y-6 pt-4 md:pt-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                {dictionary.admin.weeklyPrizesTitle}
              </p>
              <p className="text-xs text-slate-300">
                {dictionary.admin.weeklyPrizesDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAssignWeeklyPrizes}
              disabled={weeklyPrizesPending}
              className={clsx(
                'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition min-h-[44px]',
                weeklyPrizesPending
                  ? 'cursor-not-allowed border-white/20 bg-white/5 text-slate-300'
                  : 'border-accent-gold/60 bg-accent-gold/15 text-accent-gold hover:border-accent-gold hover:bg-accent-gold/25',
              )}
              aria-busy={weeklyPrizesPending}
            >
              {weeklyPrizesPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {dictionary.admin.weeklyPrizesCta}
            </button>
          </div>
          {statusMessage && activeTab !== 'winnersTeams' && activeTab !== 'winnersPlayers' ? (
            <div
              className={clsx(
                'mt-2 inline-flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2 text-xs font-semibold md:mt-3',
                statusMessage.kind === 'success'
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                  : 'border-rose-400/40 bg-rose-400/10 text-rose-200',
              )}
            >
              <span>{statusMessage.message}</span>
            </div>
          ) : null}
        </section>

        {activeTab === 'users' ? (
          <section className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
            <h2 className="text-2xl font-semibold text-white">
              {dictionary.admin.usersTab}
            </h2>
            <div className="w-full md:w-auto">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={dictionary.admin.searchPlaceholder}
                className="h-10 w-full max-w-md rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white placeholder:text-slate-400 focus:border-accent-gold focus:outline-none"
              />
            </div>
          </div>

          <ResponsiveTable
            headers={
              <thead className="bg-navy-900/80 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left">
                    {dictionary.admin.usersTab}
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Email</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">
                    {dictionary.admin.balance}
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">
                    {dictionary.admin.cards}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
            }
          >
            <tbody className="divide-y divide-white/5 text-sm text-slate-200">
              {filteredUsers.map((user) => {
                const userCards = user.user_cards ?? [];
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">
                          {user.full_name ?? '—'}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-semibold text-white">
                          {user.anima_points_balance}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleBalanceAdjust(user.id, ADMIN_POINT_STEP)}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold"
                            aria-label={`Aggiungi ${ADMIN_POINT_STEP} punti`}
                          >
                            {`+${ADMIN_POINT_STEP}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBalanceAdjust(user.id, -ADMIN_POINT_STEP)}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-slate-200 transition hover:border-accent-gold/40"
                            aria-label={`Rimuovi ${ADMIN_POINT_STEP} punti`}
                          >
                            {`-${ADMIN_POINT_STEP}`}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {userCards.map((entry, index) =>
                          entry.card ? (
                            <span
                              key={entry.id ?? `${entry.card.id}-${index}`}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-xs text-slate-200"
                            >
                              {entry.card.name} · {entry.card.rarity}
                              <button
                                type="button"
                                onClick={() => handleRevokeCard(user.id, entry.card!.id)}
                                className="text-slate-400 transition hover:text-rose-300"
                                aria-label={`Rimuovi ${entry.card.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </span>
                          ) : null,
                        )}
                        {userCards.length === 0 ? (
                          <span className="text-xs text-slate-400">Nessuna card</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2">
                        <select
                          value={selectedCard[user.id] ?? ''}
                          onChange={(event) =>
                            setSelectedCard((previous) => ({
                              ...previous,
                              [user.id]: event.target.value,
                            }))
                          }
                          className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
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
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold"
                        >
                          <Pencil className="h-4 w-4" />
                          {dictionary.shop.buy}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ResponsiveTable>

          <MobileList>
            {filteredUsers.map((user) => {
              const userCards = user.user_cards ?? [];
              return (
                <li
                  key={user.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {user.full_name ?? '—'}
                      </div>
                      <div className="truncate text-xs text-slate-400">
                        {user.email}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {user.role}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        Balance
                      </span>
                      <span className="text-base font-semibold text-white">
                        {user.anima_points_balance}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleBalanceAdjust(user.id, ADMIN_POINT_STEP)}
                        className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold"
                        aria-label={`Aggiungi ${ADMIN_POINT_STEP} punti`}
                      >
                        {`+${ADMIN_POINT_STEP}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBalanceAdjust(user.id, -ADMIN_POINT_STEP)}
                        className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-slate-200 transition hover:border-accent-gold/40"
                        aria-label={`Rimuovi ${ADMIN_POINT_STEP} punti`}
                      >
                        {`-${ADMIN_POINT_STEP}`}
                      </button>
                    </div>
                    <select
                      value={selectedCard[user.id] ?? ''}
                      onChange={(event) =>
                        setSelectedCard((previous) => ({
                          ...previous,
                          [user.id]: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
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
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold"
                    >
                      <Pencil className="h-4 w-4" />
                      {dictionary.shop.buy}
                    </button>
                  </div>
                  <div className="mt-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {dictionary.admin.cards}
                    </span>
                    {userCards.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {userCards.map((entry, index) =>
                          entry.card ? (
                            <span
                              key={entry.id ?? `${entry.card.id}-${index}`}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-900/60 px-3 py-1 text-xs text-slate-200"
                            >
                              {entry.card.name} · {entry.card.rarity}
                              <button
                                type="button"
                                onClick={() => handleRevokeCard(user.id, entry.card!.id)}
                                className="text-slate-400 transition hover:text-rose-300"
                                aria-label={`Rimuovi ${entry.card.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </span>
                          ) : null,
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        Nessuna card assegnata.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </MobileList>

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
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 md:gap-3">
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
                className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
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
                className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
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
              <div className="hidden gap-4 md:grid md:grid-cols-2">
                <PicksTeamsTable
                  className="h-full"
                  title={dictionary.play.teams.title}
                  rows={teamTableRows}
                  emptyMessage="No team picks."
                  showDateColumn={false}
                  showChangesColumn={false}
                  showTimestampsColumn={false}
                />
                <PicksPlayersTable
                  className="h-full"
                  title={dictionary.play.players.title}
                  rows={playerTableRows}
                  emptyMessage="No player picks."
                  formatCategory={formatCategoryLabel}
                  showDateColumn={false}
                  showChangesColumn={false}
                  showTimestampsColumn={false}
                  showOutcomeColumn
                />
              </div>

              <div className="space-y-4 md:hidden">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-white">
                    {dictionary.play.teams.title}
                  </h3>
                  <MobileList>
                    {teamTableRows.map((row, index) => {
                      const homeAbbr = (row.game?.home_team_abbr ?? 'HOME').toUpperCase();
                      const awayAbbr = (row.game?.away_team_abbr ?? 'AWY').toUpperCase();
                      const homeName = row.game?.home_team_name ?? 'Home Team';
                      const awayName = row.game?.away_team_name ?? 'Away Team';
                      const selectionLabel =
                        row.selected_team_name ??
                        row.selected_team_abbr ??
                        row.selected_team_id ??
                        '—';
                      const outcome = resolveOutcomeDisplay(row.result);
                      return (
                        <li
                          key={`team-mobile-${row.game_id ?? 'unknown'}-${row.selected_team_id ?? index}-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {awayAbbr}
                            </span>
                            <span className="text-[11px] uppercase text-slate-500">
                              vs
                            </span>
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {homeAbbr}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {awayName} @ {homeName}
                          </p>
                          <div className="mt-3 space-y-1 text-sm text-slate-200">
                            <p>
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                Scelta:
                              </span>{' '}
                              <span className="font-semibold text-white">
                                {selectionLabel}
                              </span>
                            </p>
                            <p>
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                Esito:
                              </span>{' '}
                              <span className={clsx('font-semibold', outcome.className)}>
                                {outcome.label}
                              </span>
                            </p>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">
                            {formatDateNy(row.pick_date)} · Changes: {row.changes_count ?? 0} · Updated:{' '}
                            {formatDateTimeNy(row.updated_at)}
                          </p>
                        </li>
                      );
                    })}
                  </MobileList>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-white">
                    {dictionary.play.players.title}
                  </h3>
                  <MobileList>
                    {playerTableRows.map((row, index) => {
                      const homeAbbr = (row.game?.home_team_abbr ?? 'HOME').toUpperCase();
                      const awayAbbr = (row.game?.away_team_abbr ?? 'AWY').toUpperCase();
                      const homeName = row.game?.home_team_name ?? 'Home Team';
                      const awayName = row.game?.away_team_name ?? 'Away Team';
                      const displayName = (() => {
                        const computed = fullName(row.player ?? null);
                        if (computed && computed !== '—') {
                          return computed;
                        }
                        return row.player_id ?? '—';
                      })();
                      const categoryLabel = formatCategoryLabel(row.category);
                      const outcome = resolveOutcomeDisplay(row.result);
                      return (
                        <li
                          key={`player-mobile-${row.game_id ?? 'unknown'}-${row.category}-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {awayAbbr}
                            </span>
                            <span className="text-[11px] uppercase text-slate-500">
                              vs
                            </span>
                            <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                              {homeAbbr}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {awayName} @ {homeName}
                          </p>
                          <div className="mt-3 space-y-1 text-sm text-slate-200">
                            <p>
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                Scelta:
                              </span>{' '}
                              <span className="font-semibold text-white">
                                {displayName}
                              </span>
                              <span className="ml-2 text-xs text-slate-400">
                                {categoryLabel}
                              </span>
                            </p>
                            <p>
                              <span className="text-xs uppercase tracking-wide text-slate-400">
                                Esito:
                              </span>{' '}
                              <span className={clsx('font-semibold', outcome.className)}>
                                {outcome.label}
                              </span>
                            </p>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">
                            {formatDateNy(row.pick_date)} · Changes: {row.changes_count ?? 0} · Updated:{' '}
                            {formatDateTimeNy(row.updated_at)}
                          </p>
                        </li>
                      );
                    })}
                  </MobileList>
                </div>
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
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 md:gap-3">
              <input
                type="date"
                value={winnersDate}
                onChange={(event) => handleWinnersDateChange(event.target.value)}
                className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
              />
              <button
                type="button"
                onClick={autofillTeamWinners}
                className="inline-flex items-center justify-center rounded-lg border border-accent-gold/50 bg-accent-gold/10 px-3 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/20"
              >
                {dictionary.admin.fillFromGamesSummary}
              </button>
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
              <>
                <ResponsiveTable
                  headers={
                    <thead className="bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 text-left">Matchup</th>
                        <th className="whitespace-nowrap px-4 py-3 text-left">Status</th>
                        <th className="whitespace-nowrap px-4 py-3 text-left">Vincitore</th>
                        <th className="whitespace-nowrap px-4 py-3 text-left">
                          Pubblicazione
                        </th>
                      </tr>
                    </thead>
                  }
                >
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
                              className="w-full h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
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
                </ResponsiveTable>

                <MobileList>
                  {teamWinnersData.games.map((game) => {
                    const baseSelection = baseTeamSelections[game.id] ?? '';
                    const selection =
                      teamWinnerOverrides[game.id] ?? baseSelection;
                    const homeAbbr = (game.homeTeam.abbr ?? 'HOME').toUpperCase();
                    const awayAbbr = (game.awayTeam.abbr ?? 'AWY').toUpperCase();
                    const homeName = game.homeTeam.name ?? 'Home Team';
                    const awayName = game.awayTeam.name ?? 'Away Team';
                    const published = Boolean(game.winnerTeamId);
                    return (
                      <li
                        key={`mobile-${game.id}`}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                              <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                                {awayAbbr}
                              </span>
                              <span className="text-[11px] uppercase text-slate-500">
                                vs
                              </span>
                              <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase">
                                {homeAbbr}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              {awayName} @ {homeName}
                            </p>
                          </div>
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">
                            {game.status}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                          <select
                            value={selection}
                            onChange={(event) =>
                              handleTeamWinnerChange(game.id, event.target.value)
                            }
                            className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
                          >
                            <option value="">—</option>
                            <option value={game.homeTeam.id}>
                              {homeAbbr} · {homeName}
                            </option>
                            <option value={game.awayTeam.id}>
                              {awayAbbr} · {awayName}
                            </option>
                          </select>
                          <span
                            className={clsx(
                              'text-xs font-semibold',
                              published ? 'text-emerald-300' : 'text-slate-400',
                            )}
                          >
                            {published ? 'Pubblicato' : 'In attesa'}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </MobileList>
              </>
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
                'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition md:w-auto',
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
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 md:gap-3">
              <input
                type="date"
                value={winnersDate}
                onChange={(event) => handleWinnersDateChange(event.target.value)}
                className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
              />
              <button
                type="button"
                onClick={autofillPlayerWinners}
                className="inline-flex items-center justify-center rounded-lg border border-accent-gold/50 bg-accent-gold/10 px-3 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/20"
              >
                {dictionary.admin.fillFromGamesSummary}
              </button>
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
                        const baseIds =
                          basePlayerSelections[game.id]?.[category.category] ?? [];
                        const overrideSelections =
                          playerWinnerOverrides[game.id]?.[category.category] ?? null;
                        const baseSelections = baseIds.map((playerId) =>
                          buildSelectionFromBase(game.id, category.category, playerId),
                        );
                        const selections =
                          overrideSelections ?? baseSelections;
                        const displaySelections =
                          selections.length > 0 ? selections : [null];
                        const published = baseIds.length > 0;
                        return (
                          <div
                            key={`${game.id}-${category.category}`}
                            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-navy-800/60 p-3"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
                              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                {category.settledAt ? 'Settled' : 'Draft'}
                              </span>
                            </div>
                            <div className="flex w-full flex-col gap-2">
                              {displaySelections.map((selection, index) => {
                                const value = selection
                                  ? selection.supabaseId ?? selection.id
                                  : '';
                                const canRemove =
                                  displaySelections.length > 1 ||
                                  baseIds.length > 0 ||
                                  Boolean(overrideSelections);
                                return (
                                  <div
                                    key={`${game.id}-${category.category}-${index}`}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="flex-1">
                                      <PlayerSelect
                                        options={category.options}
                                        value={value || undefined}
                                        onChange={(nextSelection) =>
                                          handlePlayerWinnerChange(
                                            game.id,
                                            category.category,
                                            index,
                                            nextSelection,
                                          )
                                        }
                                        placeholder="Seleziona giocatore"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemovePlayerWinner(
                                          game.id,
                                          category.category,
                                          index,
                                        )
                                      }
                                      disabled={!canRemove}
                                      className={clsx(
                                        'flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-semibold transition',
                                        canRemove
                                          ? 'border-white/20 text-slate-100 hover:border-rose-400 hover:text-rose-200'
                                          : 'cursor-not-allowed border-white/10 text-slate-600',
                                      )}
                                      aria-label="Rimuovi vincitore"
                                    >
                                      –
                                    </button>
                                  </div>
                                );
                              })}
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddPlayerWinner(
                                      game.id,
                                      category.category,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-accent-gold/40 px-3 py-1 text-xs font-semibold text-accent-gold transition hover:border-accent-gold"
                                >
                                  +
                                  <span>Aggiungi vincitore</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleResetPlayerWinnerCategory(
                                      game.id,
                                      category.category,
                                    )
                                  }
                                  className="text-xs font-semibold text-slate-400 transition hover:text-slate-200"
                                >
                                  Reset
                                </button>
                              </div>
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
                'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition md:w-auto',
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="date"
              value={highlightDate}
              onChange={(event) => setHighlightDate(event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none"
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
                <label
                  key={rank}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4 text-sm text-slate-300"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Rank #{rank}
                  </span>
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
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold md:w-auto"
            disabled={highlightPending}
          >
            {highlightPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {dictionary.admin.applyHighlights}
          </button>
        </section>
      ) : null}

      {activeTab === 'storage' ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h2 className="text-2xl font-semibold text-white">Storage Supabase</h2>
          </div>
          <AdminStorageDashboard />
        </section>
      ) : null}

      {activeTab === 'rosters' ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h2 className="text-2xl font-semibold text-white">Rosters</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/${locale}/admin/rosters`}
              className="inline-flex items-center justify-center rounded-full border border-accent-gold/50 bg-accent-gold/15 px-4 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
            >
              Vai a /admin/rosters
            </Link>
          </div>
        </section>
      ) : null}
    </div>
    </div>
  );
};
