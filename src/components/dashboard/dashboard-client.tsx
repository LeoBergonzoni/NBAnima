'use client';

import clsx from 'clsx';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Coins,
  Loader2,
  LogOut,
  UserCircle2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useLocale } from '@/components/providers/locale-provider';
import type { Locale } from '@/lib/constants';
import { createBrowserSupabase } from '@/lib/supabase-browser';
import type { Dictionary } from '@/locales/dictionaries';
import { useGames } from '@/hooks/useGames';
import {
  type HighlightPick,
  type PlayerPick,
  type TeamPick,
  usePicks,
} from '@/hooks/usePicks';
import { usePlayers } from '@/hooks/usePlayers';

const PLAYER_CATEGORIES = [
  'top_scorer',
  'top_assist',
  'top_rebound',
  'top_dunk',
  'top_threes',
] as const;

interface ShopCard {
  id: string;
  name: string;
  description: string;
  rarity: string;
  price: number;
  image_url: string;
  accent_color: string | null;
}

interface DashboardClientProps {
  locale: Locale;
  balance: number;
  ownedCards: ShopCard[];
  shopCards: ShopCard[];
  role: string;
}

interface GameTeam {
  id: string;
  name: string;
  city: string | null;
  logo: string | null;
}

interface GameSummary {
  id: string;
  startsAt: string;
  status: string;
  arena?: string | null;
  homeTeam: GameTeam;
  awayTeam: GameTeam;
}

interface PlayerSummary {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string | null;
  teamId: string;
}

type PlayerSelections = Record<string, Record<string, string>>;

const formatGameTime = (locale: Locale, date: string) => {
  const value = new Date(date);
  try {
    return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(value);
  } catch {
    return value.toLocaleString();
  }
};

const SectionStatus = ({ complete }: { complete: boolean }) =>
  complete ? (
    <CheckCircle2 className="h-5 w-5 text-lime-400" />
  ) : (
    <CircleDashed className="h-5 w-5 text-slate-500" />
  );

