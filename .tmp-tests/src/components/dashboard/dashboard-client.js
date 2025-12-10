"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardClient = DashboardClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const image_1 = __importDefault(require("next/image"));
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const swr_1 = __importDefault(require("swr"));
const PlayerSelect_1 = require("../../components/ui/PlayerSelect");
const locale_provider_1 = require("../../components/providers/locale-provider");
const constants_1 = require("../../lib/constants");
const teamEmojis_1 = require("../../lib/teamEmojis");
const useGames_1 = require("../../hooks/useGames");
const usePicks_1 = require("../../hooks/usePicks");
const useTeamPlayers_1 = require("../../hooks/useTeamPlayers");
const winners_client_1 = require("./winners-client");
const date_us_eastern_1 = require("../../lib/date-us-eastern");
const PLAYER_CATEGORIES = ['top_scorer', 'top_assist', 'top_rebound'];
const HIGHLIGHT_SLOT_COUNT = 5;
const LOCK_WINDOW_BUFFER_MS = 5 * 60 * 1000;
const buildEmptyHighlightSlots = () => Array.from({ length: HIGHLIGHT_SLOT_COUNT }, () => '');
const fetchJson = async (url) => {
    const response = await fetch(url, {
        cache: 'no-store',
        credentials: 'include',
    });
    const payload = (await response.json().catch(() => ({})));
    if (!response.ok) {
        throw new Error(payload.error ?? 'Request failed');
    }
    return payload;
};
const normalizeTeamInput = (team) => {
    const firstNonEmpty = team?.name ??
        team?.abbreviation ??
        (team?.id != null ? String(team.id) : '') ??
        team?.full_name ?? // se mai presente
        team?.fullName ?? // se mai presente
        team?.city ?? ''; // fallback morbido
    return String(firstNonEmpty).replace(/\s+/g, ' ').trim();
};
const formatGameTime = (locale, date) => {
    const value = new Date(date);
    try {
        return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        }).format(value);
    }
    catch {
        return value.toLocaleString();
    }
};
const deriveSeasonFromDate = (iso) => {
    const date = new Date(iso);
    const fallback = new Date();
    const validDate = Number.isNaN(date.getTime()) ? fallback : date;
    const year = validDate.getUTCFullYear();
    const month = validDate.getUTCMonth(); // 0-indexed
    const startYear = month >= 6 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
};
const formatCountdown = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds]
        .map((unit) => unit.toString().padStart(2, '0'))
        .join(':');
};
const computeTeamAbbr = (team) => {
    const explicit = team.abbreviation?.trim();
    if (explicit) {
        return explicit.toUpperCase();
    }
    if (team.name) {
        const tokens = team.name.split(/\s+/).filter(Boolean);
        if (tokens.length === 1) {
            const [single] = tokens;
            if (single.length >= 3) {
                return single.slice(0, 3).toUpperCase();
            }
        }
        if (tokens.length > 0) {
            return tokens
                .map((part) => part[0] ?? '')
                .join('')
                .slice(0, 3)
                .toUpperCase();
        }
    }
    return 'UNK';
};
const normalizeProvider = (provider) => provider === 'balldontlie' ? 'balldontlie' : 'stub';
const getDefaultDashboardTab = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
    ? 'weekly'
    : 'play';
