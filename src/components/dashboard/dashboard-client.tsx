'use client';

import clsx from 'clsx';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Coins,
  Loader2,
  LogOut,
  UserCircle2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Listbox, Transition } from '@headlessui/react';

import '@/components/ui/listbox-hardening.css';

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
import { useTeamPlayers } from '@/hooks/useTeamPlayers';
import { buyCardAction } from '@/app/[locale]/dashboard/(shop)/actions';
import { WinnersClient } from './winners-client';

const PLAYER_CATEGORIES = [
  'top_scorer',
  'top_assist',
  'top_rebound',
  'top_dunk',
  'top_threes',
] as const;

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const fuzzyIncludes = (value: string, rawQuery: string) => {
  const query = normalizeSearchValue(rawQuery.trim());
  if (!query) {
    return true;
  }

  const normalizedValue = normalizeSearchValue(value);
  if (normalizedValue.includes(query)) {
    return true;
  }

  let searchIndex = 0;
  for (const char of query) {
    searchIndex = normalizedValue.indexOf(char, searchIndex);
    if (searchIndex === -1) {
      return false;
    }
    searchIndex += 1;
  }

  return true;
};

const getSearchPlaceholder = (locale: Locale) =>
  locale === 'it' ? 'Cerca giocatore...' : 'Search player...';

