"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminClient = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const react_1 = require("react");
const swr_1 = __importDefault(require("swr"));
const actions_1 = require("../../app/[locale]/admin/actions");
const PicksPlayersTable_1 = require("../../components/picks/PicksPlayersTable");
const PicksTeamsTable_1 = require("../../components/picks/PicksTeamsTable");
const PlayerSelect_1 = require("../../components/admin/PlayerSelect");
const AdminStorageDashboard_1 = require("../../components/AdminStorageDashboard");
const admin_1 = require("../../lib/admin");
const constants_1 = require("../../lib/constants");
const cells_1 = require("../../components/picks/cells");
const fetcher = async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to load data');
    }
    return response.json();
};
const fullName = (p) => [p?.first_name ?? '', p?.last_name ?? ''].join(' ').trim() || '—';
const ADMIN_TABS = [
    'users',
    'picks',
    'winnersTeams',
    'winnersPlayers',
    'highlights',
    'storage',
    'rosters',
];
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
const AdminClient = ({ locale, dictionary, users, shopCards, highlights, }) => {
    const [activeTab, setActiveTab] = (0, react_1.useState)('users');
    const [search, setSearch] = (0, react_1.useState)('');
    const [adjustPending, startAdjust] = (0, react_1.useTransition)();
    const [cardPending, startCardTransition] = (0, react_1.useTransition)();
    const [highlightPending, startHighlight] = (0, react_1.useTransition)();
    const [publishTeamsPending, startPublishTeams] = (0, react_1.useTransition)();
    const [publishPlayersPending, startPublishPlayers] = (0, react_1.useTransition)();
    const [selectedUser, setSelectedUser] = (0, react_1.useState)(users[0]?.id ?? '');
    const [selectedCard, setSelectedCard] = (0, react_1.useState)({});
    const [picksDate, setPicksDate] = (0, react_1.useState)(new Date().toISOString().slice(0, 10));
    const [highlightDate, setHighlightDate] = (0, react_1.useState)(highlights[0]?.result_date ?? new Date().toISOString().slice(0, 10));
    const [highlightForm, setHighlightForm] = (0, react_1.useState)(highlights.map((entry) => ({
        rank: entry.rank,
        playerId: entry.player_id,
    })));
    const [statusMessage, setStatusMessage] = (0, react_1.useState)(null);
    const defaultWinnersDate = (0, react_1.useMemo)(() => (0, date_fns_tz_1.formatInTimeZone)((0, date_fns_1.subDays)(new Date(), 1), constants_1.TIMEZONES.US_EASTERN, 'yyyy-MM-dd'), []);
    const [winnersDate, setWinnersDate] = (0, react_1.useState)(defaultWinnersDate);
    const [teamWinnerOverrides, setTeamWinnerOverrides] = (0, react_1.useState)({});
    const [playerWinnerOverrides, setPlayerWinnerOverrides] = (0, react_1.useState)({});
    (0, react_1.useEffect)(() => {
        if (!statusMessage) {
            return;
        }
        const timeout = window.setTimeout(() => setStatusMessage(null), 4000);
        return () => window.clearTimeout(timeout);
    }, [statusMessage]);
    const filteredUsers = (0, react_1.useMemo)(() => {
        if (!search.trim()) {
            return users;
        }
        const query = search.toLowerCase();
        return users.filter((user) => [user.full_name ?? '', user.email]
            .join(' ')
            .toLowerCase()
            .includes(query));
    }, [users, search]);
    const { data: picksPreview, isLoading: picksLoading } = (0, swr_1.default)(selectedUser
        ? `/api/picks?date=${picksDate}&userId=${selectedUser}`
        : null, fetcher);
    const teamWinnersKey = (0, react_1.useMemo)(() => winnersDate
        ? ['admin-team-winners', winnersDate]
        : null, [winnersDate]);
    const playerWinnersKey = (0, react_1.useMemo)(() => winnersDate
        ? ['admin-player-winners', winnersDate]
        : null, [winnersDate]);
    const { data: teamWinnersData, isLoading: teamWinnersLoading, mutate: mutateTeamWinners, error: teamWinnersError, } = (0, swr_1.default)(teamWinnersKey, ([, date]) => (0, actions_1.loadTeamWinners)(date), { revalidateOnFocus: false });
    const { data: playerWinnersData, isLoading: playerWinnersLoading, mutate: mutatePlayerWinners, error: playerWinnersError, } = (0, swr_1.default)(playerWinnersKey, ([, date]) => (0, actions_1.loadPlayerWinners)(date), { revalidateOnFocus: false });
    const baseTeamSelections = (0, react_1.useMemo)(() => {
        if (!teamWinnersData) {
            return {};
        }
        return teamWinnersData.games.reduce((acc, game) => {
            if (game.winnerTeamId) {
                acc[game.id] = game.winnerTeamId;
            }
            return acc;
        }, {});
    }, [teamWinnersData]);
    const basePlayerSelections = (0, react_1.useMemo)(() => {
        if (!playerWinnersData) {
            return {};
        }
        return playerWinnersData.games.reduce((acc, game) => {
            const categories = {};
            game.categories.forEach((category) => {
                categories[category.category] = category.winnerPlayerIds ?? [];
            });
            acc[game.id] = categories;
            return acc;
        }, {});
    }, [playerWinnersData]);
    const gameById = (0, react_1.useMemo)(() => {
        const map = new Map();
        (picksPreview?.teams ?? []).forEach((team) => {
            const record = team;
            const game = record.game;
            const key = (typeof game?.id === 'string' && game.id) ||
                (typeof record.game_id === 'string' && record.game_id) ||
                null;
            if (key && game) {
                map.set(key, game);
            }
        });
        (picksPreview?.players ?? []).forEach((player) => {
            const record = player;
            const game = record.game;
            const key = (typeof game?.id === 'string' && game.id) ||
                (typeof record.game_id === 'string' && record.game_id) ||
                null;
            if (key && game) {
                map.set(key, game);
            }
        });
        return map;
    }, [picksPreview?.teams, picksPreview?.players]);
    const defaultPickDate = picksPreview?.pickDate ?? picksDate;
    const picksTeamWinnersKey = (0, react_1.useMemo)(() => activeTab === 'picks' && selectedUser && defaultPickDate
        ? ['admin-picks-team-winners', defaultPickDate]
        : null, [activeTab, selectedUser, defaultPickDate]);
    const picksPlayerWinnersKey = (0, react_1.useMemo)(() => activeTab === 'picks' && selectedUser && defaultPickDate
        ? ['admin-picks-player-winners', defaultPickDate]
        : null, [activeTab, selectedUser, defaultPickDate]);
    const { data: picksTeamWinnersData } = (0, swr_1.default)(picksTeamWinnersKey, ([, date]) => (0, actions_1.loadTeamWinners)(date), { revalidateOnFocus: false });
    const { data: picksPlayerWinnersData } = (0, swr_1.default)(picksPlayerWinnersKey, ([, date]) => (0, actions_1.loadPlayerWinners)(date), { revalidateOnFocus: false });
    const teamWinnersByGameIdForPicks = (0, react_1.useMemo)(() => {
        if (!picksTeamWinnersData) {
            return null;
        }
        return picksTeamWinnersData.games.reduce((acc, game) => {
            acc[game.id] = game.winnerTeamId ?? null;
            return acc;
        }, {});
    }, [picksTeamWinnersData]);
    const playerWinnersByKeyForPicks = (0, react_1.useMemo)(() => {
        if (!picksPlayerWinnersData) {
            return null;
        }
        return picksPlayerWinnersData.games.reduce((acc, game) => {
            game.categories.forEach((category) => {
                acc[`${game.id}:${category.category}`] = category.winnerPlayerIds ?? [];
            });
            return acc;
        }, {});
    }, [picksPlayerWinnersData]);
    const teamTableRows = (picksPreview?.teams ?? []).map((team) => {
        const record = team;
        const game = record.game ??
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
        const record = player;
        const game = record.game ??
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
                const winnerIds = key && playerWinnersByKeyForPicks
                    ? playerWinnersByKeyForPicks[key]
                    : undefined;
                const fallback = record.result ?? null;
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
                const isWinner = winnerIds.some((winner) => winner.trim().toLowerCase() === normalizedPick);
                return isWinner
                    ? 'win'
                    : 'loss';
            })(),
            player: record.player ?? null,
            game,
        };
    });
    const formatCategoryLabel = (0, react_1.useCallback)((category) => {
        const categories = dictionary.play.players.categories;
        return categories[category] ?? category;
    }, [dictionary.play.players.categories]);
    const resolvePlayerOptionLabel = (0, react_1.useCallback)((gameId, categoryId, playerId) => {
        const game = playerWinnersData?.games.find((entry) => entry.id === gameId);
        const category = game?.categories.find((entry) => entry.category === categoryId);
        const option = category?.options.find((entry) => entry.value === playerId);
        return option?.label ?? playerId;
    }, [playerWinnersData]);
    const buildSelectionFromBase = (0, react_1.useCallback)((gameId, categoryId, playerId) => ({
        id: playerId,
        supabaseId: playerId,
        source: 'supabase',
        label: resolvePlayerOptionLabel(gameId, categoryId, playerId),
    }), [resolvePlayerOptionLabel]);
    const handleTeamWinnerChange = (0, react_1.useCallback)((gameId, winnerId) => {
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
    }, [baseTeamSelections]);
    const handlePlayerWinnerChange = (0, react_1.useCallback)((gameId, category, index, selection) => {
        setPlayerWinnerOverrides((previous) => {
            const next = { ...previous };
            const perGame = { ...(next[gameId] ?? {}) };
            const baseIds = basePlayerSelections[gameId]?.[category] ?? [];
            const existing = perGame[category]
                ? [...perGame[category]]
                : baseIds.map((playerId) => buildSelectionFromBase(gameId, category, playerId));
            while (existing.length <= index) {
                existing.push(null);
            }
            existing[index] = selection;
            const normalized = existing
                .filter((entry) => Boolean(entry && (entry.supabaseId ?? entry.id)))
                .map((entry) => (entry.supabaseId ?? entry.id))
                .sort();
            const baseNormalized = baseIds.slice().sort();
            const hasPlaceholders = existing.some((entry) => !entry || !(entry.supabaseId ?? entry.id));
            if (!hasPlaceholders &&
                normalized.length === baseNormalized.length &&
                normalized.every((value, idx) => value === baseNormalized[idx])) {
                delete perGame[category];
            }
            else {
                perGame[category] = existing;
            }
            if (Object.keys(perGame).length === 0) {
                delete next[gameId];
            }
            else {
                next[gameId] = perGame;
            }
            return next;
        });
    }, [basePlayerSelections, buildSelectionFromBase]);
    const handleAddPlayerWinner = (0, react_1.useCallback)((gameId, category) => {
        setPlayerWinnerOverrides((previous) => {
            const next = { ...previous };
            const perGame = { ...(next[gameId] ?? {}) };
            const baseIds = basePlayerSelections[gameId]?.[category] ?? [];
            const existing = perGame[category]
                ? [...perGame[category]]
                : baseIds.map((playerId) => buildSelectionFromBase(gameId, category, playerId));
            existing.push(null);
            perGame[category] = existing;
            next[gameId] = perGame;
            return next;
        });
    }, [basePlayerSelections, buildSelectionFromBase]);
    const handleRemovePlayerWinner = (0, react_1.useCallback)((gameId, category, index) => {
        setPlayerWinnerOverrides((previous) => {
            const next = { ...previous };
            const perGame = { ...(next[gameId] ?? {}) };
            const baseIds = basePlayerSelections[gameId]?.[category] ?? [];
            const existing = perGame[category]
                ? [...perGame[category]]
                : baseIds.map((playerId) => buildSelectionFromBase(gameId, category, playerId));
            if (index < 0 || index >= existing.length) {
                return previous;
            }
            existing.splice(index, 1);
            const hasNonNull = existing.some((entry) => entry && (entry.supabaseId ?? entry.id));
            if (!hasNonNull) {
                existing.length = 0;
            }
            const normalized = existing
                .filter((entry) => Boolean(entry && (entry.supabaseId ?? entry.id)))
                .map((entry) => (entry.supabaseId ?? entry.id))
                .sort();
            const baseNormalized = baseIds.slice().sort();
            if (existing.length === 0 && baseNormalized.length === 0) {
                delete perGame[category];
            }
            else if (existing.length > 0 &&
                normalized.length === baseNormalized.length &&
                normalized.every((value, idx) => value === baseNormalized[idx])) {
                delete perGame[category];
            }
            else {
                perGame[category] = existing;
            }
            if (Object.keys(perGame).length === 0) {
                delete next[gameId];
            }
            else {
                next[gameId] = perGame;
            }
            return next;
        });
    }, [basePlayerSelections, buildSelectionFromBase]);
    const handleResetPlayerWinnerCategory = (0, react_1.useCallback)((gameId, category) => {
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
            }
            else {
                next[gameId] = perGame;
            }
            return next;
        });
    }, []);
    const handleWinnersDateChange = (0, react_1.useCallback)((value) => {
        setWinnersDate(value);
        setTeamWinnerOverrides({});
        setPlayerWinnerOverrides({});
    }, []);
    const handlePublishTeamWinners = (0, react_1.useCallback)(() => {
        if (!teamWinnersData) {
            return;
        }
        const payload = teamWinnersData.games
            .map((game) => {
            const selected = teamWinnerOverrides[game.id] ?? baseTeamSelections[game.id] ?? null;
            return selected
                ? {
                    gameId: game.id,
                    winnerTeamId: selected,
                }
                : null;
        })
            .filter((entry) => entry !== null);
        startPublishTeams(async () => {
            try {
                await (0, actions_1.publishTeamWinners)(winnersDate, payload, locale);
                setStatusMessage({
                    kind: 'success',
                    message: 'Vincitori Teams pubblicati.',
                });
                await mutateTeamWinners();
                setTeamWinnerOverrides({});
            }
            catch (error) {
                setStatusMessage({
                    kind: 'error',
                    message: error?.message ??
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
    const handlePublishPlayerWinners = (0, react_1.useCallback)(() => {
        if (!playerWinnersData) {
            return;
        }
        const payload = Object.entries(playerWinnerOverrides)
            .flatMap(([gameId, categories]) => Object.entries(categories).map(([categoryId, selections]) => {
            const entries = (selections ?? []).filter((selection) => Boolean(selection && (selection.supabaseId ?? selection.id)));
            const normalized = entries
                .map((selection) => (selection.supabaseId ?? selection.id))
                .sort();
            const baseNormalized = (basePlayerSelections[gameId]?.[categoryId] ?? [])
                .slice()
                .sort();
            const hasPlaceholders = (selections ?? []).some((selection) => !selection || !(selection.supabaseId ?? selection.id));
            if (!hasPlaceholders &&
                normalized.length === baseNormalized.length &&
                normalized.every((value, idx) => value === baseNormalized[idx])) {
                return null;
            }
            const seen = new Set();
            const deduped = [];
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
        }))
            .filter((entry) => entry !== null);
        if (payload.length === 0) {
            setStatusMessage({
                kind: 'success',
                message: 'Nessuna modifica da pubblicare.',
            });
            return;
        }
        startPublishPlayers(async () => {
            try {
                await (0, actions_1.publishPlayerWinners)(winnersDate, payload, locale);
                setStatusMessage({
                    kind: 'success',
                    message: 'Vincitori Players pubblicati.',
                });
                await mutatePlayerWinners();
                setPlayerWinnerOverrides({});
            }
            catch (error) {
                setStatusMessage({
                    kind: 'error',
                    message: error?.message ??
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
    const handleBalanceAdjust = (userId, delta) => {
        startAdjust(() => (0, actions_1.adjustUserBalanceAction)({ userId, delta, locale }).catch((error) => {
            console.error('Failed to adjust balance', error);
        }));
    };
    const handleAssignCard = (userId) => {
        const cardId = selectedCard[userId];
        if (!cardId)
            return;
        startCardTransition(() => (0, actions_1.assignCardAction)({ userId, cardId, locale }).catch((error) => {
            console.error('Failed to assign card', error);
        }));
    };
    const handleRevokeCard = (userId, cardId) => {
        startCardTransition(() => (0, actions_1.revokeCardAction)({ userId, cardId, locale }).catch((error) => {
            console.error('Failed to revoke card', error);
        }));
    };
    const handleHighlightChange = (rank, selection) => {
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
            const player = entry.player ?? {
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
        startHighlight(() => (0, actions_1.saveHighlightsAction)({
            date: highlightDate,
            highlights: payload,
            locale,
        }).catch((error) => {
            console.error('Failed to save highlights', error);
        }));
    };
    const loadGamesSummary = (0, react_1.useCallback)(async () => {
        try {
            const response = await fetch(`/api/admin/games-summary?date=${encodeURIComponent(winnersDate)}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Impossibile recuperare il games summary');
            }
            return payload;
        }
        catch (error) {
            setStatusMessage({
                kind: 'error',
                message: error?.message ?? 'Errore durante il caricamento del games summary.',
            });
            return null;
        }
    }, [winnersDate]);
    const autofillTeamWinners = (0, react_1.useCallback)(async () => {
        const summary = await loadGamesSummary();
        if (!summary || !teamWinnersData) {
            return;
        }
        const overrides = {};
        teamWinnersData.games.forEach((game) => {
            const homeAbbr = game.homeTeam.abbr?.toUpperCase() ?? '';
            const awayAbbr = game.awayTeam.abbr?.toUpperCase() ?? '';
            const match = summary.games.find((entry) => entry.game.home_team.abbreviation?.toUpperCase() === homeAbbr &&
                entry.game.visitor_team.abbreviation?.toUpperCase() === awayAbbr);
            if (!match) {
                return;
            }
            const { game: summaryGame } = match;
            const homeScore = summaryGame.home_team_score ?? 0;
            const awayScore = summaryGame.visitor_team_score ?? 0;
            if (homeScore === awayScore) {
                return;
            }
            const winnerTeamId = homeScore > awayScore ? game.homeTeam.id : game.awayTeam.id;
            overrides[game.id] = winnerTeamId;
        });
        setTeamWinnerOverrides(overrides);
        setStatusMessage({
            kind: 'success',
            message: dictionary.admin.fillFromGamesSummary,
        });
    }, [loadGamesSummary, teamWinnersData, dictionary.admin.fillFromGamesSummary]);
    const stripDiacritics = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const normalizeName = (value) => stripDiacritics(value ?? '')
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .trim();
    const normalizeToken = (value) => stripDiacritics((value ?? '').toString())
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
    const normalizeProviderId = (value) => normalizeToken(value)
        .replace(/(g|f|c)$/i, '');
    const matchPerformerToOption = (performer, options) => {
        const performerId = normalizeToken(performer.player?.id);
        const performerPid = normalizeProviderId(performer.player?.id != null ? String(performer.player.id) : null);
        const first = normalizeName(performer.player?.first_name);
        const last = normalizeName(performer.player?.last_name);
        const fullName = normalizeName(`${performer.player?.first_name ?? ''} ${performer.player?.last_name ?? ''}`);
        const teamAbbr = performer.team?.abbreviation?.toUpperCase() ?? null;
        const teamToken = normalizeName(teamAbbr);
        const scored = options
            .map((option) => {
            const optionId = normalizeToken(option.value);
            const optionLabel = normalizeName(option.label);
            const optionProviderIdRaw = normalizeToken(option.meta?.providerPlayerId);
            const optionProviderId = normalizeProviderId(option.meta?.providerPlayerId);
            const optionTeamToken = normalizeName(option.meta?.teamAbbr);
            let score = 0;
            if (performerPid && optionProviderId && performerPid === optionProviderId) {
                score += 9;
            }
            if (performerId && optionProviderIdRaw && performerId === optionProviderIdRaw) {
                score += 8;
            }
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
            }
            else if (teamToken && optionLabel.includes(teamToken)) {
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
    const categoryKeyToSummary = (category) => {
        const normalized = category.toLowerCase();
        if (normalized.includes('assist')) {
            return 'assists';
        }
        if (normalized.includes('rebound')) {
            return 'rebounds';
        }
        return 'points';
    };
    const autofillPlayerWinners = (0, react_1.useCallback)(async () => {
        const summary = await loadGamesSummary();
        if (!summary || !playerWinnersData) {
            return;
        }
        const overrides = {};
        playerWinnersData.games.forEach((game) => {
            const homeAbbr = game.homeTeam.abbr?.toUpperCase() ?? '';
            const awayAbbr = game.awayTeam.abbr?.toUpperCase() ?? '';
            const match = summary.games.find((entry) => entry.game.home_team.abbreviation?.toUpperCase() === homeAbbr &&
                entry.game.visitor_team.abbreviation?.toUpperCase() === awayAbbr);
            if (!match) {
                return;
            }
            const perCategory = {};
            game.categories.forEach((category) => {
                const key = categoryKeyToSummary(category.category);
                const performers = match.topPerformers[key] ?? [];
                const selections = performers
                    .map((performer) => matchPerformerToOption(performer, category.options))
                    .filter((value) => Boolean(value));
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-4 md:py-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "sticky top-0 z-20 -mx-3 sm:-mx-4 md:mx-0 bg-navy-950/80 backdrop-blur supports-[backdrop-filter]:bg-navy-950/60", children: (0, jsx_runtime_1.jsx)("div", { className: "mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: `/${locale}/dashboard`, className: "inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold", children: dictionary.admin.backToDashboard }), (0, jsx_runtime_1.jsx)(link_1.default, { href: `/${locale}/admin/games-summary`, className: "inline-flex min-h-[40px] items-center justify-center rounded-full border border-accent-gold/50 bg-accent-gold/15 px-4 py-1.5 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold", children: dictionary.admin.gamesSummaryLink })] }), (0, jsx_runtime_1.jsx)("header", { className: "flex w-full flex-1 gap-2 overflow-x-auto pb-1 text-sm text-white touch-scroll", children: ADMIN_TABS.map((tab) => {
                                    const label = tab === 'users'
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
                                    return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setActiveTab(tab), className: (0, clsx_1.default)('flex-none whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition min-h-[44px]', activeTab === tab
                                            ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                                            : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/40'), "aria-pressed": activeTab === tab, children: label }, tab));
                                }) })] }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 pt-4 md:pt-6", children: [activeTab === 'users' ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-semibold text-white", children: dictionary.admin.usersTab }), (0, jsx_runtime_1.jsx)("div", { className: "w-full md:w-auto", children: (0, jsx_runtime_1.jsx)("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: dictionary.admin.searchPlaceholder, className: "h-10 w-full max-w-md rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white placeholder:text-slate-400 focus:border-accent-gold focus:outline-none" }) })] }), (0, jsx_runtime_1.jsx)(ResponsiveTable, { headers: (0, jsx_runtime_1.jsx)("thead", { className: "bg-navy-900/80 text-xs uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: dictionary.admin.usersTab }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Email" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: dictionary.admin.balance }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: dictionary.admin.cards }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3" })] }) }), children: (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-white/5 text-sm text-slate-200", children: filteredUsers.map((user) => {
                                        const userCards = user.user_cards ?? [];
                                        return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: user.full_name ?? '—' }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: user.role })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "whitespace-nowrap px-4 py-3 align-top", children: user.email }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-base font-semibold text-white", children: user.anima_points_balance }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleBalanceAdjust(user.id, admin_1.ADMIN_POINT_STEP), className: "inline-flex h-10 items-center justify-center rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold", "aria-label": `Aggiungi ${admin_1.ADMIN_POINT_STEP} punti`, children: `+${admin_1.ADMIN_POINT_STEP}` }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleBalanceAdjust(user.id, -admin_1.ADMIN_POINT_STEP), className: "inline-flex h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-slate-200 transition hover:border-accent-gold/40", "aria-label": `Rimuovi ${admin_1.ADMIN_POINT_STEP} punti`, children: `-${admin_1.ADMIN_POINT_STEP}` })] })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [userCards.map((entry, index) => entry.card ? ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/70 px-3 py-1 text-xs text-slate-200", children: [entry.card.name, " \u00B7 ", entry.card.rarity, (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleRevokeCard(user.id, entry.card.id), className: "text-slate-400 transition hover:text-rose-300", "aria-label": `Rimuovi ${entry.card.name}`, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }, entry.id ?? `${entry.card.id}-${index}`)) : null), userCards.length === 0 ? ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: "Nessuna card" })) : null] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("select", { value: selectedCard[user.id] ?? '', onChange: (event) => setSelectedCard((previous) => ({
                                                                    ...previous,
                                                                    [user.id]: event.target.value,
                                                                })), className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: dictionary.shop.title }), shopCards.map((card) => ((0, jsx_runtime_1.jsxs)("option", { value: card.id, children: [card.name, " \u00B7 ", card.rarity] }, card.id)))] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleAssignCard(user.id), className: "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "h-4 w-4" }), dictionary.shop.buy] })] }) })] }, user.id));
                                    }) }) }), (0, jsx_runtime_1.jsx)(MobileList, { children: filteredUsers.map((user) => {
                                    const userCards = user.user_cards ?? [];
                                    return ((0, jsx_runtime_1.jsxs)("li", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsx)("div", { className: "truncate text-sm font-semibold text-white", children: user.full_name ?? '—' }), (0, jsx_runtime_1.jsx)("div", { className: "truncate text-xs text-slate-400", children: user.email }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-500", children: user.role })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-end gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Balance" }), (0, jsx_runtime_1.jsx)("span", { className: "text-base font-semibold text-white", children: user.anima_points_balance })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleBalanceAdjust(user.id, admin_1.ADMIN_POINT_STEP), className: "inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold", "aria-label": `Aggiungi ${admin_1.ADMIN_POINT_STEP} punti`, children: `+${admin_1.ADMIN_POINT_STEP}` }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleBalanceAdjust(user.id, -admin_1.ADMIN_POINT_STEP), className: "inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-slate-200 transition hover:border-accent-gold/40", "aria-label": `Rimuovi ${admin_1.ADMIN_POINT_STEP} punti`, children: `-${admin_1.ADMIN_POINT_STEP}` })] }), (0, jsx_runtime_1.jsxs)("select", { value: selectedCard[user.id] ?? '', onChange: (event) => setSelectedCard((previous) => ({
                                                            ...previous,
                                                            [user.id]: event.target.value,
                                                        })), className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: dictionary.shop.title }), shopCards.map((card) => ((0, jsx_runtime_1.jsxs)("option", { value: card.id, children: [card.name, " \u00B7 ", card.rarity] }, card.id)))] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleAssignCard(user.id), className: "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "h-4 w-4" }), dictionary.shop.buy] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400", children: dictionary.admin.cards }), userCards.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-1 flex flex-wrap gap-2", children: userCards.map((entry, index) => entry.card ? ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-900/60 px-3 py-1 text-xs text-slate-200", children: [entry.card.name, " \u00B7 ", entry.card.rarity, (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleRevokeCard(user.id, entry.card.id), className: "text-slate-400 transition hover:text-rose-300", "aria-label": `Rimuovi ${entry.card.name}`, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }, entry.id ?? `${entry.card.id}-${index}`)) : null) })) : ((0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-400", children: "Nessuna card assegnata." }))] })] }, user.id));
                                }) }), adjustPending || cardPending ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-xs text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: "Syncing changes\u2026" })] })) : null] })) : null, activeTab === 'picks' ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 md:gap-3", children: [(0, jsx_runtime_1.jsx)("select", { value: selectedUser, onChange: (event) => setSelectedUser(event.target.value), className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none", children: users.map((user) => ((0, jsx_runtime_1.jsx)("option", { value: user.id, children: user.full_name ?? user.email }, user.id))) }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: picksDate, onChange: (event) => setPicksDate(event.target.value), className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none" })] }) }), picksLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : picksPreview ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "hidden gap-4 md:grid md:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(PicksTeamsTable_1.PicksTeamsTable, { className: "h-full", title: dictionary.play.teams.title, rows: teamTableRows, emptyMessage: "No team picks.", showDateColumn: false, showChangesColumn: false, showTimestampsColumn: false }), (0, jsx_runtime_1.jsx)(PicksPlayersTable_1.PicksPlayersTable, { className: "h-full", title: dictionary.play.players.title, rows: playerTableRows, emptyMessage: "No player picks.", formatCategory: formatCategoryLabel, showDateColumn: false, showChangesColumn: false, showTimestampsColumn: false, showOutcomeColumn: true })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 md:hidden", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-base font-semibold text-white", children: dictionary.play.teams.title }), (0, jsx_runtime_1.jsx)(MobileList, { children: teamTableRows.map((row, index) => {
                                                            const homeAbbr = (row.game?.home_team_abbr ?? 'HOME').toUpperCase();
                                                            const awayAbbr = (row.game?.away_team_abbr ?? 'AWY').toUpperCase();
                                                            const homeName = row.game?.home_team_name ?? 'Home Team';
                                                            const awayName = row.game?.away_team_name ?? 'Away Team';
                                                            const selectionLabel = row.selected_team_name ??
                                                                row.selected_team_abbr ??
                                                                row.selected_team_id ??
                                                                '—';
                                                            const outcome = resolveOutcomeDisplay(row.result);
                                                            return ((0, jsx_runtime_1.jsxs)("li", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2 text-sm font-semibold text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: awayAbbr }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: homeAbbr })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-slate-400", children: [awayName, " @ ", homeName] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-1 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Scelta:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: selectionLabel })] }), (0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Esito:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('font-semibold', outcome.className), children: outcome.label })] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-xs text-slate-400", children: [(0, cells_1.formatDateNy)(row.pick_date), " \u00B7 Changes: ", row.changes_count ?? 0, " \u00B7 Updated:", ' ', (0, cells_1.formatDateTimeNy)(row.updated_at)] })] }, `team-mobile-${row.game_id ?? 'unknown'}-${row.selected_team_id ?? index}-${index}`));
                                                        }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-base font-semibold text-white", children: dictionary.play.players.title }), (0, jsx_runtime_1.jsx)(MobileList, { children: playerTableRows.map((row, index) => {
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
                                                            return ((0, jsx_runtime_1.jsxs)("li", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2 text-sm font-semibold text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: awayAbbr }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: homeAbbr })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-slate-400", children: [awayName, " @ ", homeName] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-1 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Scelta:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: displayName }), (0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-xs text-slate-400", children: categoryLabel })] }), (0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Esito:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('font-semibold', outcome.className), children: outcome.label })] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-xs text-slate-400", children: [(0, cells_1.formatDateNy)(row.pick_date), " \u00B7 Changes: ", row.changes_count ?? 0, " \u00B7 Updated:", ' ', (0, cells_1.formatDateTimeNy)(row.updated_at)] })] }, `player-mobile-${row.game_id ?? 'unknown'}-${row.category}-${index}`));
                                                        }) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4", children: (0, jsx_runtime_1.jsxs)("section", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "mb-2 text-sm font-semibold text-white", children: dictionary.common.highlights }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1 text-sm text-slate-200", children: [(picksPreview.highlights ?? []).map((highlight, index) => {
                                                            const record = highlight;
                                                            const name = fullName(record.player);
                                                            return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-navy-800/70 px-3 py-2", children: [(0, jsx_runtime_1.jsxs)("span", { className: "mr-2 text-xs uppercase opacity-70", children: ["RANK #", highlight.rank] }), (0, jsx_runtime_1.jsx)("strong", { children: name }), record.player?.position ? ((0, jsx_runtime_1.jsxs)("span", { className: "text-xs opacity-60", children: [' ', "\u00B7 ", record.player.position] })) : null] }, `${highlight.rank}-${index}`));
                                                        }), (picksPreview.highlights?.length ?? 0) === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl bg-navy-800/70 px-3 py-2 text-xs text-slate-400", children: "No highlight picks." })) : null] })] }) })] })) : ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Nessun pick registrato." }))] })) : null, activeTab === 'winnersTeams' ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 md:gap-3", children: [(0, jsx_runtime_1.jsx)("input", { type: "date", value: winnersDate, onChange: (event) => handleWinnersDateChange(event.target.value), className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: autofillTeamWinners, className: "inline-flex items-center justify-center rounded-lg border border-accent-gold/50 bg-accent-gold/10 px-3 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/20", children: dictionary.admin.fillFromGamesSummary })] }), statusMessage ? ((0, jsx_runtime_1.jsx)("div", { className: (0, clsx_1.default)('rounded-full px-4 py-2 text-xs font-semibold', statusMessage.kind === 'success'
                                            ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                                            : 'border border-rose-400/40 bg-rose-400/10 text-rose-200'), children: statusMessage.message })) : null] }), teamWinnersLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : teamWinnersError ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-rose-400", children: teamWinnersError?.message ?? 'Errore nel caricamento.' })) : teamWinnersData ? (teamWinnersData.games.length > 0 ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(ResponsiveTable, { headers: (0, jsx_runtime_1.jsx)("thead", { className: "bg-navy-900/80 text-[11px] uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Matchup" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Vincitore" }), (0, jsx_runtime_1.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-left", children: "Pubblicazione" })] }) }), children: (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-white/10 text-[13px] text-slate-200", children: teamWinnersData.games.map((game) => {
                                                const baseSelection = baseTeamSelections[game.id] ?? '';
                                                const selection = teamWinnerOverrides[game.id] ?? baseSelection;
                                                return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col", children: [(0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-white", children: [(game.awayTeam.abbr ?? 'AWY').toUpperCase(), " @", ' ', (game.homeTeam.abbr ?? 'HOME').toUpperCase()] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-400", children: [(game.awayTeam.name ?? 'Away Team'), ' ', "vs ", (game.homeTeam.name ?? 'Home Team')] })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top text-xs uppercase tracking-wide text-slate-400", children: game.status }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: (0, jsx_runtime_1.jsxs)("select", { value: selection, onChange: (event) => handleTeamWinnerChange(game.id, event.target.value), className: "w-full h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u2014" }), (0, jsx_runtime_1.jsxs)("option", { value: game.homeTeam.id, children: [(game.homeTeam.abbr ?? 'HOME').toUpperCase(), " \u00B7", ' ', game.homeTeam.name ?? 'Home'] }), (0, jsx_runtime_1.jsxs)("option", { value: game.awayTeam.id, children: [(game.awayTeam.abbr ?? 'AWY').toUpperCase(), " \u00B7", ' ', game.awayTeam.name ?? 'Away'] })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 align-top", children: game.winnerTeamId ? ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200", children: "Pubblicato" })) : ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-400", children: "In attesa" })) })] }, game.id));
                                            }) }) }), (0, jsx_runtime_1.jsx)(MobileList, { children: teamWinnersData.games.map((game) => {
                                            const baseSelection = baseTeamSelections[game.id] ?? '';
                                            const selection = teamWinnerOverrides[game.id] ?? baseSelection;
                                            const homeAbbr = (game.homeTeam.abbr ?? 'HOME').toUpperCase();
                                            const awayAbbr = (game.awayTeam.abbr ?? 'AWY').toUpperCase();
                                            const homeName = game.homeTeam.name ?? 'Home Team';
                                            const awayName = game.awayTeam.name ?? 'Away Team';
                                            const published = Boolean(game.winnerTeamId);
                                            return ((0, jsx_runtime_1.jsxs)("li", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: awayAbbr }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase text-slate-500", children: "vs" }), (0, jsx_runtime_1.jsx)("span", { className: "inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-navy-900/60 px-2 py-1 text-xs uppercase", children: homeAbbr })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-slate-400", children: [awayName, " @ ", homeName] })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: game.status })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("select", { value: selection, onChange: (event) => handleTeamWinnerChange(game.id, event.target.value), className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u2014" }), (0, jsx_runtime_1.jsxs)("option", { value: game.homeTeam.id, children: [homeAbbr, " \u00B7 ", homeName] }), (0, jsx_runtime_1.jsxs)("option", { value: game.awayTeam.id, children: [awayAbbr, " \u00B7 ", awayName] })] }), (0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('text-xs font-semibold', published ? 'text-emerald-300' : 'text-slate-400'), children: published ? 'Pubblicato' : 'In attesa' })] })] }, `mobile-${game.id}`));
                                        }) })] })) : ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Nessuna partita trovata per la data selezionata." }))) : ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Nessun dato disponibile." })), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end", children: (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handlePublishTeamWinners, disabled: publishTeamsPending ||
                                        teamWinnersLoading ||
                                        Boolean(teamWinnersError) ||
                                        !teamWinnersData, className: (0, clsx_1.default)('inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition md:w-auto', publishTeamsPending
                                        ? 'border-white/10 bg-navy-800/70 text-slate-400'
                                        : 'border-accent-gold/40 text-accent-gold hover:border-accent-gold'), children: [publishTeamsPending ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : null, "Pubblica vincitori"] }) })] })) : null, activeTab === 'winnersPlayers' ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 md:gap-3", children: [(0, jsx_runtime_1.jsx)("input", { type: "date", value: winnersDate, onChange: (event) => handleWinnersDateChange(event.target.value), className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: autofillPlayerWinners, className: "inline-flex items-center justify-center rounded-lg border border-accent-gold/50 bg-accent-gold/10 px-3 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/20", children: dictionary.admin.fillFromGamesSummary })] }), statusMessage ? ((0, jsx_runtime_1.jsx)("div", { className: (0, clsx_1.default)('rounded-full px-4 py-2 text-xs font-semibold', statusMessage.kind === 'success'
                                            ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                                            : 'border border-rose-400/40 bg-rose-400/10 text-rose-200'), children: statusMessage.message })) : null] }), playerWinnersLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.loading })] })) : playerWinnersError ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-rose-400", children: playerWinnersError?.message ??
                                    'Errore nel caricamento.' })) : playerWinnersData ? (playerWinnersData.games.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: playerWinnersData.games.map((game) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-2xl border border-white/10 bg-navy-900/60 p-4", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-sm font-semibold text-white", children: [(game.awayTeam.abbr ?? 'AWY').toUpperCase(), " @", ' ', (game.homeTeam.abbr ?? 'HOME').toUpperCase()] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: [(game.awayTeam.name ?? 'Away Team'), " vs", ' ', (game.homeTeam.name ?? 'Home Team')] })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: game.status })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: game.categories.map((category) => {
                                                const baseIds = basePlayerSelections[game.id]?.[category.category] ?? [];
                                                const overrideSelections = playerWinnerOverrides[game.id]?.[category.category] ?? null;
                                                const baseSelections = baseIds.map((playerId) => buildSelectionFromBase(game.id, category.category, playerId));
                                                const selections = overrideSelections ?? baseSelections;
                                                const displaySelections = selections.length > 0 ? selections : [null];
                                                const published = baseIds.length > 0;
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 rounded-xl border border-white/10 bg-navy-800/60 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-semibold text-white", children: formatCategoryLabel(category.category) }), published ? ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex w-fit items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200", children: "Pubblicato" })) : ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex w-fit items-center rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400", children: "In attesa" }))] }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: category.settledAt ? 'Settled' : 'Draft' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex w-full flex-col gap-2", children: [displaySelections.map((selection, index) => {
                                                                    const value = selection
                                                                        ? selection.supabaseId ?? selection.id
                                                                        : '';
                                                                    const canRemove = displaySelections.length > 1 ||
                                                                        baseIds.length > 0 ||
                                                                        Boolean(overrideSelections);
                                                                    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex-1", children: (0, jsx_runtime_1.jsx)(PlayerSelect_1.PlayerSelect, { value: value || undefined, onChange: (nextSelection) => handlePlayerWinnerChange(game.id, category.category, index, nextSelection), placeholder: "Seleziona giocatore" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleRemovePlayerWinner(game.id, category.category, index), disabled: !canRemove, className: (0, clsx_1.default)('flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-semibold transition', canRemove
                                                                                    ? 'border-white/20 text-slate-100 hover:border-rose-400 hover:text-rose-200'
                                                                                    : 'cursor-not-allowed border-white/10 text-slate-600'), "aria-label": "Rimuovi vincitore", children: "\u2013" })] }, `${game.id}-${category.category}-${index}`));
                                                                }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleAddPlayerWinner(game.id, category.category), className: "inline-flex items-center gap-1 rounded-lg border border-accent-gold/40 px-3 py-1 text-xs font-semibold text-accent-gold transition hover:border-accent-gold", children: ["+", (0, jsx_runtime_1.jsx)("span", { children: "Aggiungi vincitore" })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleResetPlayerWinnerCategory(game.id, category.category), className: "text-xs font-semibold text-slate-400 transition hover:text-slate-200", children: "Reset" })] })] })] }, `${game.id}-${category.category}`));
                                            }) })] }, game.id))) })) : ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Nessuna categoria disponibile per la data selezionata." }))) : ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Nessun dato disponibile." })), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end", children: (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handlePublishPlayerWinners, disabled: publishPlayersPending ||
                                        playerWinnersLoading ||
                                        Boolean(playerWinnersError) ||
                                        !playerWinnersData, className: (0, clsx_1.default)('inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition md:w-auto', publishPlayersPending
                                        ? 'border-white/10 bg-navy-800/70 text-slate-400'
                                        : 'border-accent-gold/40 text-accent-gold hover:border-accent-gold'), children: [publishPlayersPending ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : null, "Pubblica vincitori"] }) })] })) : null, activeTab === 'highlights' ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3", children: (0, jsx_runtime_1.jsx)("input", { type: "date", value: highlightDate, onChange: (event) => setHighlightDate(event.target.value), className: "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white focus:border-accent-gold focus:outline-none" }) }), (0, jsx_runtime_1.jsx)("div", { className: "grid gap-3 md:grid-cols-2", children: Array.from({ length: 10 }).map((_, index) => {
                                    const rank = index + 1;
                                    const entry = highlightForm.find((item) => item.rank === rank);
                                    const selected = entry?.player?.supabaseId ??
                                        entry?.player?.id ??
                                        entry?.playerId ??
                                        '';
                                    return ((0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col gap-2 rounded-2xl border border-white/10 bg-navy-900/60 p-4 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400", children: ["Rank #", rank] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsx)(PlayerSelect_1.PlayerSelect, { value: selected || undefined, onChange: (selection) => handleHighlightChange(rank, selection), placeholder: "Seleziona giocatore" }), selected ? ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleHighlightChange(rank, null), className: "self-start text-[11px] text-slate-400 hover:text-slate-200", children: "Reset" })) : null] })] }, rank));
                                }) }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleHighlightsSave, className: "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent-gold/60 bg-accent-gold/10 px-4 text-sm font-semibold text-accent-gold transition hover:border-accent-gold md:w-auto", disabled: highlightPending, children: [highlightPending ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : null, dictionary.admin.applyHighlights] })] })) : null, activeTab === 'storage' ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3", children: (0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-semibold text-white", children: "Storage Supabase" }) }), (0, jsx_runtime_1.jsx)(AdminStorageDashboard_1.AdminStorageDashboard, {})] })) : null, activeTab === 'rosters' ? ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3", children: (0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-semibold text-white", children: "Rosters" }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-3", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: `/${locale}/admin/rosters`, className: "inline-flex items-center justify-center rounded-full border border-accent-gold/50 bg-accent-gold/15 px-4 py-2 text-sm font-semibold text-accent-gold transition hover:border-accent-gold hover:bg-accent-gold/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold", children: "Vai a /admin/rosters" }) })] })) : null] })] }));
};
exports.AdminClient = AdminClient;
