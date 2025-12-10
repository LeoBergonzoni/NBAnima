"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WinnersClient = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const react_1 = require("react");
const swr_1 = __importDefault(require("swr"));
const PicksPlayersTable_1 = require("../../components/picks/PicksPlayersTable");
const PicksTeamsTable_1 = require("../../components/picks/PicksTeamsTable");
const cells_1 = require("../../components/picks/cells");
const date_us_eastern_1 = require("../../lib/date-us-eastern");
const constants_1 = require("../../lib/constants");
const types_winners_1 = require("../../lib/types-winners");
const teamMetadata_1 = require("../../lib/teamMetadata");
function ResponsiveTable({ headers, children, }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: "hidden md:block overflow-x-auto rounded-xl border border-white/10 bg-navy-900/60 touch-scroll", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm text-left text-slate-200", children: [headers, children] }) }));
}
function MobileList({ children }) {
    return (0, jsx_runtime_1.jsx)("ul", { className: "md:hidden flex flex-col gap-3", children: children });
}
const resolveOutcomeDisplay = (value) => {
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
const createFetcher = (init) => async ([url, date]) => {
    const params = new URLSearchParams({ date });
    const response = await fetch(`${url}?${params.toString()}`, {
        cache: 'no-store',
        ...init,
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Request failed');
    }
    return response.json();
};
const fetcher = createFetcher();
const authFetcher = createFetcher({ credentials: 'include' });
const fetchRosters = async () => {
    const response = await fetch('/rosters.json', { cache: 'force-cache', credentials: 'omit' });
    if (!response.ok) {
        throw new Error('Failed to load rosters.json');
    }
    return response.json();
};
const formatSlateLabel = (locale, slate) => {
    try {
        const formatter = new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
            timeZone: 'America/New_York',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
        return formatter.format(new Date(`${slate}T00:00:00-05:00`));
    }
    catch {
        return slate;
    }
};
const resolveMultiplierRule = (wins) => {
    for (const rule of constants_1.SCORING.MULTIPLIERS) {
        if (wins >= rule.threshold) {
            return rule;
        }
    }
    return constants_1.SCORING.MULTIPLIERS[constants_1.SCORING.MULTIPLIERS.length - 1];
};
const buildTeamDisplay = (meta, fallbackName, fallbackAbbr) => {
    const id = meta?.id ?? null;
    const derivedName = meta && meta.name && id && meta.name !== id ? meta.name : null;
    const name = derivedName ?? fallbackName ?? (id ?? null);
    const abbreviation = meta?.abbreviation ?? fallbackAbbr ?? null;
    return {
        id,
        name,
        abbreviation,
    };
};
const slugIdToName = (value) => {
    const parts = value
        .split('-')
        .map((segment) => segment.trim())
        .filter(Boolean);
    if (parts.length === 0) {
        return value;
    }
    const maybePos = parts[parts.length - 1];
    const maybeNumber = parts[parts.length - 2];
    const hasPos = maybePos && maybePos.length === 1 && /[a-z]/i.test(maybePos);
    const hasNumber = maybeNumber && /^\d+$/.test(maybeNumber);
    const coreParts = parts.slice(0, parts.length - (hasPos ? 1 : 0));
    const numberPart = hasNumber ? coreParts.pop() ?? maybeNumber : null;
    const titleCased = coreParts
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
    const rebuilt = [titleCased, numberPart].filter(Boolean).join(' ').trim();
    return rebuilt || value;
};
const formatUuidAsName = () => 'Unknown Player';
const isUuidLike = (value) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
const normalizeId = (value) => (value ?? '').trim().toLowerCase();
const normalizePlayerKey = (value) => normalizeId(value).replace(/[^a-z0-9]/g, '');
const ErrorBanner = ({ message, onRetry, }) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200", children: [(0, jsx_runtime_1.jsx)("span", { children: message }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: onRetry, className: "inline-flex items-center gap-2 rounded-full border border-rose-400/40 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RotateCw, { className: "h-3.5 w-3.5" }), "Retry"] })] }));
const LoadingGrid = ({ count }) => ((0, jsx_runtime_1.jsx)("div", { className: "grid gap-4 md:grid-cols-2", children: Array.from({ length: count }).map((_, index) => ((0, jsx_runtime_1.jsx)("div", { className: "h-28 animate-pulse rounded-2xl border border-white/10 bg-navy-900/40" }, index))) }));
const LoadingTable = () => ((0, jsx_runtime_1.jsx)("div", { className: "animate-pulse rounded-2xl border border-white/10 bg-navy-900/40 p-6 text-sm text-slate-300", children: "Loading\u2026" }));
const getCategoryLabel = (dictionary, category) => dictionary.play.players.categories[category] ?? category;
const WinnersClient = ({ locale, dictionary, mode = 'full', title, }) => {
    const headerTitle = title ?? dictionary.dashboard.winners.title;
    const showWinnersSummary = mode !== 'picksOnly';
    const showMyPicksSection = mode !== 'full';
    const showPointsFooter = mode !== 'picksOnly';
    const fallbackDate = (0, react_1.useMemo)(() => (0, date_us_eastern_1.toEasternYYYYMMDD)(mode === 'picksOnly' ? (0, date_us_eastern_1.getEasternNow)() : (0, date_us_eastern_1.yesterdayInEastern)()), [mode]);
    const dateOptions = (0, react_1.useMemo)(() => {
        const base = (0, date_us_eastern_1.buildLastNDatesEastern)(14);
        const today = (0, date_us_eastern_1.toEasternYYYYMMDD)((0, date_us_eastern_1.getEasternNow)());
        const extras = mode === 'picksOnly' ? [today] : [];
        extras.push(fallbackDate);
        const ordered = [...extras, ...base];
        const seen = new Set();
        return ordered.filter((date) => {
            if (seen.has(date)) {
                return false;
            }
            seen.add(date);
            return true;
        });
    }, [fallbackDate, mode]);
    const [selectedDate, setSelectedDate] = (0, react_1.useState)(dateOptions[0] ?? fallbackDate);
    const [showSummary, setShowSummary] = (0, react_1.useState)(false);
    const [summaryLoading, setSummaryLoading] = (0, react_1.useState)(false);
    const [summaryError, setSummaryError] = (0, react_1.useState)(null);
    const [summaryData, setSummaryData] = (0, react_1.useState)(null);
    const winnersKey = (0, react_1.useMemo)(() => ['/api/winners', selectedDate], [selectedDate]);
    const picksKey = (0, react_1.useMemo)(() => ['/api/picks', selectedDate], [selectedDate]);
    const pointsKey = (0, react_1.useMemo)(() => ['/api/points-by-date', selectedDate], [selectedDate]);
    const { data: winners, error: winnersError, isLoading: winnersLoading, mutate: reloadWinners, } = (0, swr_1.default)(winnersKey, fetcher, { revalidateOnFocus: false });
    const { data: picks, error: picksError, isLoading: picksLoading, mutate: reloadPicks, } = (0, swr_1.default)(picksKey, authFetcher, { revalidateOnFocus: false });
    const { data: points, error: pointsError, isLoading: pointsLoading, mutate: reloadPoints, } = (0, swr_1.default)(pointsKey, authFetcher, { revalidateOnFocus: false });
    const { data: rosters } = (0, swr_1.default)('local-rosters-map', fetchRosters, {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });
    const summaryGames = summaryData?.games ?? [];
    const renderSummaryPerformer = (0, react_1.useCallback)((label, performers) => {
        const list = Array.isArray(performers) ? performers : [];
        if (list.length === 0) {
            return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "\u2014" })] }));
        }
        return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 space-y-1", children: list.map((performer) => {
                        const name = [performer.player?.first_name ?? '', performer.player?.last_name ?? '']
                            .join(' ')
                            .trim() || '—';
                        const team = performer.team?.abbreviation ?? '—';
                        return ((0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-white", children: [name, (0, jsx_runtime_1.jsxs)("span", { className: "text-slate-400", children: [" \u00B7 ", team] }), (0, jsx_runtime_1.jsxs)("span", { className: "ml-1 text-xs text-accent-gold", children: ["(", performer.value ?? 0, ")"] })] }, `${label}-${performer.player?.id ?? name}-${team}`));
                    }) })] }));
    }, []);
    const loadGamesSummary = (0, react_1.useCallback)(async () => {
        setSummaryLoading(true);
        setSummaryError(null);
        try {
            const response = await fetch(`/api/admin/games-summary?date=${encodeURIComponent(selectedDate)}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error ?? dictionary.dashboard.winners.gameSummaryError);
            }
            setSummaryData(payload);
        }
        catch (error) {
            setSummaryError(error?.message ?? dictionary.dashboard.winners.gameSummaryError);
            setSummaryData(null);
        }
        finally {
            setSummaryLoading(false);
        }
    }, [selectedDate, dictionary.dashboard.winners.gameSummaryError]);
    const teamWinnersByGameId = (0, react_1.useMemo)(() => {
        const map = new Map();
        (winners?.teams ?? []).forEach((team) => {
            map.set(team.game_id, team);
        });
        return map;
    }, [winners?.teams]);
    const playerWinnersByKey = (0, react_1.useMemo)(() => {
        const map = new Map();
        (winners?.players ?? []).forEach((player) => {
            const key = `${player.game_id}:${player.category}`;
            const existing = map.get(key);
            if (existing) {
                existing.push(player);
            }
            else {
                map.set(key, [player]);
            }
        });
        return map;
    }, [winners?.players]);
    const playerWinnerIdsByKey = (0, react_1.useMemo)(() => {
        const map = new Map();
        playerWinnersByKey.forEach((list, key) => {
            const ids = new Set();
            list.forEach((winner) => {
                const primary = normalizeId(winner.player_id);
                if (primary) {
                    ids.add(primary);
                }
                const provider = normalizeId(winner.provider_player_id);
                if (provider) {
                    ids.add(provider);
                }
                const nameKey = normalizePlayerKey(`${winner.first_name ?? ''} ${winner.last_name ?? ''}`);
                if (nameKey) {
                    ids.add(nameKey);
                }
            });
            map.set(key, ids);
        });
        return map;
    }, [playerWinnersByKey]);
    const teamSelections = (0, react_1.useMemo)(() => picks?.teamPicks ?? [], [picks]);
    const playerSelections = (0, react_1.useMemo)(() => picks?.playerPicks ?? [], [picks]);
    const knownTeams = (0, react_1.useMemo)(() => {
        const map = new Map();
        const register = (id, name, abbr) => {
            if (!id) {
                return;
            }
            const existing = map.get(id) ?? { id, name: null, abbreviation: null };
            if (name && (!existing.name || existing.name === id)) {
                existing.name = name;
            }
            if (abbr && !existing.abbreviation) {
                existing.abbreviation = abbr;
            }
            map.set(id, existing);
        };
        (winners?.teams ?? []).forEach((team) => {
            register(team.home_team_id, team.home_team_name, team.home_team_abbr);
            register(team.away_team_id, team.away_team_name, team.away_team_abbr);
            register(team.winner_team_id, team.winner_team_name, team.winner_team_abbr);
        });
        teamSelections.forEach((pick) => {
            register(pick.selected_team_id, pick.selected_team_name ?? null, pick.selected_team_abbr ?? null);
            const game = pick.game ?? null;
            if (game) {
                register(game.home_team_id ?? null, game.home_team_name ?? null, game.home_team_abbr ?? null);
                register(game.away_team_id ?? null, game.away_team_name ?? null, game.away_team_abbr ?? null);
            }
        });
        playerSelections.forEach((pick) => {
            const game = pick.game ?? null;
            if (game) {
                register(game.home_team_id ?? null, game.home_team_name ?? null, game.home_team_abbr ?? null);
                register(game.away_team_id ?? null, game.away_team_name ?? null, game.away_team_abbr ?? null);
            }
        });
        return map;
    }, [winners?.teams, teamSelections, playerSelections]);
    const rosterNameById = (0, react_1.useMemo)(() => {
        const map = new Map();
        if (rosters) {
            Object.values(rosters).forEach((players) => {
                players.forEach((player) => {
                    const name = player?.name?.trim();
                    if (player?.id && name && !map.has(player.id)) {
                        map.set(player.id, name);
                        map.set(player.id.toLowerCase(), name);
                    }
                });
            });
        }
        return map;
    }, [rosters]);
    const resolveTeamDisplay = (0, react_1.useCallback)((teamId, fallbackName, fallbackAbbr) => {
        if (!teamId) {
            return {
                id: null,
                name: fallbackName ?? null,
                abbreviation: fallbackAbbr ?? null,
            };
        }
        const entry = knownTeams.get(teamId);
        if (entry) {
            const nameCandidate = (entry.name && entry.name !== teamId ? entry.name : null) ??
                fallbackName ??
                entry.name ??
                teamId;
            return {
                id: teamId,
                name: nameCandidate,
                abbreviation: entry.abbreviation ?? fallbackAbbr ?? null,
            };
        }
        return buildTeamDisplay((0, teamMetadata_1.getTeamMetadata)(teamId), fallbackName, fallbackAbbr);
    }, [knownTeams]);
    const resolvePlayerName = (0, react_1.useCallback)((playerId, firstName, lastName, providerId) => {
        const rosterName = providerId
            ? rosterNameById.get(providerId) ?? rosterNameById.get(providerId.toLowerCase()) ?? null
            : null;
        let rosterFirst = '';
        let rosterLast = '';
        if (rosterName) {
            const parts = rosterName.split(/\s+/).filter(Boolean);
            if (parts.length > 0) {
                rosterFirst = parts[0] ?? '';
                rosterLast = parts.slice(1).join(' ');
            }
            else {
                rosterFirst = rosterName;
                rosterLast = '';
            }
        }
        let resolvedFirst = rosterFirst;
        let resolvedLast = rosterLast;
        const looksLikeId = (value) => value.includes('-');
        const trimmedFirstRaw = (firstName ?? '').trim();
        const trimmedLastRaw = (lastName ?? '').trim();
        const trimmedFirst = looksLikeId(trimmedFirstRaw) ? '' : trimmedFirstRaw;
        const trimmedLast = looksLikeId(trimmedLastRaw) ? '' : trimmedLastRaw;
        if (!resolvedFirst && trimmedFirst) {
            resolvedFirst = trimmedFirst;
        }
        if (!resolvedLast && trimmedLast) {
            resolvedLast = trimmedLast;
        }
        if (!resolvedFirst && !resolvedLast) {
            resolvedFirst = trimmedFirst;
            resolvedLast = trimmedLast;
        }
        if (!rosterName && providerId && !isUuidLike(providerId)) {
            const slugName = slugIdToName(providerId);
            if (!resolvedFirst && !resolvedLast && slugName) {
                const slugParts = slugName.split(' ').filter(Boolean);
                resolvedFirst = slugParts.shift() ?? slugName;
                resolvedLast = slugParts.join(' ');
            }
        }
        if (!rosterName && playerId) {
            const uuidFormatted = formatUuidAsName();
            if (!resolvedFirst && !resolvedLast) {
                resolvedFirst = uuidFormatted;
                resolvedLast = '';
            }
        }
        const builtName = `${resolvedFirst} ${resolvedLast}`.trim();
        const fallbackSource = rosterName ?? (providerId && !isUuidLike(providerId) ? slugIdToName(providerId) : null);
        const fullName = fallbackSource ?? (builtName || playerId || '—');
        return {
            fullName,
            firstName: resolvedFirst || (rosterFirst || ''),
            lastName: resolvedLast || (rosterLast || ''),
        };
    }, [rosterNameById]);
    const teamSelectionsByGameId = (0, react_1.useMemo)(() => {
        const map = new Map();
        teamSelections.forEach((pick) => {
            if (!map.has(pick.game_id)) {
                map.set(pick.game_id, pick);
            }
        });
        return map;
    }, [teamSelections]);
    const playerSelectionsByKey = (0, react_1.useMemo)(() => {
        const map = new Map();
        playerSelections.forEach((pick) => {
            const key = `${pick.game_id}:${pick.category}`;
            if (!map.has(key)) {
                map.set(key, pick);
            }
        });
        return map;
    }, [playerSelections]);
    const teamOutcomes = (0, react_1.useMemo)(() => {
        const map = new Map();
        teamSelections.forEach((pick) => {
            const winner = teamWinnersByGameId.get(pick.game_id);
            if (!winner || !winner.winner_team_id) {
                map.set(pick.game_id, 'pending');
                return;
            }
            const winningMeta = {
                id: winner.winner_team_id,
                abbr: winner.winner_team_abbr ?? null,
                name: winner.winner_team_name ?? null,
            };
            const selectedMeta = {
                id: pick.selected_team_id,
                abbr: pick.selected_team_abbr ?? null,
                name: pick.selected_team_name ?? null,
            };
            const isWin = (0, cells_1.matchesTeamIdentity)(selectedMeta, winningMeta);
            map.set(pick.game_id, isWin ? 'win' : 'loss');
        });
        return map;
    }, [teamSelections, teamWinnersByGameId]);
    const playerOutcomes = (0, react_1.useMemo)(() => {
        const map = new Map();
        playerSelections.forEach((pick) => {
            const key = `${pick.game_id}:${pick.category}`;
            const winners = playerWinnerIdsByKey.get(key);
            if (!winners || winners.size === 0) {
                map.set(key, 'pending');
                return;
            }
            const pickIds = [
                normalizeId(pick.player_id),
                normalizeId(pick.provider_player_id),
                normalizePlayerKey(`${pick.first_name ?? ''} ${pick.last_name ?? ''}`),
            ].filter(Boolean);
            const isWin = pickIds.some((id) => (id ? winners.has(id) : false));
            map.set(key, isWin ? 'win' : 'loss');
        });
        return map;
    }, [playerSelections, playerWinnerIdsByKey]);
    const teamSummaryCards = (0, react_1.useMemo)(() => {
        return (winners?.teams ?? []).map((team) => {
            const homeMeta = team.home_team_id ? (0, teamMetadata_1.getTeamMetadata)(team.home_team_id) : undefined;
            const awayMeta = team.away_team_id ? (0, teamMetadata_1.getTeamMetadata)(team.away_team_id) : undefined;
            const winnerMeta = team.winner_team_id ? (0, teamMetadata_1.getTeamMetadata)(team.winner_team_id) : undefined;
            const userPick = teamSelectionsByGameId.get(team.game_id);
            const userPickMeta = userPick?.selected_team_id
                ? (0, teamMetadata_1.getTeamMetadata)(userPick.selected_team_id)
                : undefined;
            const status = userPick ? teamOutcomes.get(team.game_id) ?? 'pending' : 'pending';
            const homeDisplay = resolveTeamDisplay(team.home_team_id, team.home_team_name, team.home_team_abbr);
            const awayDisplay = resolveTeamDisplay(team.away_team_id, team.away_team_name, team.away_team_abbr);
            const winnerDisplay = resolveTeamDisplay(team.winner_team_id ?? null, team.winner_team_name, team.winner_team_abbr);
            const pickDisplay = resolveTeamDisplay(userPick?.selected_team_id ?? null, userPick?.selected_team_name ?? null, userPick?.selected_team_abbr ?? null);
            return {
                team,
                homeMeta,
                awayMeta,
                winnerMeta,
                userPick,
                userPickMeta,
                status,
                homeDisplay,
                awayDisplay,
                winnerDisplay,
                pickDisplay,
            };
        });
    }, [winners?.teams, teamSelectionsByGameId, teamOutcomes, resolveTeamDisplay]);
    const teamSummaryCardsVisible = (0, react_1.useMemo)(() => teamSummaryCards.filter((summary) => summary.status !== 'pending'), [teamSummaryCards]);
    const playerSummaryCards = (0, react_1.useMemo)(() => {
        const grouped = new Map();
        (winners?.players ?? []).forEach((player) => {
            const key = `${player.game_id}:${player.category}`;
            const list = grouped.get(key);
            if (list) {
                list.push(player);
            }
            else {
                grouped.set(key, [player]);
            }
        });
        return Array.from(grouped.entries()).map(([key, group]) => {
            const userPick = playerSelectionsByKey.get(key);
            const status = userPick ? playerOutcomes.get(key) ?? 'pending' : 'pending';
            const winnersWithMeta = group.map((player) => {
                const teamMeta = player.team_id ? (0, teamMetadata_1.getTeamMetadata)(player.team_id) : undefined;
                return {
                    player,
                    teamDisplay: resolveTeamDisplay(player.team_id ?? null, teamMeta?.name ?? null, teamMeta?.abbreviation ?? null),
                    nameInfo: resolvePlayerName(player.player_id, player.first_name, player.last_name, player.provider_player_id ?? null),
                };
            });
            const userPickTeamMeta = userPick?.team_id ? (0, teamMetadata_1.getTeamMetadata)(userPick.team_id) : undefined;
            const userPickTeamDisplay = resolveTeamDisplay(userPick?.team_id ?? null, userPickTeamMeta?.name ?? null, userPickTeamMeta?.abbreviation ?? null);
            const userPickNameInfo = userPick
                ? resolvePlayerName(userPick.player_id, userPick.first_name ?? null, userPick.last_name ?? null, userPick.provider_player_id ?? null)
                : null;
            return {
                key,
                category: group[0]?.category ?? '',
                gameId: group[0]?.game_id ?? '',
                winners: winnersWithMeta,
                status,
                userPick,
                userPickTeamDisplay,
                userPickNameInfo,
            };
        });
    }, [winners?.players, playerSelectionsByKey, playerOutcomes, resolveTeamDisplay, resolvePlayerName]);
    const playerSummaryCardsVisible = (0, react_1.useMemo)(() => playerSummaryCards.filter((summary) => summary.status !== 'pending'), [playerSummaryCards]);
    const hasResults = (0, react_1.useMemo)(() => teamSummaryCardsVisible.length > 0 || playerSummaryCardsVisible.length > 0, [teamSummaryCardsVisible, playerSummaryCardsVisible]);
    const pickDate = picks?.date ?? selectedDate;
    const changeCount = picks?.changesCount ?? null;
    const teamTableRows = (0, react_1.useMemo)(() => {
        return teamSelections.map((pick) => {
            const status = teamOutcomes.get(pick.game_id) ?? 'pending';
            const game = pick.game ?? null;
            let fallbackName = pick.selected_team_name ?? null;
            let fallbackAbbr = pick.selected_team_abbr ?? null;
            if ((!fallbackName || fallbackName === pick.selected_team_id) && game) {
                const homeIdentity = {
                    id: game.home_team_id ?? null,
                    abbr: game.home_team_abbr ?? null,
                };
                const awayIdentity = {
                    id: game.away_team_id ?? null,
                    abbr: game.away_team_abbr ?? null,
                };
                const selectedIdentity = {
                    id: pick.selected_team_id ?? null,
                    abbr: pick.selected_team_abbr ?? null,
                };
                if ((0, cells_1.matchesTeamIdentity)(selectedIdentity, homeIdentity)) {
                    fallbackName = game.home_team_name ?? fallbackName;
                    fallbackAbbr = game.home_team_abbr ?? fallbackAbbr;
                }
                else if ((0, cells_1.matchesTeamIdentity)(selectedIdentity, awayIdentity)) {
                    fallbackName = game.away_team_name ?? fallbackName;
                    fallbackAbbr = game.away_team_abbr ?? fallbackAbbr;
                }
            }
            const display = resolveTeamDisplay(pick.selected_team_id ?? null, fallbackName, fallbackAbbr);
            return {
                game_id: pick.game_id,
                selected_team_id: pick.selected_team_id,
                selected_team_abbr: display.abbreviation,
                selected_team_name: display.name && display.name !== pick.selected_team_id
                    ? display.name
                    : fallbackName ?? pick.selected_team_id,
                pick_date: pickDate,
                result: status,
                changes_count: changeCount,
                game,
            };
        });
    }, [teamSelections, teamOutcomes, pickDate, changeCount, resolveTeamDisplay]);
    const playerTableRows = (0, react_1.useMemo)(() => {
        return playerSelections.map((pick) => {
            const teamDisplay = resolveTeamDisplay(pick.team_id ?? null, null, null);
            const key = `${pick.game_id}:${pick.category}`;
            const status = playerOutcomes.get(key) ?? 'pending';
            const nameInfo = resolvePlayerName(pick.player_id, pick.first_name ?? null, pick.last_name ?? null, pick.provider_player_id ?? null);
            return {
                game_id: pick.game_id,
                category: pick.category,
                player_id: pick.player_id,
                provider_player_id: pick.provider_player_id ?? null,
                pick_date: pickDate,
                result: status,
                changes_count: changeCount,
                player: {
                    first_name: nameInfo.firstName || null,
                    last_name: nameInfo.lastName || null,
                    position: pick.position ?? null,
                    team_abbr: teamDisplay.abbreviation ?? teamDisplay.name ?? null,
                },
                game: pick.game ?? null,
            };
        });
    }, [playerSelections, pickDate, changeCount, resolveTeamDisplay, playerOutcomes, resolvePlayerName]);
    const teamWins = (0, react_1.useMemo)(() => {
        let wins = 0;
        teamOutcomes.forEach((result) => {
            if (result === 'win') {
                wins += 1;
            }
        });
        return wins;
    }, [teamOutcomes]);
    const playerWins = (0, react_1.useMemo)(() => {
        let wins = 0;
        playerOutcomes.forEach((result) => {
            if (result === 'win') {
                wins += 1;
            }
        });
        return wins;
    }, [playerOutcomes]);
    const baseTeamPoints = teamWins * constants_1.SCORING.TEAMS_HIT;
    const basePlayerPoints = playerWins * constants_1.SCORING.PLAYER_HIT;
    const totalWins = teamWins + playerWins;
    const multiplierRule = (0, react_1.useMemo)(() => resolveMultiplierRule(totalWins), [totalWins]);
    const appliedMultiplier = multiplierRule.multiplier;
    const totalMultiplier = appliedMultiplier;
    const basePointsTotal = baseTeamPoints + basePlayerPoints;
    const multipliedPoints = basePointsTotal * appliedMultiplier;
    const multiplierDescription = multiplierRule.threshold > 0
        ? dictionary.dashboard.winners.breakdown.multiplierUnlocked.replace('{threshold}', String(multiplierRule.threshold))
        : dictionary.dashboard.winners.breakdown.multiplierBase;
    const breakdownLoading = winnersLoading || picksLoading;
    const breakdownError = winnersError ?? picksError ?? null;
    const pointsValue = points?.total_points ?? points?.total ?? 0;
    const slateDisplay = formatSlateLabel(locale, selectedDate);
    const showGameSummaryCta = mode !== 'picksOnly';
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-4 md:py-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "sticky top-0 z-20 -mx-3 sm:-mx-4 md:mx-0 bg-navy-950/80 backdrop-blur supports-[backdrop-filter]:bg-navy-950/60", children: (0, jsx_runtime_1.jsx)("div", { className: "mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-3", children: (0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-semibold text-white", children: headerTitle }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsx)("span", { children: dictionary.dashboard.winners.dateLabel }), (0, jsx_runtime_1.jsx)("select", { value: selectedDate, onChange: (event) => {
                                                    const nextValue = event.target.value;
                                                    const parsed = types_winners_1.SlateDateSchema.safeParse(nextValue);
                                                    if (parsed.success) {
                                                        setSelectedDate(parsed.data);
                                                    }
                                                }, className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none", children: dateOptions.map((dateOption) => ((0, jsx_runtime_1.jsx)("option", { value: dateOption, children: formatSlateLabel(locale, dateOption) }, dateOption))) })] }), showGameSummaryCta ? ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                            setShowSummary(true);
                                            void loadGamesSummary();
                                        }, className: "inline-flex items-center justify-center rounded-full border border-accent-gold/40 bg-accent-gold/10 px-4 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold", children: dictionary.dashboard.winners.gameSummaryCta })) : null] })] }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 pt-4 md:pt-6", children: [showWinnersSummary ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("section", { className: "rounded-2xl border border-accent-gold/30 bg-navy-900/60 p-4 shadow-card", children: pointsLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : pointsError ? ((0, jsx_runtime_1.jsx)(ErrorBanner, { message: pointsError.message ?? 'Failed to load points.', onRetry: () => {
                                        void reloadPoints();
                                    } })) : ((0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-300", children: [dictionary.dashboard.winners.pointsOfDay, ":", ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: pointsValue })] })) }), showPointsFooter ? ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-accent-gold/20 bg-navy-900/60 p-5 shadow-card", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: dictionary.dashboard.howCalculatedBoth }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: dictionary.dashboard.winners.breakdown.subtitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: dictionary.dashboard.weeklyXpExplainer })] }), (0, jsx_runtime_1.jsxs)("div", { className: "inline-flex items-center gap-2 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-4 py-2 text-sm font-semibold text-accent-gold", children: [(0, jsx_runtime_1.jsx)("span", { children: dictionary.dashboard.winners.breakdown.totalWins }), (0, jsx_runtime_1.jsx)("span", { className: "text-white", children: totalWins })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4", children: breakdownLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : breakdownError ? ((0, jsx_runtime_1.jsx)(ErrorBanner, { message: breakdownError.message ?? 'Failed to load winners breakdown.', onRetry: () => {
                                                void reloadWinners();
                                                void reloadPicks();
                                            } })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-white/[0.08] p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: dictionary.dashboard.winners.breakdown.teamsLabel }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-baseline justify-between text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-2xl font-semibold", children: teamWins }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-slate-300", children: ["\u00D7 ", constants_1.SCORING.TEAMS_HIT, " ", dictionary.dashboard.winners.breakdown.pointsUnit] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-sm text-slate-300", children: [dictionary.dashboard.winners.breakdown.pointsLabel, ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: baseTeamPoints })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-white/[0.08] p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: dictionary.dashboard.winners.breakdown.playersLabel }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-baseline justify-between text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-2xl font-semibold", children: playerWins }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-slate-300", children: ["\u00D7 ", constants_1.SCORING.PLAYER_HIT, " ", dictionary.dashboard.winners.breakdown.pointsUnit] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-sm text-slate-300", children: [dictionary.dashboard.winners.breakdown.pointsLabel, ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: basePlayerPoints })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-white/[0.08] p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: dictionary.dashboard.winners.breakdown.multiplierLabel }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-baseline justify-between text-white", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-2xl font-semibold", children: ["\u00D7", Math.max(1, totalMultiplier).toFixed(0)] }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-300", children: multiplierDescription })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-sm text-slate-300", children: [dictionary.dashboard.winners.breakdown.totalPointsLabel, ":", ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: multipliedPoints })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.06] p-4 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: dictionary.dashboard.winners.breakdown.formulaLabel }), (0, jsx_runtime_1.jsxs)("p", { children: [dictionary.dashboard.winners.breakdown.basePointsLabel, ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: basePointsTotal })] }), (0, jsx_runtime_1.jsxs)("p", { children: [dictionary.dashboard.winners.breakdown.multiplierShort, ' ', (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-white", children: ["\u00D7", Math.max(1, totalMultiplier).toFixed(0)] })] }), (0, jsx_runtime_1.jsxs)("p", { children: [dictionary.dashboard.winners.breakdown.totalPointsLabel, ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: multipliedPoints })] }), totalWins === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-sm text-slate-400", children: dictionary.dashboard.winners.breakdown.noWins })) : null] })] })) })] })) : null, winnersLoading ? ((0, jsx_runtime_1.jsx)(LoadingGrid, { count: 4 })) : winnersError ? ((0, jsx_runtime_1.jsx)(ErrorBanner, { message: winnersError.message ?? 'Failed to load winners.', onRetry: () => {
                                    void reloadWinners();
                                } })) : hasResults ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("section", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: dictionary.play.teams.title }), (0, jsx_runtime_1.jsx)(ResponsiveTable, { headers: (0, jsx_runtime_1.jsx)("thead", { className: "bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Matchup" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Winner" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: dictionary.dashboard.winners.myPick }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Esito" })] }) }), children: (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-white/10 text-sm text-slate-200", children: teamSummaryCardsVisible.map((summary) => {
                                                        const homeAbbr = summary.homeDisplay.abbreviation ??
                                                            summary.homeDisplay.name ??
                                                            'HOME';
                                                        const awayAbbr = summary.awayDisplay.abbreviation ??
                                                            summary.awayDisplay.name ??
                                                            'AWAY';
                                                        const homeName = summary.homeDisplay.name ?? summary.homeDisplay.abbreviation ?? 'Home Team';
                                                        const awayName = summary.awayDisplay.name ?? summary.awayDisplay.abbreviation ?? 'Away Team';
                                                        const winnerName = summary.winnerDisplay.name ?? '—';
                                                        const winnerAbbr = summary.winnerDisplay.abbreviation ?? '—';
                                                        const pickName = summary.pickDisplay.name ?? '—';
                                                        const pickAbbr = summary.pickDisplay.abbreviation ?? '—';
                                                        const outcome = resolveOutcomeDisplay(summary.status);
                                                        return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col", children: [(0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-white", children: [awayAbbr, " @ ", homeAbbr] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-400", children: [awayName, " \u00B7 ", homeName] })] }) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 align-top", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: winnerName }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: winnerAbbr })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 align-top", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: pickName }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: pickAbbr })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('font-semibold', outcome.className), children: outcome.label }) })] }, summary.team.game_id));
                                                    }) }) }), (0, jsx_runtime_1.jsx)(MobileList, { children: teamSummaryCardsVisible.map((summary, index) => {
                                                    const homeAbbr = summary.homeDisplay.abbreviation ??
                                                        summary.homeDisplay.name ??
                                                        'HOME';
                                                    const awayAbbr = summary.awayDisplay.abbreviation ??
                                                        summary.awayDisplay.name ??
                                                        'AWAY';
                                                    const homeName = summary.homeDisplay.name ?? summary.homeDisplay.abbreviation ?? 'Home Team';
                                                    const awayName = summary.awayDisplay.name ?? summary.awayDisplay.abbreviation ?? 'Away Team';
                                                    const winnerName = summary.winnerDisplay.name ?? '—';
                                                    const winnerAbbr = summary.winnerDisplay.abbreviation ?? '—';
                                                    const pickName = summary.pickDisplay.name ?? '—';
                                                    const pickAbbr = summary.pickDisplay.abbreviation ?? '—';
                                                    const outcome = resolveOutcomeDisplay(summary.status);
                                                    return ((0, jsx_runtime_1.jsxs)("li", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: awayAbbr }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: homeAbbr })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-slate-400", children: [awayName, " @ ", homeName] })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: outcome.label })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-1 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Scelta:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: pickName }), (0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-xs text-slate-400", children: pickAbbr })] }), (0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Esito:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('font-semibold', outcome.className), children: outcome.label })] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-xs text-slate-400", children: [slateDisplay, " \u00B7 Changes: ", changeCount ?? 0, " \u00B7 Winner:", ' ', winnerAbbr !== '—' ? winnerAbbr : winnerName] })] }, `team-winner-${summary.team.game_id}-${index}`));
                                                }) })] }), (0, jsx_runtime_1.jsxs)("section", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: dictionary.play.players.title }), (0, jsx_runtime_1.jsx)(ResponsiveTable, { headers: (0, jsx_runtime_1.jsx)("thead", { className: "bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Matchup" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Categoria" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Winner" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: dictionary.dashboard.winners.myPick }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Esito" })] }) }), children: (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-white/10 text-sm text-slate-200", children: playerSummaryCardsVisible.map((summary) => {
                                                        const userGame = summary.userPick?.game ?? null;
                                                        const teamMeta = teamWinnersByGameId.get(summary.gameId);
                                                        const homeAbbr = (userGame?.home_team_abbr ?? teamMeta?.home_team_abbr ?? 'HOME')?.toUpperCase();
                                                        const awayAbbr = (userGame?.away_team_abbr ?? teamMeta?.away_team_abbr ?? 'AWY')?.toUpperCase();
                                                        const homeName = userGame?.home_team_name ?? teamMeta?.home_team_name ?? 'Home Team';
                                                        const awayName = userGame?.away_team_name ?? teamMeta?.away_team_name ?? 'Away Team';
                                                        const outcome = resolveOutcomeDisplay(summary.status);
                                                        const pickName = summary.userPickNameInfo?.fullName ?? summary.userPick?.player_id ?? '—';
                                                        const pickTeam = summary.userPickTeamDisplay.abbreviation ??
                                                            summary.userPickTeamDisplay.name ??
                                                            '—';
                                                        return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col", children: [(0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-white", children: [awayAbbr, " @ ", homeAbbr] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-400", children: [awayName, " \u00B7 ", homeName] })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top text-xs uppercase tracking-wide text-slate-400", children: getCategoryLabel(dictionary, summary.category) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-1", children: summary.winners.map((winner) => {
                                                                            const winnerTeam = winner.teamDisplay.abbreviation ?? winner.teamDisplay.name ?? '—';
                                                                            const winnerName = winner.nameInfo.fullName ?? winner.player.player_id;
                                                                            return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: winnerName }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: winnerTeam })] }, winner.player.player_id));
                                                                        }) }) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 align-top", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: pickName }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: pickTeam })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('font-semibold', outcome.className), children: outcome.label }) })] }, summary.key));
                                                    }) }) }), (0, jsx_runtime_1.jsx)(MobileList, { children: playerSummaryCardsVisible.map((summary, index) => {
                                                    const userGame = summary.userPick?.game ?? null;
                                                    const teamMeta = teamWinnersByGameId.get(summary.gameId);
                                                    const homeAbbr = (userGame?.home_team_abbr ?? teamMeta?.home_team_abbr ?? 'HOME').toUpperCase();
                                                    const awayAbbr = (userGame?.away_team_abbr ?? teamMeta?.away_team_abbr ?? 'AWY').toUpperCase();
                                                    const homeName = userGame?.home_team_name ?? teamMeta?.home_team_name ?? 'Home Team';
                                                    const awayName = userGame?.away_team_name ?? teamMeta?.away_team_name ?? 'Away Team';
                                                    const categoryLabel = getCategoryLabel(dictionary, summary.category);
                                                    const outcome = resolveOutcomeDisplay(summary.status);
                                                    const pickName = summary.userPickNameInfo?.fullName ?? summary.userPick?.player_id ?? '—';
                                                    const pickTeam = summary.userPickTeamDisplay.abbreviation ??
                                                        summary.userPickTeamDisplay.name ??
                                                        '—';
                                                    return ((0, jsx_runtime_1.jsxs)("li", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: awayAbbr }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: homeAbbr })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-slate-400", children: [awayName, " @ ", homeName] })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: categoryLabel })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Winners" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 space-y-1", children: summary.winners.map((winner) => {
                                                                                    const winnerTeam = winner.teamDisplay.abbreviation ?? winner.teamDisplay.name ?? '—';
                                                                                    const winnerName = winner.nameInfo.fullName ?? winner.player.player_id;
                                                                                    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: winnerName }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: winnerTeam })] }, winner.player.player_id));
                                                                                }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: dictionary.dashboard.winners.myPick }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-sm font-semibold text-white", children: pickName }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: pickTeam })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Esito" }), (0, jsx_runtime_1.jsx)("div", { className: (0, clsx_1.default)('text-sm font-semibold', outcome.className), children: outcome.label })] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-xs text-slate-400", children: [slateDisplay, " \u00B7 Changes: ", changeCount ?? 0] })] }, `player-winner-${summary.key}-${index}`));
                                                }) })] })] })) : ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: dictionary.dashboard.winners.empty }))] })) : null, showMyPicksSection ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: dictionary.dashboard.myPicksTab }), picksLoading ? ((0, jsx_runtime_1.jsx)(LoadingTable, {})) : picksError ? ((0, jsx_runtime_1.jsx)(ErrorBanner, { message: picksError.message ?? 'Failed to load picks.', onRetry: () => {
                                    void reloadPicks();
                                } })) : ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "hidden gap-4 md:grid md:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(PicksTeamsTable_1.PicksTeamsTable, { className: "h-full", title: dictionary.play.teams.title, rows: teamTableRows, emptyMessage: dictionary.dashboard.winners.empty, showDateColumn: false, showChangesColumn: false, showTimestampsColumn: false }), (0, jsx_runtime_1.jsx)(PicksPlayersTable_1.PicksPlayersTable, { className: "h-full", title: dictionary.play.players.title, rows: playerTableRows, emptyMessage: dictionary.dashboard.winners.empty, formatCategory: (category) => getCategoryLabel(dictionary, category), showDateColumn: false, showChangesColumn: false, showTimestampsColumn: false, showOutcomeColumn: true })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 md:hidden", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-base font-semibold text-white", children: dictionary.play.teams.title }), (0, jsx_runtime_1.jsx)(MobileList, { children: teamTableRows.map((row, index) => {
                                                            const homeAbbr = (row.game?.home_team_abbr ?? 'HOME').toUpperCase();
                                                            const awayAbbr = (row.game?.away_team_abbr ?? 'AWY').toUpperCase();
                                                            const homeName = row.game?.home_team_name ?? row.selected_team_name ?? 'Home Team';
                                                            const awayName = row.game?.away_team_name ?? row.selected_team_name ?? 'Away Team';
                                                            const selectionLabel = row.selected_team_name ??
                                                                row.selected_team_abbr ??
                                                                row.selected_team_id ??
                                                                '—';
                                                            const outcome = resolveOutcomeDisplay(row.result);
                                                            return ((0, jsx_runtime_1.jsxs)("li", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: awayAbbr }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: homeAbbr })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-slate-400", children: [awayName, " @ ", homeName] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-1 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Scelta:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: selectionLabel })] }), (0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Esito:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('font-semibold', outcome.className), children: outcome.label })] })] })] }, `team-pick-${row.game_id ?? 'unknown'}-${index}`));
                                                        }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-base font-semibold text-white", children: dictionary.play.players.title }), (0, jsx_runtime_1.jsx)(MobileList, { children: playerTableRows.map((row, index) => {
                                                            const homeAbbr = (row.game?.home_team_abbr ?? 'HOME').toUpperCase();
                                                            const awayAbbr = (row.game?.away_team_abbr ?? 'AWY').toUpperCase();
                                                            const homeName = row.game?.home_team_name ?? 'Home Team';
                                                            const awayName = row.game?.away_team_name ?? 'Away Team';
                                                            const playerName = (() => {
                                                                const first = row.player?.first_name?.trim() ?? '';
                                                                const last = row.player?.last_name?.trim() ?? '';
                                                                const combined = `${first} ${last}`.trim();
                                                                return combined || row.player_id || '—';
                                                            })();
                                                            const categoryLabel = getCategoryLabel(dictionary, row.category);
                                                            const outcome = resolveOutcomeDisplay(row.result);
                                                            return ((0, jsx_runtime_1.jsxs)("li", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: awayAbbr }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: homeAbbr })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-slate-400", children: [awayName, " @ ", homeName] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-1 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Scelta:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: playerName }), (0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-xs text-slate-400", children: categoryLabel })] }), (0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Esito:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('font-semibold', outcome.className), children: outcome.label })] })] })] }, `player-pick-${row.game_id ?? 'unknown'}-${row.category}-${index}`));
                                                        }) })] })] })] }))] })) : null] }), showSummary ? ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:py-10", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-black/80 backdrop-blur-sm", onClick: () => setShowSummary(false) }), (0, jsx_runtime_1.jsxs)("div", { className: "relative z-10 flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex items-center justify-between border-b border-white/10 px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-accent-gold", children: dictionary.dashboard.winners.gameSummaryTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: formatSlateLabel(locale, selectedDate) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => void loadGamesSummary(), className: "inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-accent-gold/40 hover:text-accent-gold", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RotateCw, { className: "mr-1 h-3.5 w-3.5" }), "Reload"] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setShowSummary(false), className: "inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-accent-gold/40 hover:text-accent-gold", children: "Close" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 overflow-y-auto space-y-3 p-4", children: summaryLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin text-accent-gold" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : summaryError ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100", children: summaryError })) : summaryGames.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300", children: dictionary.dashboard.winners.gameSummaryEmpty })) : (summaryGames.map(({ game, topPerformers }) => {
                                    const homeWin = game.home_team_score > game.visitor_team_score;
                                    const awayWin = game.visitor_team_score > game.home_team_score;
                                    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-black p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold uppercase tracking-wide text-accent-gold/80", children: (0, cells_1.formatDateTimeNy)(game.date) }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: game.status })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col", children: [(0, jsx_runtime_1.jsx)("p", { className: (0, clsx_1.default)('text-base font-semibold', homeWin ? 'text-emerald-300' : 'text-white'), children: game.home_team.full_name }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: game.home_team.abbreviation ?? 'HOME' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('rounded-lg px-3 py-1 text-lg font-bold', homeWin ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-white'), children: game.home_team_score }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-semibold text-slate-400", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('rounded-lg px-3 py-1 text-lg font-bold', awayWin ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-white'), children: game.visitor_team_score })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col sm:items-end", children: [(0, jsx_runtime_1.jsx)("p", { className: (0, clsx_1.default)('text-base font-semibold', awayWin ? 'text-emerald-300' : 'text-white'), children: game.visitor_team.full_name }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: game.visitor_team.abbreviation ?? 'AWAY' })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 rounded-lg border border-white/10 bg-black p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Top performers" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 grid gap-3 sm:grid-cols-3", children: [renderSummaryPerformer('Punti', topPerformers.points), renderSummaryPerformer('Rimbalzi', topPerformers.rebounds), renderSummaryPerformer('Assist', topPerformers.assists)] })] })] }, game.id));
                                })) })] })] })) : null] }));
};
exports.WinnersClient = WinnersClient;