const TeamButton = ({
  team,
  selected,
  onSelect,
}: {
  team: GameTeam;
  selected: boolean;
  onSelect: (teamId: string) => void;
}) => {
  const initials = useMemo(() => {
    const pieces = team.name.split(' ');
    return pieces
      .map((part) => part[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }, [team.name]);

  return (
    <button
      type="button"
      onClick={() => onSelect(team.id)}
      className={clsx(
        'group flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
        selected
          ? 'border-accent-gold bg-accent-gold/10 shadow-card'
          : 'border-white/10 bg-navy-800/60 hover:border-accent-gold/60',
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-navy-900 text-lg font-bold text-accent-gold">
        {initials}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-white">{team.name}</span>
        {team.city ? (
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {team.city}
          </span>
        ) : null}
      </div>
    </button>
  );
};

const GameTeamsRow = ({
  locale,
  game,
  selection,
  onSelect,
}: {
  locale: Locale;
  game: GameSummary;
  selection?: string;
  onSelect: (teamId: string) => void;
}) => (
  <div className="space-y-3 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card">
    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
      <span>{formatGameTime(locale, game.startsAt)}</span>
      {game.arena ? <span>· {game.arena}</span> : null}
      <span>· {game.status}</span>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <TeamButton team={game.awayTeam} selected={selection === game.awayTeam.id} onSelect={onSelect} />
      <div className="flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-slate-400">
        VS
      </div>
      <TeamButton team={game.homeTeam} selected={selection === game.homeTeam.id} onSelect={onSelect} />
    </div>
  </div>
);

const GamePlayersCard = ({
  locale,
  dictionary,
  game,
  playerSelections,
  onChange,
  onPlayersLoaded,
}: {
  locale: Locale;
  dictionary: Dictionary;
  game: GameSummary;
  playerSelections: Record<string, string>;
  onChange: (category: string, playerId: string) => void;
  onPlayersLoaded: (gameId: string, players: PlayerSummary[]) => void;
}) => {
  const { players, isLoading } = usePlayers(game.id);

  useEffect(() => {
    if (players.length) {
      onPlayersLoaded(game.id, players);
    }
  }, [game.id, onPlayersLoaded, players]);

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wide text-slate-400">
        <span>{formatGameTime(locale, game.startsAt)}</span>
        <span>
          {game.awayTeam.name} @ {game.homeTeam.name}
        </span>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{dictionary.common.loading}</span>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {PLAYER_CATEGORIES.map((category) => (
            <label key={category} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {dictionary.play.players.categories[category]}
              </span>
              <select
                value={playerSelections[category] ?? ''}
                onChange={(event) => onChange(category, event.target.value)}
                className="rounded-xl border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
              >
                <option value="">—</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName}
                    {player.position ? ` · ${player.position}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const HighlightsSelector = ({
  dictionary,
  highlightSelections,
  onChange,
  players,
}: {
  dictionary: Dictionary;
  highlightSelections: HighlightPick[];
  onChange: (rank: number, playerId: string) => void;
  players: PlayerSummary[];
}) => {
  const selectedByRank = useMemo(() => {
    const map = new Map<number, string>();
    highlightSelections.forEach((entry) => {
      map.set(entry.rank, entry.playerId);
    });
    return map;
  }, [highlightSelections]);

  const selectedPlayerIds = useMemo(
    () => new Set(highlightSelections.map((entry) => entry.playerId)),
    [highlightSelections],
  );

  const sortedPlayers = useMemo(() => {
    const seen = new Set<string>();
    return players.filter((player) => {
      if (seen.has(player.id)) {
        return false;
      }
      seen.add(player.id);
      return true;
    });
  }, [players]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 5 }).map((_, index) => {
        const rank = index + 1;
        const selectedPlayer = selectedByRank.get(rank) ?? '';

        return (
          <label key={rank} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {dictionary.admin.rank} #{rank}
            </span>
            <select
              value={selectedPlayer}
              onChange={(event) => onChange(rank, event.target.value)}
              className="rounded-xl border border-white/10 bg-navy-800/70 px-3 py-2 text-sm text-white focus:border-accent-gold focus:outline-none"
            >
              <option value="">—</option>
              {sortedPlayers.map((player) => (
                <option
                  key={`${rank}-${player.id}`}
                  value={player.id}
                  disabled={selectedPlayer !== player.id && selectedPlayerIds.has(player.id)}
                >
                  {player.fullName}
                  {player.position ? ` · ${player.position}` : ''}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
};

const CollectionGrid = ({ cards }: { cards: ShopCard[] }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className="group relative overflow-hidden rounded-[1.5rem] border border-accent-gold/20 bg-navy-800/70 p-5 shadow-card"
        >
          <div
            className="absolute inset-0 opacity-0 transition group-hover:opacity-20"
            style={{ backgroundColor: card.accent_color ?? '#8ecae6' }}
          />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
              <span>{card.rarity}</span>
              <span>{card.price} AP</span>
            </div>
            <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-navy-900">
              <Image
                src={card.image_url}
                alt={card.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{card.name}</h3>
              <p className="text-sm text-slate-300">{card.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ShopGrid = ({
  cards,
  balance,
  dictionary,
}: {
  cards: ShopCard[];
  balance: number;
  dictionary: Dictionary;
}) => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {cards.map((card) => {
      const affordable = balance >= card.price;
      return (
        <div
          key={card.id}
          className="relative overflow-hidden rounded-[1.5rem] border border-accent-gold/20 bg-navy-800/70 p-5 shadow-card"
        >
          <div
            className="absolute inset-0 opacity-0 transition group-hover:opacity-30"
            style={{ backgroundColor: card.accent_color ?? '#8ecae6' }}
          />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
              <span>{card.rarity}</span>
              <span className="flex items-center gap-2 text-slate-200">
                <Coins className="h-4 w-4 text-accent-gold" />
                {card.price}
              </span>
            </div>
            <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-navy-900">
              <Image src={card.image_url} alt={card.name} fill className="object-cover" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{card.name}</h3>
              <p className="text-sm text-slate-300">{card.description}</p>
            </div>
            <button
              type="button"
              disabled={!affordable}
              className={clsx(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                affordable
                  ? 'border-accent-gold bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30'
                  : 'border-white/10 bg-navy-900/60 text-slate-500',
              )}
            >
              {affordable
                ? dictionary.shop.buy
                : dictionary.shop.insufficientPoints}
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

export const DashboardClient = ({
  locale,
  balance,
  ownedCards,
  shopCards,
  role,
}: DashboardClientProps) => {
  const { dictionary } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [activeTab, setActiveTab] = useState<'play' | 'collection' | 'shop'>('play');
  const [teamSelections, setTeamSelections] = useState<Record<string, string>>({});
  const [playerSelections, setPlayerSelections] = useState<PlayerSelections>({});
  const [highlightSelections, setHighlightSelections] = useState<HighlightPick[]>([]);
  const [playersByGame, setPlayersByGame] = useState<Record<string, PlayerSummary[]>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const pickDate = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const { games, isLoading: gamesLoading } = useGames(locale);
  const {
    data: picks,
    isLoading: picksLoading,
    saveInitialPicks,
    updatePicks,
  } = usePicks(pickDate);

  useEffect(() => {
    if (!picks) {
      return;
    }

    setTeamSelections(
      picks.teams.reduce<Record<string, string>>((acc, pick) => {
        acc[pick.game_id] = pick.selected_team_id;
        return acc;
      }, {}),
    );

    setPlayerSelections(
      picks.players.reduce<PlayerSelections>((acc, pick) => {
        acc[pick.game_id] = acc[pick.game_id] ?? {};
        acc[pick.game_id][pick.category] = pick.player_id;
        return acc;
      }, {}),
    );

    setHighlightSelections(
      picks.highlights
        .map((highlight) => ({
          playerId: highlight.player_id,
          rank: highlight.rank,
        }))
        .sort((a, b) => a.rank - b.rank),
    );
  }, [picks]);

  const onPlayersLoaded = useCallback((gameId: string, players: PlayerSummary[]) => {
    setPlayersByGame((previous) => {
      const existing = previous[gameId] ?? [];
      if (
        existing.length === players.length &&
        existing.every((player, index) => player.id === players[index]?.id)
      ) {
        return previous;
      }
      return { ...previous, [gameId]: players };
    });
  }, []);

  const highlightPlayerPool = useMemo(
    () => Object.values(playersByGame).flat(),
    [playersByGame],
  );

  const teamsComplete = useMemo(
    () => games.length > 0 && games.every((game) => !!teamSelections[game.id]),
    [games, teamSelections],
  );

  const playersComplete = useMemo(
    () =>
      games.length > 0 &&
      games.every((game) =>
        PLAYER_CATEGORIES.every((category) =>
          Boolean(playerSelections[game.id]?.[category]),
        ),
      ),
    [games, playerSelections],
  );

  const highlightsComplete = useMemo(
    () => highlightSelections.length === 5,
    [highlightSelections.length],
  );

  const handleTeamsSelect = (gameId: string, teamId: string) => {
    setTeamSelections((previous) => ({ ...previous, [gameId]: teamId }));
  };

  const handlePlayerSelect = (gameId: string, category: string, playerId: string) => {
    setPlayerSelections((previous) => ({
      ...previous,
      [gameId]: {
        ...(previous[gameId] ?? {}),
        [category]: playerId,
      },
    }));
  };

  const handleHighlightSelect = (rank: number, playerId: string) => {
    setHighlightSelections((previous) => {
      const filtered = previous.filter((entry) => entry.rank !== rank);
      if (!playerId) {
        return filtered;
      }
      filtered.push({ rank, playerId });
      return filtered.sort((a, b) => a.rank - b.rank);
    });
  };

  const hasExistingPicks = Boolean(picks && picks.teams.length > 0);
  const dailyChanges = picks?.changesCount ?? 0;
  const changeLimitReached = dailyChanges >= 1;
  const canSubmit = teamsComplete && playersComplete && highlightsComplete && !isSaving;

  const dictionaryChangeHint = changeLimitReached
    ? dictionary.play.changesHintExhausted
    : dictionary.play.changesHintAvailable;

  const handleSave = async () => {
    if (!canSubmit) {
      return;
    }
    if (hasExistingPicks && changeLimitReached) {
      setErrorMessage(dictionary.play.changesHintExhausted);
      return;
    }

    const payload = {
      pickDate,
      teams: Object.entries(teamSelections).map<TeamPick>(([gameId, teamId]) => ({
        gameId,
        teamId,
      })),
      players: Object.entries(playerSelections).flatMap(([gameId, categories]) =>
        Object.entries(categories)
          .filter(([, playerId]) => !!playerId)
          .map<PlayerPick>(([category, playerId]) => ({
            gameId,
            category,
            playerId,
          })),
      ),
      highlights: highlightSelections.map<HighlightPick>((entry) => ({
        playerId: entry.playerId,
        rank: entry.rank,
      })),
    };

    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (hasExistingPicks) {
        await updatePicks(payload);
      } else {
        await saveInitialPicks(payload);
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: Array<{ key: 'play' | 'collection' | 'shop'; label: string }> = [
    { key: 'play', label: dictionary.dashboard.playTab },
    { key: 'collection', label: dictionary.dashboard.collectionTab },
    { key: 'shop', label: dictionary.dashboard.shopTab },
  ];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push(`/${locale}`);
      router.refresh();
    } catch (error) {
      console.error('[dashboard] signOut failed', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-navy-900/60 p-6 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {dictionary.dashboard.welcome}
          </p>
          <h1 className="text-2xl font-semibold text-white">NBAnima</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-xs text-slate-300 md:inline-flex">
            <UserCircle2 className="h-4 w-4 text-accent-gold" />
            <span>{locale.toUpperCase()}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-navy-800/80 px-4 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-navy-800/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? '…' : dictionary.common.logout}
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-6 rounded-[2rem] border border-accent-gold/40 bg-navy-900/70 p-6 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-gold/40 bg-navy-800/70">
            <Coins className="h-7 w-7 text-accent-gold" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {dictionary.dashboard.animaPoints}
            </p>
            <p className="text-3xl font-semibold text-white">{balance.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span>{dictionary.dashboard.lastUpdated}:</span>
          <code className="rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 font-mono text-xs">
            {pickDate}
          </code>
          {role === 'admin' ? (
            <Link
              href={`/${locale}/admin`}
              className="inline-flex items-center gap-2 rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold text-accent-gold hover:border-accent-gold"
            >
              {dictionary.common.admin}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-navy-900/50 p-4 shadow-card">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'rounded-full border px-4 py-2 text-sm font-semibold transition',
                activeTab === tab.key
                  ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                  : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/30',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === 'play' ? (
            <div className="space-y-6">
              <header className="space-y-2">
                <h2 className="text-2xl font-semibold text-white">
                  {dictionary.play.title}
                </h2>
                <p className="text-sm text-slate-300">{dictionary.play.subtitle}</p>
              </header>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <SectionStatus complete={teamsComplete} />
                      {dictionary.play.teams.title}
                    </h3>
                    <p className="text-sm text-slate-300">
                      {dictionary.play.teams.description}
                    </p>
                  </div>
                </div>
                {gamesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{dictionary.common.loading}</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {games.map((game) => (
                      <GameTeamsRow
                        key={game.id}
                        locale={locale}
                        game={game}
                        selection={teamSelections[game.id]}
                        onSelect={(teamId) => handleTeamsSelect(game.id, teamId)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <SectionStatus complete={playersComplete} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {dictionary.play.players.title}
                    </h3>
                    <p className="text-sm text-slate-300">
                      {dictionary.play.players.description}
                    </p>
                  </div>
                </div>
                {games.map((game) => (
                  <GamePlayersCard
                    key={game.id}
                    locale={locale}
                    dictionary={dictionary}
                    game={game}
                    playerSelections={playerSelections[game.id] ?? {}}
                    onChange={(category, playerId) =>
                      handlePlayerSelect(game.id, category, playerId)
                    }
                    onPlayersLoaded={onPlayersLoaded}
                  />
                ))}
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <SectionStatus complete={highlightsComplete} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {dictionary.play.highlights.title}
                    </h3>
                    <p className="text-sm text-slate-300">
                      {dictionary.play.highlights.description}
                    </p>
                  </div>
                </div>
                <HighlightsSelector
                  dictionary={dictionary}
                  highlightSelections={highlightSelections}
                  onChange={handleHighlightSelect}
                  players={highlightPlayerPool}
                />
              </section>

              <footer className="space-y-3">
                <p className="text-sm text-slate-300">{dictionaryChangeHint}</p>
                {errorMessage ? (
                  <p className="text-sm text-red-400">{errorMessage}</p>
                ) : null}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSubmit || picksLoading || gamesLoading || isSaving}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition',
                    canSubmit && !changeLimitReached
                      ? 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30'
                      : 'border-white/10 bg-navy-800/70 text-slate-400',
                  )}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {hasExistingPicks ? dictionary.play.update : dictionary.play.submit}
                </button>
              </footer>
            </div>
          ) : null}

          {activeTab === 'collection' ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">
                {dictionary.collection.title}
              </h2>
              {ownedCards.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-navy-900/50 p-6 text-sm text-slate-300">
                  {dictionary.collection.empty}
                </p>
              ) : (
                <CollectionGrid cards={ownedCards} />
              )}
            </div>
          ) : null}

          {activeTab === 'shop' ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">
                {dictionary.shop.title}
              </h2>
              <ShopGrid cards={shopCards} balance={balance} dictionary={dictionary} />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};