const SectionStatus = ({ complete }) => complete ? ((0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-5 w-5 text-lime-400" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.CircleDashed, { className: "h-5 w-5 text-slate-500" }));
const TeamButton = ({ team, value, selected, onSelect, disabled = false, }) => {
    const initials = (0, react_1.useMemo)(() => {
        const pieces = team.name.split(' ');
        return pieces
            .map((part) => part[0])
            .join('')
            .slice(0, 3)
            .toUpperCase();
    }, [team.name]);
    const emoji = (0, react_1.useMemo)(() => {
        const abbr = team.abbreviation ?? computeTeamAbbr(team);
        return (0, teamEmojis_1.getTeamEmojiByAbbr)(abbr);
    }, [team.abbreviation, team.name]);
    return ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => {
            if (disabled)
                return;
            onSelect(value);
        }, "aria-pressed": selected, disabled: disabled, className: (0, clsx_1.default)('group flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition min-h-[64px]', selected
            ? 'border-accent-gold bg-accent-gold/10 shadow-card'
            : 'border-white/10 bg-navy-800/60 hover:border-accent-gold/60', disabled ? 'cursor-not-allowed opacity-60 hover:border-white/10' : ''), children: [(0, jsx_runtime_1.jsx)("div", { className: "flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-navy-900 text-2xl font-bold text-accent-gold", children: emoji ? ((0, jsx_runtime_1.jsx)("span", { "aria-hidden": "true", className: "leading-none", children: emoji })) : team.logo ? ((0, jsx_runtime_1.jsx)(image_1.default, { src: team.logo, alt: `${team.name} logo`, width: 48, height: 48, className: "h-full w-full object-contain" })) : (initials) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-semibold text-white", children: team.name }), team.city ? ((0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: team.city })) : null] })] }));
};
const GameTeamsRow = ({ locale, game, selection, onSelect, disabled = false, }) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: formatGameTime(locale, game.startsAt) }), game.arena ? (0, jsx_runtime_1.jsxs)("span", { children: ["\u00B7 ", game.arena] }) : null, (0, jsx_runtime_1.jsxs)("span", { children: ["\u00B7 ", game.status] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row", children: [(0, jsx_runtime_1.jsx)(TeamButton, { team: game.awayTeam, value: "away", selected: selection === 'away', onSelect: onSelect, disabled: disabled }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-slate-400", children: "VS" }), (0, jsx_runtime_1.jsx)(TeamButton, { team: game.homeTeam, value: "home", selected: selection === 'home', onSelect: onSelect, disabled: disabled })] })] }));
const GamePlayersCard = ({ locale, dictionary, game, playerSelections, onChange, onPlayersLoaded, onSelectOpenChange, disabled = false, }) => {
    const homeTeamId = String(game.homeTeam.id);
    const awayTeamId = String(game.awayTeam.id);
    // Chiavi memoizzate e con dipendenze che NON cambiano di lunghezza
    const homeKey = (0, react_1.useMemo)(() => normalizeTeamInput(game.homeTeam), [game.homeTeam]);
    const awayKey = (0, react_1.useMemo)(() => normalizeTeamInput(game.awayTeam), [game.awayTeam]);
    const { players: apiPlayers, homePlayers: homeRosterPlayers, awayPlayers: awayRosterPlayers, missing: missingRosterKeys, isLoading: playersLoading, isError: playersError, error: playersErrorMessage, } = (0, useTeamPlayers_1.useTeamPlayers)({
        homeId: homeTeamId,
        homeAbbr: game.homeTeam.abbreviation ?? null,
        homeName: game.homeTeam.name,
        awayId: awayTeamId,
        awayAbbr: game.awayTeam.abbreviation ?? null,
        awayName: game.awayTeam.name,
    });
    const combinedPlayers = (0, react_1.useMemo)(() => {
        const map = new Map();
        apiPlayers.forEach((player) => {
            const rawName = (player.full_name || '').trim();
            const fallbackName = rawName || `Player ${player.id}`;
            const parts = fallbackName.split(/\s+/);
            const firstName = parts[0] ?? fallbackName;
            const lastName = parts.slice(1).join(' ');
            map.set(player.id, {
                id: player.id,
                fullName: fallbackName,
                firstName,
                lastName,
                position: player.position || null,
                teamId: player.team_id,
                jersey: player.jersey ?? null,
            });
        });
        return Array.from(map.values());
    }, [apiPlayers]);
    const createOptionLabel = (0, react_1.useCallback)((player) => {
        const parts = [player.fullName];
        if (player.jersey) {
            const jerseyValue = player.jersey.startsWith('#') ? player.jersey : `#${player.jersey}`;
            parts.push(jerseyValue);
        }
        if (player.position) {
            parts.push(`· ${player.position}`);
        }
        return parts.join(' ');
    }, []);
    const selectOptions = (0, react_1.useMemo)(() => combinedPlayers.map((player) => ({
        id: player.id,
        label: createOptionLabel(player),
        subtitle: player.jersey
            ? player.jersey.startsWith('#')
                ? player.jersey
                : `#${player.jersey}`
            : undefined,
        keywords: [player.fullName, player.firstName, player.lastName].filter(Boolean),
    })), [combinedPlayers, createOptionLabel]);
    const selectSections = (0, react_1.useMemo)(() => {
        const playerTeamMap = new Map();
        combinedPlayers.forEach((player) => {
            const normalizedTeamId = player.teamId !== undefined && player.teamId !== null && player.teamId !== ''
                ? String(player.teamId)
                : null;
            playerTeamMap.set(player.id, normalizedTeamId);
        });
        const homeIds = new Set(homeRosterPlayers.map((player) => String(player.id)));
        const awayIds = new Set(awayRosterPlayers.map((player) => String(player.id)));
        const belongsToHome = (optionId) => homeIds.has(optionId) || playerTeamMap.get(optionId) === homeTeamId;
        const belongsToAway = (optionId) => awayIds.has(optionId) || playerTeamMap.get(optionId) === awayTeamId;
        const homeOptions = selectOptions.filter((option) => belongsToHome(option.id));
        const awayOptions = selectOptions.filter((option) => belongsToAway(option.id));
        const assignedIds = new Set([...homeOptions, ...awayOptions].map((option) => option.id));
        const otherOptions = selectOptions.filter((option) => !assignedIds.has(option.id));
        const fallbackLabel = locale === 'it' ? 'Altri giocatori' : 'Other players';
        const homeLabel = game.homeTeam.name ?? (locale === 'it' ? 'Squadra casa' : 'Home team');
        const awayLabel = game.awayTeam.name ?? (locale === 'it' ? 'Squadra trasferta' : 'Away team');
        const sections = [];
        if (homeOptions.length > 0) {
            sections.push({ label: homeLabel, options: homeOptions });
        }
        if (awayOptions.length > 0) {
            sections.push({ label: awayLabel, options: awayOptions });
        }
        if (otherOptions.length > 0) {
            sections.push({
                label: fallbackLabel,
                options: otherOptions,
            });
        }
        return sections;
    }, [
        awayRosterPlayers,
        awayTeamId,
        combinedPlayers,
        game.awayTeam.name,
        game.homeTeam.name,
        homeRosterPlayers,
        homeTeamId,
        locale,
        selectOptions,
    ]);
    const isLoading = playersLoading;
    const loadError = playersError ? playersErrorMessage ?? 'Players unavailable' : null;
    const hasNoPlayers = !isLoading && !loadError && combinedPlayers.length === 0;
    const homeCount = homeRosterPlayers.length;
    const awayCount = awayRosterPlayers.length;
    (0, react_1.useEffect)(() => {
        if (!homeKey || !awayKey)
            return;
        let cancelled = false;
        const ctrl = new AbortController();
        (async () => {
            try {
                const url = `/api/players?` +
                    `homeName=${encodeURIComponent(homeKey)}` +
                    `&awayName=${encodeURIComponent(awayKey)}`;
                const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    console.warn('[players] fetch failed', {
                        gameId: game.id,
                        status: res.status,
                        error: body?.error,
                        input: { homeKey, awayKey },
                        attempts: body?.missing?.attempts,
                    });
                    return;
                }
                const payload = (await res.json());
                // === costruiamo PlayerSummary completo ===
                const toSummary = (player) => {
                    const fallbackName = player.id != null ? `Player ${player.id}` : 'Unknown Player';
                    const full = (player.full_name ??
                        `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim() ??
                        player.name ??
                        fallbackName)
                        .replace(/\s+/g, ' ')
                        .trim();
                    const [first, ...rest] = full.split(' ');
                    const firstName = first || full;
                    const lastName = rest.join(' ');
                    return {
                        id: String(player.id),
                        fullName: full,
                        firstName,
                        lastName,
                        position: (player.position ?? player.pos ?? null) ?? null,
                        teamId: String(player.team_id ?? player.teamId ?? ''),
                        jersey: player.jersey ?? null,
                    };
                };
                const byId = new Map();
                payload.home?.forEach((player) => {
                    if (player?.id == null)
                        return;
                    byId.set(String(player.id), toSummary(player));
                });
                payload.away?.forEach((player) => {
                    if (player?.id == null)
                        return;
                    byId.set(String(player.id), toSummary(player));
                });
                const merged = Array.from(byId.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
                if (!cancelled) {
                    onPlayersLoaded?.(game.id, merged);
                }
            }
            catch (err) {
                if (!(err instanceof DOMException && err.name === 'AbortError')) {
                    console.error('[players] fetch error', { gameId: game.id, err });
                }
            }
        })();
        return () => {
            cancelled = true;
            ctrl.abort();
        };
        if (missingRosterKeys.length) {
            console.warn('[players] Missing roster entries', {
                gameId: game.id,
                missing: missingRosterKeys,
            });
        }
    }, [awayKey, game.id, homeKey, missingRosterKeys, onPlayersLoaded]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-2xl border border-white/10 bg-navy-900/60 p-4 shadow-card", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: formatGameTime(locale, game.startsAt) }), (0, jsx_runtime_1.jsxs)("span", { children: [game.awayTeam.name, " @ ", game.homeTeam.name] })] }), isLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : null, !isLoading && loadError ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-red-400", children: loadError })) : null, !isLoading && !loadError && hasNoPlayers ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-red-400", children: "No players loaded." })) : null, combinedPlayers.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "grid gap-3 md:grid-cols-2", children: PLAYER_CATEGORIES.map((category) => {
                    const rawValue = playerSelections[category];
                    const normalizedValue = rawValue === undefined || rawValue === null || rawValue === ''
                        ? null
                        : rawValue;
                    return ((0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400", children: dictionary.play.players.categories[category] }), (0, jsx_runtime_1.jsx)(PlayerSelect_1.PlayerSelect, { options: selectOptions, sections: selectSections, value: normalizedValue ?? undefined, onChange: (playerId) => {
                                    if (disabled)
                                        return;
                                    onChange(category, playerId ?? '');
                                }, placeholder: "-", disabled: disabled || (combinedPlayers.length === 0 && isLoading), onDialogOpenChange: (open) => {
                                    if (disabled) {
                                        return;
                                    }
                                    onSelectOpenChange?.(open);
                                } })] }, category));
                }) })) : null, process.env.NODE_ENV !== 'production' && ((0, jsx_runtime_1.jsxs)("div", { className: "text-[11px] text-slate-400", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["HOME ", game.homeTeam.name, " / ", game.homeTeam.abbreviation ?? '—', " \u2014 players:", ' ', homeCount] }), (0, jsx_runtime_1.jsxs)("div", { children: ["AWAY ", game.awayTeam.name, " / ", game.awayTeam.abbreviation ?? '—', " \u2014 players:", ' ', awayCount] }), loadError ? (0, jsx_runtime_1.jsxs)("div", { className: "text-red-400", children: ["Error: ", loadError] }) : null] }))] }));
};
const HighlightsSelector = ({ dictionary, highlightSelections, onChange, players, }) => {
    const selectedPlayerIds = (0, react_1.useMemo)(() => new Set(highlightSelections.filter((value) => value)), [highlightSelections]);
    const sortedPlayers = (0, react_1.useMemo)(() => {
        const seen = new Set();
        return players.filter((player) => {
            if (seen.has(player.id)) {
                return false;
            }
            seen.add(player.id);
            return true;
        });
    }, [players]);
    const createOptionLabel = (0, react_1.useCallback)((player) => {
        const parts = [player.fullName];
        if (player.jersey) {
            const jerseyValue = player.jersey.startsWith('#') ? player.jersey : `#${player.jersey}`;
            parts.push(jerseyValue);
        }
        if (player.position) {
            parts.push(`· ${player.position}`);
        }
        return parts.join(' ');
    }, []);
    return ((0, jsx_runtime_1.jsx)("div", { className: "grid gap-3 md:grid-cols-2", children: Array.from({ length: 5 }).map((_, index) => {
            const currentSelection = highlightSelections[index] ?? '';
            const disabledIds = new Set(selectedPlayerIds);
            if (currentSelection) {
                disabledIds.delete(currentSelection);
            }
            const options = sortedPlayers.map((player) => ({
                id: player.id,
                label: createOptionLabel(player),
                subtitle: player.jersey
                    ? player.jersey.startsWith('#')
                        ? player.jersey
                        : `#${player.jersey}`
                    : undefined,
                disabled: disabledIds.has(player.id),
                keywords: [player.fullName, player.firstName, player.lastName].filter(Boolean),
            }));
            const normalizedValue = currentSelection ? currentSelection : null;
            return ((0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400", children: [dictionary.play.highlights.selectionLabel, (0, jsx_runtime_1.jsxs)("span", { className: "sr-only", children: [" ", index + 1] })] }), (0, jsx_runtime_1.jsx)(PlayerSelect_1.PlayerSelect, { options: options, value: normalizedValue ?? undefined, onChange: (playerId) => onChange(index, playerId ?? ''), placeholder: "-" })] }, index));
        }) }));
};
function DashboardClient({ locale, balance, balanceFormatted, ownedCards, shopCards, }) {
    const { dictionary } = (0, locale_provider_1.useLocale)();
    const highlightsEnabled = constants_1.FEATURES.HIGHLIGHTS_ENABLED;
    const tabsSectionRef = (0, react_1.useRef)(null);
    const numberFormatter = (0, react_1.useMemo)(() => new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-US'), [locale]);
    const ownedCount = ownedCards.length;
    const shopCount = shopCards.length;
    // Keep a stable initial tab for SSR; switch after mount if needed.
    const [activeTab, setActiveTab] = (0, react_1.useState)('play');
    const [teamSelections, setTeamSelections] = (0, react_1.useState)({});
    const [playerSelections, setPlayerSelections] = (0, react_1.useState)({});
    const [highlightSelections, setHighlightSelections] = (0, react_1.useState)(() => buildEmptyHighlightSlots());
    const [picksToast, setPicksToast] = (0, react_1.useState)(null);
    const [highlightsManuallyCompleted, setHighlightsManuallyCompleted] = (0, react_1.useState)(false);
    const [playersByGame, setPlayersByGame] = (0, react_1.useState)({});
    const [errorMessage, setErrorMessage] = (0, react_1.useState)(null);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    const [isTeamsOpen, setIsTeamsOpen] = (0, react_1.useState)(false);
    const [isPlayersOpen, setIsPlayersOpen] = (0, react_1.useState)(false);
    const [mobilePicker, setMobilePicker] = (0, react_1.useState)(null);
    const [mobileSlideIndex, setMobileSlideIndex] = (0, react_1.useState)(0);
    const [mobileTouchStartX, setMobileTouchStartX] = (0, react_1.useState)(null);
    const [mobileSaveToast, setMobileSaveToast] = (0, react_1.useState)(null);
    const [mobileSwipeLocked, setMobileSwipeLocked] = (0, react_1.useState)(false);
    const [nowTs, setNowTs] = (0, react_1.useState)(() => Date.now());
    const pickDate = (0, react_1.useMemo)(() => (0, date_us_eastern_1.toEasternYYYYMMDD)((0, date_us_eastern_1.getEasternNow)()), []);
    const { data: weeklyXpData, error: weeklyXpError, isLoading: weeklyXpLoading, } = (0, swr_1.default)('/api/me/weekly-xp', fetchJson, {
        revalidateOnFocus: false,
    });
    const { data: weeklyRankingData, error: weeklyRankingError, isLoading: weeklyRankingLoading, } = (0, swr_1.default)('/api/leaderboard/weekly', fetchJson, {
        revalidateOnFocus: false,
    });
    const { games, isLoading: gamesLoading } = (0, useGames_1.useGames)(locale);
    const { data: picks, isLoading: picksLoading, saveInitialPicks, updatePicks, } = (0, usePicks_1.usePicks)(pickDate);
    const displayGames = (0, react_1.useMemo)(() => {
        if (games.length > 0) {
            return games;
        }
        if (!picks) {
            return [];
        }
        const map = new Map();
        const normalizeFromGameMeta = (game, gameId) => ({
            id: gameId,
            startsAt: game.gameDateISO ?? pickDate,
            status: 'locked',
            arena: null,
            homeTeam: {
                id: game.home?.abbr ?? 'home',
                name: game.home?.name ?? 'Home',
                city: null,
                logo: null,
                abbreviation: game.home?.abbr ?? undefined,
            },
            awayTeam: {
                id: game.away?.abbr ?? 'away',
                name: game.away?.name ?? 'Away',
                city: null,
                logo: null,
                abbreviation: game.away?.abbr ?? undefined,
            },
        });
        const normalizeFromLegacy = (game, gameId) => ({
            id: gameId,
            startsAt: pickDate,
            status: 'locked',
            arena: null,
            homeTeam: {
                id: 'home',
                name: game.home_team_name ?? 'Home',
                city: null,
                logo: null,
                abbreviation: game.home_team_abbr ?? undefined,
            },
            awayTeam: {
                id: 'away',
                name: game.away_team_name ?? 'Away',
                city: null,
                logo: null,
                abbreviation: game.away_team_abbr ?? undefined,
            },
        });
        const maybeAdd = (gameId, game) => {
            if (!gameId || !game || map.has(gameId)) {
                return;
            }
            const isMeta = (candidate) => typeof candidate?.provider === 'string' &&
                typeof candidate?.providerGameId === 'string';
            const summary = isMeta(game)
                ? normalizeFromGameMeta(game, gameId)
                : normalizeFromLegacy(game, gameId);
            map.set(gameId, summary);
        };
        const teamGameById = new Map();
        picks.teams.forEach((entry) => {
            teamGameById.set(entry.game_id, entry.game ?? null);
            maybeAdd(entry.game_id, entry.game);
        });
        picks.players.forEach((entry) => {
            const fromTeam = teamGameById.get(entry.game_id) ?? null;
            maybeAdd(entry.game_id, fromTeam);
        });
        return Array.from(map.values());
    }, [games, picks, pickDate]);
    (0, react_1.useEffect)(() => {
        if (mobileSlideIndex >= Math.max(displayGames.length, 1)) {
            setMobileSlideIndex(0);
        }
    }, [displayGames.length, mobileSlideIndex]);
    (0, react_1.useEffect)(() => {
        const id = window.setInterval(() => setNowTs(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);
    (0, react_1.useEffect)(() => {
        if (getDefaultDashboardTab() === 'weekly') {
            setActiveTab((current) => (current === 'play' ? 'weekly' : current));
        }
    }, []);
    (0, react_1.useEffect)(() => {
        if (!picks) {
            return;
        }
        setTeamSelections(picks.teams.reduce((acc, pick) => {
            const game = pick.game ?? null;
            const selectedId = pick.selected_team_id;
            if (selectedId === 'home' || selectedId === 'away') {
                acc[pick.game_id] = selectedId;
                return acc;
            }
            if (game) {
                if (selectedId && selectedId === game.home_team_id) {
                    acc[pick.game_id] = 'home';
                    return acc;
                }
                if (selectedId && selectedId === game.away_team_id) {
                    acc[pick.game_id] = 'away';
                    return acc;
                }
            }
            acc[pick.game_id] = selectedId;
            return acc;
        }, {}));
        setPlayerSelections(picks.players.reduce((acc, pick) => {
            const providerPlayerId = pick.player?.provider_player_id ?? null;
            acc[pick.game_id] = acc[pick.game_id] ?? {};
            acc[pick.game_id][pick.category] = providerPlayerId ?? pick.player_id;
            return acc;
        }, {}));
        const sortedHighlights = [...(picks.highlights ?? [])]
            .filter((highlight) => highlight?.player_id)
            .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
        const slots = buildEmptyHighlightSlots();
        sortedHighlights.slice(0, HIGHLIGHT_SLOT_COUNT).forEach((highlight, index) => {
            slots[index] = highlight.player_id;
        });
        setHighlightSelections(slots);
        setHighlightsManuallyCompleted(false);
    }, [picks]);
    (0, react_1.useEffect)(() => {
        if (!picksToast) {
            return;
        }
        const timer = setTimeout(() => setPicksToast(null), 3000);
        return () => clearTimeout(timer);
    }, [picksToast]);
    const onPlayersLoaded = (0, react_1.useCallback)((gameId, players) => {
        setPlayersByGame((previous) => {
            const existing = previous[gameId] ?? [];
            if (existing.length === players.length &&
                existing.every((player, index) => player.id === players[index]?.id)) {
                return previous;
            }
            return { ...previous, [gameId]: players };
        });
    }, []);
    const highlightPlayerPool = (0, react_1.useMemo)(() => Object.values(playersByGame).flat(), [playersByGame]);
    const weeklyXpValue = weeklyXpData?.xp ?? 0;
    const balanceDisplay = typeof balanceFormatted === 'string' && balanceFormatted.length > 0
        ? balanceFormatted
        : String(balance ?? 0);
    const weeklyXpWeekStart = weeklyXpData?.weekStart ?? null;
    const weeklyRanking = weeklyRankingData?.ranking ?? [];
    const weeklyRankingWeekStart = weeklyRankingData?.weekStart ?? weeklyXpWeekStart ?? null;
    const weeklyXpCaption = dictionary.dashboard.weeklyRangeCaption.replace('{date}', weeklyXpWeekStart ?? '—');
    const weeklyRankingCaption = dictionary.dashboard.weeklyRangeCaption.replace('{date}', weeklyRankingWeekStart ?? '—');
    const weeklyXpErrorMessage = weeklyXpError
        ? locale === 'it'
            ? 'Impossibile caricare i Weekly XP.'
            : 'Unable to load Weekly XP.'
        : null;
    const weeklyRankingErrorMessage = weeklyRankingError
        ? locale === 'it'
            ? 'Impossibile caricare la classifica settimanale.'
            : 'Unable to load the weekly ranking.'
        : null;
    const weeklyRankingEmptyMessage = locale === 'it'
        ? 'Nessun dato settimanale disponibile al momento.'
        : 'No weekly data available yet.';
    const medals = [
        { color: 'text-amber-300', label: locale === 'it' ? 'Oro' : 'Gold' },
        { color: 'text-slate-200', label: locale === 'it' ? 'Argento' : 'Silver' },
        { color: 'text-orange-400', label: locale === 'it' ? 'Bronzo' : 'Bronze' },
    ];
    const earliestGameStartTs = (0, react_1.useMemo)(() => {
        const timestamps = displayGames
            .map((game) => new Date(game.startsAt).getTime())
            .filter((value) => Number.isFinite(value));
        if (!timestamps.length) {
            return null;
        }
        return Math.min(...timestamps);
    }, [displayGames]);
    const lockWindowDeadlineTs = (0, react_1.useMemo)(() => {
        if (!earliestGameStartTs) {
            return null;
        }
        return earliestGameStartTs - LOCK_WINDOW_BUFFER_MS;
    }, [earliestGameStartTs]);
    const lockWindowActive = (0, react_1.useMemo)(() => {
        if (!lockWindowDeadlineTs) {
            return false;
        }
        return nowTs >= lockWindowDeadlineTs;
    }, [lockWindowDeadlineTs, nowTs]);
    const teamsComplete = (0, react_1.useMemo)(() => displayGames.length > 0 && displayGames.every((game) => !!teamSelections[game.id]), [displayGames, teamSelections]);
    const playersComplete = (0, react_1.useMemo)(() => displayGames.length > 0 &&
        displayGames.every((game) => PLAYER_CATEGORIES.every((category) => Boolean(playerSelections[game.id]?.[category]))), [displayGames, playerSelections]);
    const normalizeSavedTeamSelection = (0, react_1.useCallback)((pick, game) => {
        const raw = String(pick.selected_team_id ?? '').toLowerCase();
        if (raw === 'home' || raw === 'away') {
            return raw;
        }
        const homeTokens = [
            String(game.homeTeam.id ?? '').toLowerCase(),
            String(game.homeTeam.abbreviation ?? '').toLowerCase(),
            String(pick.selected_team_abbr ?? '').toLowerCase(),
        ].filter(Boolean);
        const awayTokens = [
            String(game.awayTeam.id ?? '').toLowerCase(),
            String(game.awayTeam.abbreviation ?? '').toLowerCase(),
            String(pick.selected_team_abbr ?? '').toLowerCase(),
        ].filter(Boolean);
        if (homeTokens.includes(raw)) {
            return 'home';
        }
        if (awayTokens.includes(raw)) {
            return 'away';
        }
        return null;
    }, []);
    const savedTeamSelections = (0, react_1.useMemo)(() => {
        const map = new Map();
        if (!picks) {
            return map;
        }
        displayGames.forEach((game) => {
            const pick = picks.teams.find((entry) => entry.game_id === game.id);
            if (!pick) {
                return;
            }
            const normalized = normalizeSavedTeamSelection(pick, game);
            if (normalized) {
                map.set(game.id, normalized);
            }
        });
        return map;
    }, [displayGames, normalizeSavedTeamSelection, picks]);
    const savedTeamsComplete = (0, react_1.useMemo)(() => displayGames.length > 0 &&
        displayGames.every((game) => {
            const saved = savedTeamSelections.get(game.id);
            const current = teamSelections[game.id];
            return Boolean(saved) && saved === current;
        }), [displayGames, savedTeamSelections, teamSelections]);
    const picksTeamsComplete = (0, react_1.useMemo)(() => displayGames.length > 0 &&
        displayGames.every((game) => savedTeamSelections.has(game.id)), [displayGames, savedTeamSelections]);
    const [hasSavedTeamsOnce, setHasSavedTeamsOnce] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (picksTeamsComplete || (picks?.teams?.length ?? 0) > 0) {
            setHasSavedTeamsOnce(true);
        }
    }, [picksTeamsComplete, picks?.teams?.length]);
    const savedPlayerSelections = (0, react_1.useMemo)(() => {
        const map = new Map();
        if (!picks) {
            return map;
        }
        picks.players.forEach((pick) => {
            const resolvedId = pick.player
                ?.provider_player_id ?? pick.player_id;
            if (!resolvedId) {
                return;
            }
            const entry = map.get(pick.game_id) ?? {};
            entry[pick.category] = resolvedId;
            map.set(pick.game_id, entry);
        });
        return map;
    }, [picks]);
    const savedPlayersComplete = (0, react_1.useMemo)(() => displayGames.length > 0 &&
        displayGames.every((game) => PLAYER_CATEGORIES.every((category) => {
            const saved = savedPlayerSelections.get(game.id)?.[category];
            const current = playerSelections[game.id]?.[category];
            return Boolean(saved) && saved === current;
        })), [displayGames, playerSelections, savedPlayerSelections]);
    const picksPlayersComplete = (0, react_1.useMemo)(() => displayGames.length > 0 &&
        displayGames.every((game) => PLAYER_CATEGORIES.every((category) => {
            const saved = savedPlayerSelections.get(game.id)?.[category];
            return Boolean(saved);
        })), [displayGames, savedPlayerSelections]);
    const [hasSavedPlayersOnce, setHasSavedPlayersOnce] = (0, react_1.useState)(false);
    const savedPlayersCount = picks?.players?.length ?? 0;
    (0, react_1.useEffect)(() => {
        if (picksPlayersComplete && savedPlayersCount > 0) {
            setHasSavedPlayersOnce(true);
        }
    }, [picksPlayersComplete, savedPlayersCount]);
    const highlightsComplete = (0, react_1.useMemo)(() => {
        if (!highlightsEnabled) {
            return true;
        }
        return (highlightsManuallyCompleted ||
            highlightSelections.filter((playerId) => playerId).length === HIGHLIGHT_SLOT_COUNT);
    }, [highlightsEnabled, highlightsManuallyCompleted, highlightSelections]);
    const handleTeamsSelect = (gameId, teamId) => {
        if (lockWindowActive) {
            return;
        }
        setTeamSelections((previous) => ({ ...previous, [gameId]: teamId }));
    };
    const handlePlayerSelect = (gameId, category, playerId) => {
        if (lockWindowActive) {
            return;
        }
        setPlayerSelections((previous) => ({
            ...previous,
            [gameId]: {
                ...(previous[gameId] ?? {}),
                [category]: playerId,
            },
        }));
    };
    const handleHighlightSelect = (slotIndex, playerId) => {
        setHighlightSelections((previous) => {
            const next = [...previous];
            while (next.length < HIGHLIGHT_SLOT_COUNT) {
                next.push('');
            }
            if (!playerId) {
                next[slotIndex] = '';
                return next;
            }
            for (let i = 0; i < next.length; i += 1) {
                if (i !== slotIndex && next[i] === playerId) {
                    next[i] = '';
                }
            }
            next[slotIndex] = playerId;
            return next;
        });
    };
    const totalMobileSlides = mobilePicker ? Math.max(displayGames.length, 1) : 0;
    const openMobilePicker = (mode) => {
        if (displayGames.length === 0) {
            return;
        }
        setMobilePicker(mode);
        setMobileSlideIndex(0);
        setMobileTouchStartX(null);
    };
    const closeMobilePicker = () => {
        setMobilePicker(null);
        setMobileSlideIndex(0);
        setMobileTouchStartX(null);
    };
    const handleMobileNext = () => {
        if (!mobilePicker || totalMobileSlides === 0) {
            return;
        }
        setMobileSlideIndex((previous) => Math.min(previous + 1, totalMobileSlides - 1));
    };
    const handleMobilePrev = () => {
        if (!mobilePicker || totalMobileSlides === 0) {
            return;
        }
        setMobileSlideIndex((previous) => Math.max(previous - 1, 0));
    };
    const handleMobileTouchStart = (event) => {
        if (mobileSwipeLocked)
            return;
        setMobileTouchStartX(event.touches[0]?.clientX ?? null);
    };
    const handleMobileTouchEnd = (event) => {
        if (mobileSwipeLocked || mobileTouchStartX === null) {
            return;
        }
        const deltaX = (event.changedTouches[0]?.clientX ?? 0) - mobileTouchStartX;
        if (Math.abs(deltaX) > 40) {
            if (deltaX < 0) {
                handleMobileNext();
            }
            else {
                handleMobilePrev();
            }
        }
        setMobileTouchStartX(null);
    };
    const hasExistingPicks = Boolean(picks && picks.teams.length > 0);
    const dailyChanges = picks?.changesCount ?? 0;
    const changeHintMessage = dictionary.play.changesHint.replace('{count}', String(dailyChanges));
    const lockCountdownInfo = (0, react_1.useMemo)(() => {
        const closedLabel = locale === 'it'
            ? 'Le picks sono chiuse per oggi (chiudono 5 minuti prima dell’inizio delle partite). Torna domani per le prossime partite.'
            : 'Picks are closed for today (they lock 5 minutes before games start). Come back tomorrow for new games.';
        if (!lockWindowDeadlineTs) {
            return {
                status: 'pending',
                label: dictionary.play.lockCountdown.pending,
                time: null,
            };
        }
        const diff = lockWindowDeadlineTs - nowTs;
        if (diff <= 0) {
            return {
                status: 'closed',
                label: closedLabel,
                time: null,
            };
        }
        return {
            status: 'running',
            label: dictionary.play.lockCountdown.label,
            time: formatCountdown(diff),
        };
    }, [dictionary.play.lockCountdown, lockWindowDeadlineTs, nowTs]);
    const canSubmit = teamsComplete && !isSaving && !lockWindowActive;
    const handleSave = async (options) => {
        const allowPartialTeams = options?.allowPartialTeams ?? false;
        if (isSaving ||
            lockWindowActive ||
            picksLoading ||
            gamesLoading ||
            (games.length === 0 && !allowPartialTeams)) {
            return false;
        }
        if (!allowPartialTeams && !teamsComplete) {
            return false;
        }
        const gamesMeta = games.map((game) => {
            const providerGameId = String(game.providerGameId ?? game.id);
            const provider = normalizeProvider(game.provider);
            const startsAtDate = new Date(game.startsAt);
            const startsAtIso = Number.isNaN(startsAtDate.getTime())
                ? new Date().toISOString()
                : startsAtDate.toISOString();
            const seasonValue = game.season;
            const season = typeof seasonValue === 'number' || typeof seasonValue === 'string'
                ? String(seasonValue)
                : deriveSeasonFromDate(game.startsAt);
            return {
                provider,
                providerGameId,
                gameDateISO: startsAtIso,
                season,
                status: game.status ?? 'scheduled',
                home: {
                    abbr: computeTeamAbbr(game.homeTeam),
                    name: game.homeTeam.name ?? (game.homeTeam.city ?? 'Unknown'),
                    providerTeamId: game.homeTeam?.id
                        ? String(game.homeTeam?.id)
                        : undefined,
                },
                away: {
                    abbr: computeTeamAbbr(game.awayTeam),
                    name: game.awayTeam.name ?? (game.awayTeam.city ?? 'Unknown'),
                    providerTeamId: game.awayTeam?.id
                        ? String(game.awayTeam?.id)
                        : undefined,
                },
            };
        });
        const gameUuids = Array.from(new Set(games.map((game) => game.id)));
        const teams = games
            .map((game) => {
            const selection = teamSelections[game.id];
            if (!selection) {
                return null;
            }
            const rawSelection = String(selection);
            if (rawSelection === 'home' || rawSelection === 'away') {
                return { gameId: game.id, teamId: rawSelection };
            }
            const lowerSelection = rawSelection.toLowerCase();
            const homeAbbr = game.homeTeam.abbreviation?.toLowerCase() ?? '';
            const awayAbbr = game.awayTeam.abbreviation?.toLowerCase() ?? '';
            const homeId = String(game.homeTeam.id).toLowerCase();
            const awayId = String(game.awayTeam.id).toLowerCase();
            if (lowerSelection === homeAbbr || lowerSelection === homeId) {
                return { gameId: game.id, teamId: 'home' };
            }
            if (lowerSelection === awayAbbr || lowerSelection === awayId) {
                return { gameId: game.id, teamId: 'away' };
            }
            return null;
        })
            .filter((entry) => entry !== null && (entry.teamId === 'home' || entry.teamId === 'away'));
        const payload = {
            pickDate,
            teams,
            players: Object.entries(playerSelections).flatMap(([gameId, categories]) => Object.entries(categories)
                .filter(([, playerId]) => !!playerId)
                .map(([category, playerId]) => ({
                gameId,
                category,
                playerId,
            }))),
            highlights: highlightSelections
                .filter((playerId) => playerId)
                .map((playerId) => ({
                playerId,
            })),
            gamesMeta,
            gameUuids,
        };
        let success = false;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            if (hasExistingPicks) {
                await updatePicks(payload);
                setPicksToast(dictionary.dashboard.toasts.picksUpdated);
            }
            else {
                await saveInitialPicks(payload);
                setPicksToast(dictionary.dashboard.toasts.picksSaved);
            }
            success = true;
            if (teamsComplete) {
                setHasSavedTeamsOnce(true);
            }
            if (playersComplete) {
                setHasSavedPlayersOnce(true);
            }
        }
        catch (error) {
            setErrorMessage(error.message);
        }
        finally {
            setIsSaving(false);
        }
        return success;
    };
    const handleMobileSave = async () => {
        const saved = await handleSave({ allowPartialTeams: mobilePicker === 'players' });
        if (saved) {
            setMobileSaveToast(hasExistingPicks ? dictionary.dashboard.toasts.picksUpdated : dictionary.dashboard.toasts.picksSaved);
        }
    };
    (0, react_1.useEffect)(() => {
        if (!mobileSaveToast)
            return undefined;
        const id = window.setTimeout(() => setMobileSaveToast(null), 2500);
        return () => window.clearTimeout(id);
    }, [mobileSaveToast]);
    (0, react_1.useEffect)(() => {
        if (!mobilePicker) {
            return undefined;
        }
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [mobilePicker]);
    const tabs = [
        { key: 'play', label: dictionary.dashboard.playTab },
        { key: 'weekly', label: dictionary.dashboard.weeklyRanking },
        { key: 'myPicks', label: dictionary.dashboard.myPicksTab },
        { key: 'winners', label: dictionary.dashboard.winnersTab },
    ];
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-8 pb-16 pt-2 sm:pt-4 lg:pb-24", children: [(0, jsx_runtime_1.jsxs)("section", { className: "hidden space-y-3 sm:block", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: (0, jsx_runtime_1.jsx)("span", { className: "text-2xl font-semibold text-white", children: "NBAnima" }) }), (0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold text-white", children: "Dashboard" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-stretch", children: [(0, jsx_runtime_1.jsxs)("section", { className: "flex-1 rounded-[2rem] border border-accent-gold/40 bg-navy-900/70 p-4 shadow-card sm:p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-3 sm:gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-gold/40 bg-navy-800/70 sm:h-14 sm:w-14", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Coins, { className: "h-6 w-6 text-accent-gold sm:h-7 sm:w-7" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400 sm:text-xs", children: dictionary.dashboard.animaPoints }), (0, jsx_runtime_1.jsx)("p", { className: "text-xl font-semibold text-white sm:text-3xl", children: balanceDisplay })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-gold/40 bg-navy-800/70 sm:h-14 sm:w-14", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-6 w-6 text-accent-gold sm:h-7 sm:w-7" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1 text-center sm:text-left", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400 sm:text-xs", children: dictionary.dashboard.weeklyXpBalance }), (0, jsx_runtime_1.jsx)("div", { className: "flex min-h-[1.5rem] items-center justify-center gap-2 text-xl font-semibold text-white sm:min-h-[2.25rem] sm:text-3xl sm:justify-start", children: weeklyXpLoading ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-5 w-5 animate-spin", "aria-label": dictionary.common.loading })) : ((0, jsx_runtime_1.jsx)("span", { children: weeklyXpError ? '—' : numberFormatter.format(weeklyXpValue) })) }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-400 sm:text-xs", children: weeklyXpCaption }), weeklyXpErrorMessage ? ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-rose-300", children: weeklyXpErrorMessage })) : null] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-300", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => {
                                                    setActiveTab('weekly');
                                                    tabsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }, className: "inline-flex items-center gap-2 rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold text-accent-gold hover:border-accent-gold transition", children: [dictionary.dashboard.weeklyLeaderboardButton, (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowRight, { className: "h-3 w-3" })] }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}/dashboard/tile-flip-game`, className: "hidden items-center gap-3 rounded-full border border-accent-gold/60 bg-accent-gold/10 px-4 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold sm:inline-flex", children: [(0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-2", children: [dictionary.tileGame.sectionTitle, (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowRight, { className: "h-4 w-4" })] }), (0, jsx_runtime_1.jsx)("span", { className: "rounded-full border border-accent-gold/60 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-accent-gold", children: "+10 Anima Points" })] })] })] }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}/dashboard/trading-cards`, className: "group relative hidden w-full items-center gap-3 overflow-hidden rounded-xl border-[1.6px] border-[#d4af37] bg-navy-900/70 p-1 shadow-[0_0_25px_rgba(255,215,0,0.18)] transition hover:brightness-110 sm:flex sm:max-w-xs sm:p-2 lg:flex-1 lg:max-w-none lg:p-3 lg:self-stretch", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-accent-gold/60 bg-navy-800/80 sm:h-20 sm:w-20 lg:h-24 lg:w-24", children: [(0, jsx_runtime_1.jsx)(image_1.default, { src: "/NBAnimaTradingCards.png", alt: dictionary.tradingCards.heroImageAlt, fill: true, sizes: "192px", className: "object-cover" }), (0, jsx_runtime_1.jsx)("div", { className: "pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-navy-950/40" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-1 flex-col gap-1 text-[10px] font-semibold text-slate-200 sm:text-[11px]", children: [(0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-3 w-3 text-accent-gold sm:h-3.5 sm:w-3.5" }), numberFormatter.format(ownedCount), " ", dictionary.tradingCards.collectionBadge] }), (0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Coins, { className: "h-3 w-3 text-accent-gold sm:h-3.5 sm:w-3.5" }), numberFormatter.format(shopCount), " ", dictionary.tradingCards.shopBadge] })] }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center justify-center rounded-full border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-3 py-2 text-[11px] font-semibold text-navy-900 shadow-card transition group-hover:translate-x-1 sm:text-xs", children: dictionary.tradingCards.ctaLabel })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "sm:hidden px-1", children: (0, jsx_runtime_1.jsx)("div", { className: "mb-3 rounded-2xl border border-white/10 bg-navy-900/70 px-3 py-2 text-xs text-slate-300 shadow-card", children: lockCountdownInfo.status === 'running' ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [lockCountdownInfo.label, ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: lockCountdownInfo.time })] })) : (lockCountdownInfo.label) }) }), (0, jsx_runtime_1.jsx)("div", { className: "sm:hidden", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex snap-x gap-4 overflow-x-auto px-3 pb-3 pt-1 [-webkit-overflow-scrolling:touch]", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => openMobilePicker('teams'), disabled: displayGames.length === 0, className: (0, clsx_1.default)('group relative min-w-[220px] snap-center overflow-hidden rounded-3xl border px-3.5 py-3.5 text-left shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900', savedTeamsComplete || hasSavedTeamsOnce
                                        ? 'border-lime-300/70 ring-2 ring-lime-400/60 shadow-[0_18px_60px_rgba(132,204,22,0.35)]'
                                        : 'border-white/10 hover:scale-[1.01] hover:border-accent-gold/50', displayGames.length === 0 ? 'cursor-not-allowed opacity-60' : 'active:scale-[0.99]'), "aria-pressed": mobilePicker === 'teams', "aria-disabled": displayGames.length === 0, children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-gradient-to-br from-emerald-300/60 via-teal-300/60 to-sky-400/60" }), (0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-white/5" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative space-y-3 pt-12", children: [(0, jsx_runtime_1.jsx)("span", { className: "absolute left-3 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white", children: dictionary.play.teams.rewardBadge }), (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('absolute right-3 top-2 flex aspect-square h-7 items-center justify-center rounded-full border-2', savedTeamsComplete || hasSavedTeamsOnce
                                                        ? 'border-lime-200 bg-lime-200/25 shadow-[0_0_16px_rgba(132,204,22,0.45)]'
                                                        : 'border-white/60 bg-black/15'), children: savedTeamsComplete || hasSavedTeamsOnce ? ((0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-5 w-5 text-lime-300 drop-shadow" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.CircleDashed, { className: "h-5 w-5 text-white/90" })) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-base font-semibold text-white drop-shadow", children: dictionary.play.teams.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] leading-snug text-slate-100/90", children: dictionary.play.teams.description })] })] })] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => openMobilePicker('players'), disabled: displayGames.length === 0, className: (0, clsx_1.default)('group relative min-w-[220px] snap-center overflow-hidden rounded-3xl border px-3.5 py-3.5 text-left shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900', savedPlayersComplete || hasSavedPlayersOnce
                                        ? 'border-lime-300/70 ring-2 ring-lime-400/60 shadow-[0_18px_60px_rgba(132,204,22,0.35)]'
                                        : 'border-white/10 hover:scale-[1.01] hover:border-accent-gold/50', displayGames.length === 0 ? 'cursor-not-allowed opacity-60' : 'active:scale-[0.99]'), "aria-pressed": mobilePicker === 'players', "aria-disabled": displayGames.length === 0, children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-gradient-to-br from-fuchsia-300/60 via-violet-300/60 to-sky-300/55" }), (0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-white/5" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative space-y-3 pt-12", children: [(0, jsx_runtime_1.jsx)("span", { className: "absolute left-3 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white", children: dictionary.play.players.rewardBadge }), (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('absolute right-3 top-2 flex aspect-square h-7 items-center justify-center rounded-full border-2', savedPlayersComplete || hasSavedPlayersOnce
                                                        ? 'border-lime-200 bg-lime-200/25 shadow-[0_0_16px_rgba(132,204,22,0.45)]'
                                                        : 'border-white/60 bg-black/15'), children: savedPlayersComplete || hasSavedPlayersOnce ? ((0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-5 w-5 text-lime-300 drop-shadow" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.CircleDashed, { className: "h-5 w-5 text-white/90" })) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-base font-semibold text-white drop-shadow", children: dictionary.play.players.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] leading-snug text-slate-100/90", children: dictionary.play.players.description })] })] })] }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}/dashboard/tile-flip-game`, className: (0, clsx_1.default)('group relative min-w-[220px] snap-center overflow-hidden rounded-3xl border px-3.5 py-3.5 text-left shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900', 'border-white/12 hover:scale-[1.01] hover:border-accent-gold/50 active:scale-[0.99]'), children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-gradient-to-br from-amber-300/70 via-orange-400/60 to-rose-400/60" }), (0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-white/5" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative space-y-3 pt-12", children: [(0, jsx_runtime_1.jsx)("span", { className: "absolute left-3 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white", children: dictionary.tileGame.rewardPointsLabel }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-base font-semibold text-white drop-shadow", children: dictionary.tileGame.sectionTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] leading-snug text-slate-100/90", children: dictionary.tileGame.rewardHint })] })] })] })] }) }), (0, jsx_runtime_1.jsxs)("section", { ref: tabsSectionRef, className: "rounded-[2rem] border border-white/10 bg-navy-900/50 p-4 shadow-card", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex snap-x gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]", children: tabs.map((tab) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setActiveTab(tab.key), "aria-pressed": activeTab === tab.key, className: (0, clsx_1.default)('rounded-full border px-3 py-1 text-[10px] font-semibold transition min-h-[34px]', tab.key === 'play' ? 'hidden sm:inline-flex' : 'inline-flex', activeTab === tab.key
                                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                                        : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/30'), children: tab.label }, tab.key))) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6", children: [activeTab === 'play' ? ((0, jsx_runtime_1.jsxs)("div", { className: "hidden space-y-6 sm:block", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-semibold text-white", children: dictionary.play.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: dictionary.play.subtitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: dictionary.play.multiplierHint }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex gap-3 flex-wrap", children: [(0, jsx_runtime_1.jsx)("a", { href: "https://www.nba.com/stats", target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-110 transition", children: dictionary.play.links.nbaStats }), (0, jsx_runtime_1.jsx)("a", { href: "https://www.nba.com/players/todays-lineups", target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-110 transition", children: dictionary.play.links.nbaLineups })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setIsTeamsOpen((previous) => !previous), className: (0, clsx_1.default)('flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition', isTeamsOpen
                                                                    ? 'border-accent-gold bg-accent-gold/10 text-white shadow-card'
                                                                    : 'border-white/10 bg-navy-900/40 text-slate-200 hover:border-accent-gold/40'), "aria-expanded": isTeamsOpen, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-lg font-semibold text-white", children: dictionary.play.teams.title }), (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowRight, { className: (0, clsx_1.default)('h-4 w-4 transition-transform', isTeamsOpen ? 'rotate-90 text-accent-gold' : 'text-slate-300') })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: dictionary.play.teams.description }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold text-accent-gold", children: dictionary.play.teams.reward })] }), isTeamsOpen ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4 rounded-2xl border border-white/10 bg-navy-900/40 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(SectionStatus, { complete: savedTeamsComplete || hasSavedTeamsOnce }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: dictionary.play.teams.title })] }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center justify-center rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-gold", children: dictionary.play.teams.rewardBadge })] }), gamesLoading && displayGames.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: displayGames.map((game) => ((0, jsx_runtime_1.jsx)(GameTeamsRow, { locale: locale, game: game, selection: teamSelections[game.id], onSelect: (teamId) => handleTeamsSelect(game.id, teamId), disabled: lockWindowActive }, game.id))) }))] })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setIsPlayersOpen((previous) => !previous), className: (0, clsx_1.default)('flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition', isPlayersOpen
                                                                    ? 'border-accent-gold bg-accent-gold/10 text-white shadow-card'
                                                                    : 'border-white/10 bg-navy-900/40 text-slate-200 hover:border-accent-gold/40'), "aria-expanded": isPlayersOpen, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-lg font-semibold text-white", children: dictionary.play.players.title }), (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowRight, { className: (0, clsx_1.default)('h-4 w-4 transition-transform', isPlayersOpen ? 'rotate-90 text-accent-gold' : 'text-slate-300') })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: dictionary.play.players.description }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold text-accent-gold", children: dictionary.play.players.reward })] }), isPlayersOpen ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4 rounded-2xl border border-white/10 bg-navy-900/40 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(SectionStatus, { complete: savedPlayersComplete || hasSavedPlayersOnce }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: dictionary.play.players.title })] }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center justify-center rounded-full border border-accent-gold/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-gold", children: dictionary.play.players.rewardBadge })] }), gamesLoading && displayGames.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : (displayGames.map((game) => ((0, jsx_runtime_1.jsx)(GamePlayersCard, { locale: locale, dictionary: dictionary, game: game, playerSelections: playerSelections[game.id] ?? {}, onChange: (category, playerId) => handlePlayerSelect(game.id, category, playerId), onPlayersLoaded: onPlayersLoaded, disabled: lockWindowActive }, game.id))))] })) : null] })] }), highlightsEnabled ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(SectionStatus, { complete: highlightsComplete }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: dictionary.play.highlights.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: dictionary.play.highlights.description })] })] }), (0, jsx_runtime_1.jsx)(HighlightsSelector, { dictionary: dictionary, highlightSelections: highlightSelections, onChange: handleHighlightSelect, players: highlightPlayerPool }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setHighlightsManuallyCompleted(true), className: "rounded-lg border border-accent-gold bg-gradient-to-r from-accent-gold/90 to-accent-coral/90 px-4 py-2 text-sm font-semibold text-navy-900 shadow-card hover:brightness-105", children: dictionary?.play?.highlights?.endPicks ?? 'Termina scelte' }) })] })) : null, (0, jsx_runtime_1.jsxs)("footer", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: changeHintMessage }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: lockCountdownInfo.status === 'running' ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [lockCountdownInfo.label, ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: lockCountdownInfo.time })] })) : (lockCountdownInfo.label) }), (0, jsx_runtime_1.jsx)("div", { role: "status", "aria-live": "polite", className: "min-h-[1.5rem] text-sm text-red-400", children: errorMessage ?? null }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleSave(), disabled: !canSubmit || picksLoading || gamesLoading || isSaving || lockWindowActive, className: (0, clsx_1.default)('inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition min-h-[48px]', lockWindowActive
                                                            ? 'cursor-not-allowed border-rose-500/60 bg-rose-500/15 text-rose-100'
                                                            : canSubmit
                                                                ? 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30'
                                                                : 'border-white/10 bg-navy-800/70 text-slate-400'), "aria-busy": isSaving, children: [isSaving ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : null, lockWindowActive
                                                                ? dictionary.dashboard.lockWindowActive
                                                                : hasExistingPicks
                                                                    ? dictionary.play.update
                                                                    : dictionary.play.submit] })] })] })) : null, activeTab === 'myPicks' ? ((0, jsx_runtime_1.jsx)(winners_client_1.WinnersClient, { locale: locale, dictionary: dictionary, mode: "picksOnly", title: dictionary.dashboard.myPicksTab })) : null, activeTab === 'winners' ? ((0, jsx_runtime_1.jsx)(winners_client_1.WinnersClient, { locale: locale, dictionary: dictionary })) : null, activeTab === 'weekly' ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-semibold text-white", children: dictionary.dashboard.weeklyRanking }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: weeklyRankingCaption }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: dictionary.dashboard.weeklyXpExplainer }), (0, jsx_runtime_1.jsx)("section", { className: "rounded-2xl border border-white/10 bg-navy-900/60 p-6 shadow-card", children: (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: weeklyRankingLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : weeklyRankingErrorMessage ? ((0, jsx_runtime_1.jsx)("p", { className: "rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200", children: weeklyRankingErrorMessage })) : weeklyRanking.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-300", children: weeklyRankingEmptyMessage })) : ((0, jsx_runtime_1.jsxs)("table", { className: "min-w-full divide-y divide-white/5 text-left text-sm text-slate-200", "aria-label": dictionary.dashboard.weeklyRanking, children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-3 py-2", children: locale === 'it' ? 'Pos' : 'Pos' }), (0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-3 py-2", children: locale === 'it' ? 'Giocatore' : 'Player' }), (0, jsx_runtime_1.jsx)("th", { scope: "col", className: "px-3 py-2 text-right", children: "XP" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-white/5", children: weeklyRanking.map((row, index) => {
                                                                    const medal = medals[index];
                                                                    return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-300", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-xs font-semibold text-slate-200", children: ["#", index + 1] }), medal ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Medal, { className: (0, clsx_1.default)('h-4 w-4', medal.color), "aria-label": medal.label })) : null] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2.5", children: [(0, jsx_runtime_1.jsx)("div", { className: "relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-navy-800/70", children: row.avatar_url ? ((0, jsx_runtime_1.jsx)(image_1.default, { src: row.avatar_url, alt: row.full_name ?? 'Avatar', fill: true, sizes: "32px", className: "object-cover" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.UserCircle2, { className: "h-5 w-5 text-accent-gold", "aria-hidden": "true" })) }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-semibold text-white", children: row.full_name?.trim()?.length ? row.full_name : '—' })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right font-semibold text-white", children: numberFormatter.format(row.weekly_xp) })] }, row.user_id));
                                                                }) })] })) }) })] })) : null] })] })] }), mobilePicker ? ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black p-2 sm:p-4", role: "dialog", "aria-modal": "true", onClick: closeMobilePicker, children: (0, jsx_runtime_1.jsxs)("div", { className: "relative flex h-[calc(100vh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-black p-3 shadow-[0_25px_80px_rgba(0,0,0,0.7)] sm:h-[calc(100vh-2rem)] sm:p-5", onClick: (event) => event.stopPropagation(), children: [mobileSaveToast ? ((0, jsx_runtime_1.jsxs)("div", { className: "pointer-events-none absolute inset-x-3 top-3 z-50 flex justify-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-500/80 px-3 py-2 text-xs font-semibold text-white shadow-lg", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: mobileSaveToast })] }), "\\n              "] })) : null, (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: closeMobilePicker, className: "absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10", "aria-label": dictionary.common.cancel, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 sm:space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1 pr-12 sm:pr-20", children: [(0, jsx_runtime_1.jsx)("div", { className: "inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-accent-gold/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold", children: mobilePicker === 'teams'
                                                        ? dictionary.play.teams.rewardBadge
                                                        : dictionary.play.players.rewardBadge }), (0, jsx_runtime_1.jsx)("h3", { className: "text-xl font-semibold text-white sm:text-2xl", children: mobilePicker === 'teams'
                                                        ? dictionary.play.teams.title
                                                        : dictionary.play.players.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300 sm:max-w-3xl", children: mobilePicker === 'teams'
                                                        ? dictionary.play.teams.description
                                                        : dictionary.play.players.description })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-end gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: (0, clsx_1.default)('flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', mobilePicker === 'teams'
                                                        ? savedTeamsComplete || hasSavedTeamsOnce
                                                            ? 'border-lime-300 bg-lime-300/20 text-lime-200'
                                                            : 'border-white/10 bg-white/5 text-slate-200'
                                                        : savedPlayersComplete || hasSavedPlayersOnce
                                                            ? 'border-lime-300 bg-lime-300/20 text-lime-200'
                                                            : 'border-white/10 bg-white/5 text-slate-200'), children: [(0, jsx_runtime_1.jsx)(SectionStatus, { complete: mobilePicker === 'teams'
                                                                ? savedTeamsComplete || hasSavedTeamsOnce
                                                                : savedPlayersComplete || hasSavedPlayersOnce }), (0, jsx_runtime_1.jsx)("span", { children: locale === 'it' ? 'Completo' : 'Complete' })] }), (0, jsx_runtime_1.jsxs)("span", { className: "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200", children: [Math.min(mobileSlideIndex + 1, totalMobileSlides || 1), "/", totalMobileSlides || 1] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleMobileSave, disabled: lockWindowActive ||
                                                        isSaving ||
                                                        picksLoading ||
                                                        gamesLoading ||
                                                        displayGames.length === 0 ||
                                                        (mobilePicker === 'teams' && !teamsComplete), className: (0, clsx_1.default)('inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:text-sm', lockWindowActive
                                                        ? 'cursor-not-allowed border-rose-500/60 bg-rose-500/15 text-rose-100'
                                                        : mobilePicker === 'teams'
                                                            ? teamsComplete
                                                                ? 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30'
                                                                : 'border-white/10 bg-white/5 text-slate-300'
                                                            : 'border-lime-400/80 bg-lime-400/20 text-lime-300 hover:bg-lime-400/30'), "aria-busy": isSaving, children: [isSaving ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : null, hasExistingPicks ? dictionary.play.update : dictionary.play.submit] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black/60 p-3 sm:p-5", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute left-2 top-1/2 flex -translate-y-1/2", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleMobilePrev, disabled: mobileSlideIndex === 0, className: "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40 sm:h-11 sm:w-11", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { className: "h-6 w-6" }) }) }), (0, jsx_runtime_1.jsx)("div", { className: "absolute right-2 top-1/2 flex -translate-y-1/2", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleMobileNext, disabled: mobileSlideIndex === Math.max(totalMobileSlides - 1, 0), className: "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40 sm:h-11 sm:w-11", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-6 w-6" }) }) }), (0, jsx_runtime_1.jsx)("div", { className: "h-full overflow-y-auto pb-4", onTouchStart: handleMobileTouchStart, onTouchEnd: handleMobileTouchEnd, children: (0, jsx_runtime_1.jsx)("div", { className: "space-y-4 sm:space-y-5", children: gamesLoading && displayGames.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center gap-2 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : displayGames.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-200", children: locale === 'it'
                                                        ? 'Nessuna partita disponibile al momento.'
                                                        : 'No games available right now.' })) : ((() => {
                                                    const safeIndex = Math.min(mobileSlideIndex, displayGames.length - 1);
                                                    const game = displayGames[safeIndex];
                                                    return ((0, jsx_runtime_1.jsx)("div", { className: "space-y-3 sm:space-y-4", children: mobilePicker === 'teams' ? ((0, jsx_runtime_1.jsx)(GameTeamsRow, { locale: locale, game: game, selection: teamSelections[game.id], onSelect: (teamId) => handleTeamsSelect(game.id, teamId), disabled: lockWindowActive })) : ((0, jsx_runtime_1.jsx)(GamePlayersCard, { locale: locale, dictionary: dictionary, game: game, playerSelections: playerSelections[game.id] ?? {}, onChange: (category, playerId) => handlePlayerSelect(game.id, category, playerId), onPlayersLoaded: onPlayersLoaded, disabled: lockWindowActive, onSelectOpenChange: (open) => {
                                                                if (mobilePicker === 'players') {
                                                                    setMobileSwipeLocked(open);
                                                                }
                                                            } })) }));
                                                })()) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: locale === 'it'
                                                ? 'Swipe o usa le frecce per scorrere i match.'
                                                : 'Swipe or use arrows to move across games.' }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-1 items-center justify-end gap-2", children: Array.from({ length: Math.max(totalMobileSlides, 1) }).map((_, index) => ((0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('h-2 rounded-full transition', index === mobileSlideIndex
                                                    ? 'w-8 bg-accent-gold shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                                                    : 'w-4 bg-white/15') }, index))) })] })] })] }) })) : null, picksToast ? ((0, jsx_runtime_1.jsxs)("div", { className: "fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-card", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: picksToast })] })) : null] }));
}