const getEmptySearchLabel = (locale: Locale) =>
  locale === 'it' ? 'Nessun giocatore trovato' : 'No players found';

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
  abbreviation?: string | null;
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
      aria-pressed={selected}
      className={clsx(
        'group flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition min-h-[64px]',
        selected
          ? 'border-accent-gold bg-accent-gold/10 shadow-card'
          : 'border-white/10 bg-navy-800/60 hover:border-accent-gold/60',
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-navy-900 text-lg font-bold text-accent-gold">
        {team.logo ? (
          <Image
            src={team.logo}
            alt={`${team.name} logo`}
            width={48}
            height={48}
            className="h-full w-full object-contain"
          />
        ) : (
          initials
        )}
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
  const homeRoster = useTeamPlayers({
    teamId: game.homeTeam.id,
    teamName: game.homeTeam.name,
    triCode: game.homeTeam.abbreviation,
  });
  const awayRoster = useTeamPlayers({
    teamId: game.awayTeam.id,
    teamName: game.awayTeam.name,
    triCode: game.awayTeam.abbreviation,
  });

  const homeOptions = useMemo(
    () =>
      homeRoster.options.map((option, index) => ({
        label: option.label,
        value: `${game.homeTeam.id}-${index}-${option.label}`,
        meta: option.meta,
        teamId: game.homeTeam.id,
      })),
    [game.homeTeam.id, homeRoster.options],
  );

  const awayOptions = useMemo(
    () =>
      awayRoster.options.map((option, index) => ({
        label: option.label,
        value: `${game.awayTeam.id}-${index}-${option.label}`,
        meta: option.meta,
        teamId: game.awayTeam.id,
      })),
    [game.awayTeam.id, awayRoster.options],
  );

  const combinedOptions = useMemo(
    () => [...homeOptions, ...awayOptions],
    [homeOptions, awayOptions],
  );

  const combinedPlayers = useMemo(() => {
    return combinedOptions.map((option) => {
      const [first, ...rest] = option.label.trim().split(/\s+/);
      return {
        id: option.value,
        fullName: option.label,
        firstName: first ?? option.label,
        lastName: rest.join(' '),
        position: option.meta.position || null,
        teamId: option.teamId,
      } satisfies PlayerSummary;
    });
  }, [combinedOptions]);

  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

  const searchPlaceholder = getSearchPlaceholder(locale);
  const emptySearchLabel = getEmptySearchLabel(locale);

  const optionMap = useMemo(
    () =>
      new Map(
        combinedOptions.map((option) => [
          option.value,
          option,
        ]),
      ),
    [combinedOptions],
  );

  const isLoading = homeRoster.loading || awayRoster.loading;
  const loadError = homeRoster.error ?? awayRoster.error ?? null;

  useEffect(() => {
    if (combinedPlayers.length) {
      onPlayersLoaded(game.id, combinedPlayers);
    }
  }, [combinedPlayers, game.id, onPlayersLoaded]);

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
      ) : loadError ? (
        <p className="text-sm text-red-400">Failed to load players: {loadError}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {PLAYER_CATEGORIES.map((category) => (
            <label key={category} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {dictionary.play.players.categories[category]}
              </span>
              <div className="nb-listbox w-full">
                <Listbox
                  value={playerSelections[category] ?? ''}
                  onChange={(value) => onChange(category, value)}
                >
                  {({ open }) => {
                    const selectedOption = optionMap.get(playerSelections[category] ?? '');
                    const selectedLabel = selectedOption
                      ? `${selectedOption.label}${selectedOption.meta.position ? ` · ${selectedOption.meta.position}` : ''}`
                      : '—';

                    const query = searchQueries[category] ?? '';
                    const filteredOptions =
                      query.trim().length === 0
                        ? combinedOptions
                        : combinedOptions.filter((option) =>
                            fuzzyIncludes(
                              `${option.label} ${option.meta.position ?? ''}`,
                              query,
                            ),
                          );
                    const showNoResults =
                      query.trim().length > 0 && filteredOptions.length === 0;
                    const optionsContent = showNoResults
                      ? (
                        <div className="px-3 py-2 text-sm italic text-slate-400">
                          {emptySearchLabel}
                        </div>
                      )
                      : filteredOptions.map((option) => {
                          const label = `${option.label}${option.meta.position ? ` · ${option.meta.position}` : ''}`;
                          return (
                            <Listbox.Option
                              key={option.value}
                              value={option.value}
                              className={({ active, selected }) =>
                                clsx(
                                  'nb-listbox-option relative cursor-pointer select-none py-2 pl-3 pr-10',
                                  active && 'nb-listbox-option--active',
                                  selected && 'nb-listbox-option--selected',
                                )
                              }
                            >
                              {({ selected }) => (
                                <>
                                  <span>{label}</span>
                                  {selected ? (
                                    <span className="absolute inset-y-0 right-3 flex items-center text-accent-gold">
                                      <Check className="h-4 w-4" />
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </Listbox.Option>
                          );
                        });

                    return (
                      <>
                        <Listbox.Button className="nb-listbox-button flex w-full cursor-pointer items-center justify-between rounded-xl border border-accent-gold bg-navy-900/90 px-3 py-2 text-left text-sm text-white shadow-card focus:outline-none">
                          <span className="truncate">{selectedLabel}</span>
                          <ChevronDown
                            className={clsx(
                              'h-4 w-4 text-accent-gold transition-transform',
                              open ? 'rotate-180' : '',
                            )}
                          />
                        </Listbox.Button>

                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-100"
                          enterFrom="opacity-0 translate-y-1"
                          enterTo="opacity-100 translate-y-0"
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <Listbox.Options className="nb-listbox-options mt-2 max-h-72 w-full overflow-auto text-sm focus:outline-none">
                            <div className="sticky top-0 z-10 border-b border-accent-gold/30 bg-[#0b1220] px-3 py-2">
                              <input
                                type="text"
                                value={query}
                                onChange={(event) =>
                                  setSearchQueries((prev) => ({
                                    ...prev,
                                    [category]: event.target.value,
                                  }))
                                }
                                placeholder={searchPlaceholder}
                                autoComplete="off"
                                className="w-full rounded-lg border border-accent-gold/40 bg-navy-900 px-2 py-1 text-sm text-white placeholder-slate-400 focus:border-accent-gold focus:outline-none"
                              />
                            </div>
                            <Listbox.Option
                              value=""
                              className={({ active, selected }) =>
                                clsx(
                                  'nb-listbox-option relative cursor-pointer select-none py-2 pl-3 pr-10',
                                  active && 'nb-listbox-option--active',
                                  selected && 'nb-listbox-option--selected',
                                )
                              }
                            >
                              {({ selected }) => (
                                <>
                                  <span>—</span>
                                  {selected ? (
                                    <span className="absolute inset-y-0 right-3 flex items-center text-accent-gold">
                                      <Check className="h-4 w-4" />
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </Listbox.Option>

                            {optionsContent}
                          </Listbox.Options>
                        </Transition>
                      </>
                    );
                  }}
                </Listbox>
              </div>
            </label>
          ))}
        </div>
      )}
      {process.env.NODE_ENV !== 'production' && (
        <div className="text-[11px] text-slate-400">
          <div>
            HOME {game.homeTeam.name} / {game.homeTeam.abbreviation ?? '—'} — players:{' '}
            {homeOptions.length}
          </div>
          <div>
            AWAY {game.awayTeam.name} / {game.awayTeam.abbreviation ?? '—'} — players:{' '}
            {awayOptions.length}
          </div>
          {loadError ? <div className="text-red-400">Error: {loadError}</div> : null}
        </div>
      )}
    </div>
  );
};

const HighlightsSelector = ({
  locale,
  dictionary,
  highlightSelections,
  onChange,
  players,
}: {
  locale: Locale;
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

  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});
  const searchPlaceholder = getSearchPlaceholder(locale);
  const emptySearchLabel = getEmptySearchLabel(locale);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 5 }).map((_, index) => {
        const rank = index + 1;
        const selectedPlayer = selectedByRank.get(rank) ?? '';
        const selectedMeta = sortedPlayers.find((player) => player.id === selectedPlayer);
        const selectedLabel = selectedMeta
          ? `${selectedMeta.fullName}${selectedMeta.position ? ` · ${selectedMeta.position}` : ''}`
          : '—';

        const query = searchQueries[rank] ?? '';
        const filteredPlayers =
          query.trim().length === 0
            ? sortedPlayers
            : sortedPlayers.filter((player) => {
                const label = `${player.fullName}${player.position ? ` ${player.position}` : ''}`;
                return fuzzyIncludes(label, query);
              });
        const showNoResults =
          query.trim().length > 0 && filteredPlayers.length === 0;
        const optionsContent = showNoResults
          ? (
            <div className="px-3 py-2 text-sm italic text-slate-400">
              {emptySearchLabel}
            </div>
          )
          : filteredPlayers.map((player) => {
              const label = `${player.fullName}${player.position ? ` · ${player.position}` : ''}`;
              const disabled =
                selectedPlayer !== player.id && selectedPlayerIds.has(player.id);
              return (
                <Listbox.Option
                  key={`${rank}-${player.id}`}
                  value={player.id}
                  disabled={disabled}
                  className={({ active, selected, disabled: optionDisabled }) =>
                    clsx(
                      'nb-listbox-option relative select-none py-2 pl-3 pr-10',
                      optionDisabled ? 'nb-listbox-option--disabled' : 'cursor-pointer',
                      !optionDisabled && active && 'nb-listbox-option--active',
                      selected && 'nb-listbox-option--selected',
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span>{label}</span>
                      {selected ? (
                        <span className="absolute inset-y-0 right-3 flex items-center text-accent-gold">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              );
            });

        return (
          <label key={rank} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {dictionary.admin.rank} #{rank}
            </span>
            <div className="nb-listbox w-full">
              <Listbox value={selectedPlayer} onChange={(value) => onChange(rank, value)}>
                {({ open }) => (
                  <>
                    <Listbox.Button className="nb-listbox-button flex w-full cursor-pointer items-center justify-between rounded-xl border border-accent-gold bg-navy-900/90 px-3 py-2 text-left text-sm text-white shadow-card focus:outline-none">
                      <span className="truncate">{selectedLabel}</span>
                      <ChevronDown
                        className={clsx(
                          'h-4 w-4 text-accent-gold transition-transform',
                          open ? 'rotate-180' : '',
                        )}
                      />
                    </Listbox.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="opacity-0 translate-y-1"
                      enterTo="opacity-100 translate-y-0"
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="nb-listbox-options mt-2 max-h-72 w-full overflow-auto text-sm focus:outline-none">
                        <div className="sticky top-0 z-10 border-b border-accent-gold/30 bg-[#0b1220] px-3 py-2">
                          <input
                            type="text"
                            value={query}
                            onChange={(event) =>
                              setSearchQueries((prev) => ({
                                ...prev,
                                [rank]: event.target.value,
                              }))
                            }
                            placeholder={searchPlaceholder}
                            autoComplete="off"
                            className="w-full rounded-lg border border-accent-gold/40 bg-navy-900 px-2 py-1 text-sm text-white placeholder-slate-400 focus:border-accent-gold focus:outline-none"
                          />
                        </div>
                        <Listbox.Option
                          value=""
                          className={({ active, selected }) =>
                            clsx(
                              'nb-listbox-option relative cursor-pointer select-none py-2 pl-3 pr-10',
                              active && 'nb-listbox-option--active',
                              selected && 'nb-listbox-option--selected',
                            )
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span>—</span>
                              {selected ? (
                                <span className="absolute inset-y-0 right-3 flex items-center text-accent-gold">
                                  <Check className="h-4 w-4" />
                                </span>
                              ) : null}
                            </>
                          )}
                        </Listbox.Option>

                        {optionsContent}
                      </Listbox.Options>
                    </Transition>
                  </>
                )}
              </Listbox>
            </div>
          </label>
        );
      })}
    </div>
  );
};

const CollectionGrid = ({
  cards,
  dictionary,
}: {
  cards: ShopCard[];
  dictionary: Dictionary;
}) => {
  const [selectedCard, setSelectedCard] = useState<ShopCard | null>(null);

  useEffect(() => {
    if (!selectedCard) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCard(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCard]);

  if (cards.length === 0) {
    return null;
  }

  const closeModal = () => setSelectedCard(null);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelectedCard(card)}
            className="group relative overflow-hidden rounded-[1.5rem] border border-accent-gold/20 bg-navy-800/70 p-5 text-left shadow-card transition hover:border-accent-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20"
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
          </button>
        ))}
      </div>

      {selectedCard ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-accent-gold/30 bg-navy-900/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              aria-label={dictionary.common.cancel}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex justify-center">
              <Image
                src={selectedCard.image_url}
                alt={selectedCard.name}
                width={900}
                height={1200}
                className="h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="mt-4 flex justify-center">
              <a
                href={selectedCard.image_url}
                download
                className="inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 font-semibold text-navy-900 shadow-card transition hover:brightness-110"
              >
                {dictionary.collection.download}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const ShopGrid = ({
  cards,
  balance,
  dictionary,
  locale,
  ownedCardIds,
  onPurchaseSuccess,
}: {
  cards: ShopCard[];
  balance: number;
  dictionary: Dictionary;
  locale: Locale;
  ownedCardIds: Set<string>;
  onPurchaseSuccess: () => void;
}) => {
  const [pendingCard, setPendingCard] = useState<ShopCard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!pendingCard) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingCard(null);
        setErrorMessage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingCard]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const localeTag = locale === 'it' ? 'it-IT' : 'en-US';

  const handleConfirmPurchase = () => {
    if (!pendingCard) {
      return;
    }
    startTransition(async () => {
      try {
        setErrorMessage(null);
        const result = await buyCardAction({
          cardId: pendingCard.id,
          locale,
        });

        if (result.ok) {
          setPendingCard(null);
          setToastMessage(dictionary.dashboard.toasts.cardPurchased);
          onPurchaseSuccess();
          return;
        }

        const message = (() => {
          switch (result.error) {
            case 'INSUFFICIENT_FUNDS':
              return dictionary.shop.insufficientPoints;
            case 'ALREADY_OWNED':
              return dictionary.shop.owned;
            case 'CARD_NOT_FOUND':
            case 'USER_CARDS_FAIL':
            case 'LEDGER_OR_USER_UPDATE_FAIL':
            case 'UNKNOWN':
            default:
              return dictionary.shop.errorGeneric;
          }
        })();
        setErrorMessage(message);
      } catch (error) {
        console.error('[ShopGrid] purchase failed', error);
        setErrorMessage(dictionary.shop.errorGeneric);
      }
    });
  };

  const closeConfirm = () => {
    setPendingCard(null);
    setErrorMessage(null);
  };

  const formattedConfirmMessage = pendingCard
    ? dictionary.shop.confirmMessage.replace(
        '{price}',
        pendingCard.price.toLocaleString(localeTag),
      )
    : '';

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const affordable = balance >= card.price;
          const alreadyOwned = ownedCardIds.has(card.id);
          const canBuy = affordable && !alreadyOwned;
          const isLoadingCard = isPending && pendingCard?.id === card.id;
          const buttonLabel = alreadyOwned
            ? dictionary.shop.owned
            : canBuy
              ? dictionary.shop.buy
              : dictionary.shop.insufficientPoints;

          return (
            <div
              key={card.id}
              className="group relative overflow-hidden rounded-[1.5rem] border border-accent-gold/20 bg-navy-800/70 p-5 shadow-card transition hover:border-accent-gold/40"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-30"
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
                <button
                  type="button"
                  onClick={() => (canBuy ? setPendingCard(card) : undefined)}
                  disabled={!canBuy || isPending}
                  className={clsx(
                    'inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed',
                    alreadyOwned
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                      : canBuy
                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30'
                        : 'border-white/10 bg-navy-900/60 text-slate-500',
                    isLoadingCard ? 'opacity-80' : '',
                  )}
                >
                  {isLoadingCard ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>{buttonLabel}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pendingCard ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeConfirm}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-accent-gold/30 bg-navy-900/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeConfirm}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              aria-label={dictionary.common.cancel}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">
                {dictionary.shop.confirmTitle}
              </h2>
              <p className="text-sm text-slate-300">{formattedConfirmMessage}</p>
              {errorMessage ? (
                <p className="text-sm text-red-400">{errorMessage}</p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-accent-gold/40 hover:text-white"
                  disabled={isPending}
                >
                  {dictionary.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPurchase}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {dictionary.common.confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-card">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </>
  );
};

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
  const [activeTab, setActiveTab] = useState<'play' | 'winners' | 'collection' | 'shop'>('play');
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

  const tabs: Array<{
    key: 'play' | 'winners' | 'collection' | 'shop';
    label: string;
  }> = [
    { key: 'play', label: dictionary.dashboard.playTab },
    { key: 'winners', label: dictionary.dashboard.winnersTab },
    { key: 'collection', label: dictionary.dashboard.collectionTab },
    { key: 'shop', label: dictionary.dashboard.shopTab },
  ];

  const ownedCardIds = useMemo(
    () => new Set(ownedCards.map((card) => card.id)),
    [ownedCards],
  );

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
    <div className="space-y-8 pb-16 pt-2 sm:pt-4 lg:pb-24">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-navy-900/60 p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {dictionary.dashboard.welcome}
          </p>
          <h1 className="text-2xl font-semibold text-white">NBAnima</h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-xs text-slate-300">
            <UserCircle2 className="h-4 w-4 text-accent-gold" />
            <span>{locale.toUpperCase()}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-accent-gold/40 bg-navy-800/80 px-5 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-navy-800/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? '…' : dictionary.common.logout}
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-6 rounded-[2rem] border border-accent-gold/40 bg-navy-900/70 p-6 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
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
        <div className="flex snap-x gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={clsx(
                'rounded-full border px-5 py-2 text-sm font-semibold transition min-h-[40px]',
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
                <div className="mt-4 flex gap-3 flex-wrap">
                  <a
                    href="https://www.nba.com/stats"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-110 transition"
                  >
                    {dictionary.play.links.nbaStats}
                  </a>
                  <a
                    href="https://www.nba.com/players/todays-lineups"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-110 transition"
                  >
                    {dictionary.play.links.nbaLineups}
                  </a>
                </div>
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
                  locale={locale}
                  dictionary={dictionary}
                  highlightSelections={highlightSelections}
                  onChange={handleHighlightSelect}
                  players={highlightPlayerPool}
                />
              </section>

              <footer className="space-y-4">
                <p className="text-sm text-slate-300">{dictionaryChangeHint}</p>
                <div
                  role="status"
                  aria-live="polite"
                  className="min-h-[1.5rem] text-sm text-red-400"
                >
                  {errorMessage ?? null}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSubmit || picksLoading || gamesLoading || isSaving}
                  className={clsx(
                    'inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition min-h-[48px]',
                    canSubmit && !changeLimitReached
                      ? 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30'
                      : 'border-white/10 bg-navy-800/70 text-slate-400',
                  )}
                  aria-busy={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {hasExistingPicks ? dictionary.play.update : dictionary.play.submit}
                </button>
              </footer>
            </div>
          ) : null}

          {activeTab === 'winners' ? (
            <WinnersClient locale={locale} dictionary={dictionary} />
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
              <CollectionGrid cards={ownedCards} dictionary={dictionary} />
            )}
          </div>
          ) : null}

          {activeTab === 'shop' ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">
                {dictionary.shop.title}
              </h2>
              <ShopGrid
                cards={shopCards}
                balance={balance}
                dictionary={dictionary}
                locale={locale}
                ownedCardIds={ownedCardIds}
                onPurchaseSuccess={() => router.refresh()}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};
