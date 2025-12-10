"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePicks = void 0;
const swr_1 = __importDefault(require("swr"));
const constants_1 = require("../lib/constants");
const useGames_1 = require("./useGames");
const fetcher = async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to load picks');
    }
    return response.json();
};
const mutatePicks = async (payload, method) => {
    const response = await fetch('/api/picks', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save picks');
    }
    return response.json();
};
const usePicks = (pickDate) => {
    const { data, error, isLoading, mutate } = (0, swr_1.default)(`/api/picks?date=${pickDate}`, fetcher, { revalidateOnFocus: false });
    const { mapByProviderId } = (0, useGames_1.useGames)();
    const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    const FORMATTER_NY = new Intl.DateTimeFormat('en-CA', {
        timeZone: constants_1.TIMEZONES.US_EASTERN,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const toDateNy = (iso, fallback) => {
        if (!iso) {
            return fallback;
        }
        const parsed = new Date(iso);
        if (Number.isNaN(parsed.getTime())) {
            return fallback;
        }
        return FORMATTER_NY.format(parsed);
    };
    const cloneGameRef = (ref) => ({
        provider: ref.provider,
        providerGameId: ref.providerGameId,
        dto: ref.dto
            ? {
                provider: ref.dto.provider,
                providerGameId: ref.dto.providerGameId,
                season: ref.dto.season,
                status: ref.dto.status,
                dateNY: ref.dto.dateNY,
                startTimeUTC: ref.dto.startTimeUTC ?? null,
                home: { ...ref.dto.home },
                away: { ...ref.dto.away },
            }
            : undefined,
    });
    const buildDtoFromMeta = (meta, fallbackDate) => ({
        provider: 'bdl',
        providerGameId: meta.providerGameId,
        season: meta.season,
        status: meta.status ?? 'scheduled',
        dateNY: toDateNy(meta.gameDateISO ?? null, fallbackDate),
        startTimeUTC: meta.gameDateISO ?? null,
        home: {
            abbr: meta.home?.abbr,
            name: meta.home?.name,
            providerTeamId: meta.home?.providerTeamId,
        },
        away: {
            abbr: meta.away?.abbr,
            name: meta.away?.name,
            providerTeamId: meta.away?.providerTeamId,
        },
    });
    const optimisticBase = () => ({
        pickDate,
        teams: data?.teams ?? [],
        players: data?.players ?? [],
        highlights: data?.highlights ?? [],
        changesCount: data?.changesCount ?? 0,
    });
    const save = async (payload, method) => {
        const sanitizedPayload = {
            ...payload,
            teams: payload.teams.map((pick) => ({ ...pick })),
            players: payload.players.map((pick) => ({ ...pick })),
            highlights: payload.highlights.map((pick) => ({ ...pick })),
            gameRefs: payload.gameRefs ? payload.gameRefs.map(cloneGameRef) : undefined,
        };
        const resolvedUuidSet = new Set();
        const requestedIds = new Set();
        const existingRefs = sanitizedPayload.gameRefs ?? [];
        const seenRefs = new Set(existingRefs.map((ref) => ref.providerGameId));
        const gameRefs = [...existingRefs];
        sanitizedPayload.gameUuids.forEach((rawId) => {
            if (!rawId) {
                return;
            }
            const mappedUuid = mapByProviderId[rawId];
            if (mappedUuid && isUuid(mappedUuid)) {
                resolvedUuidSet.add(mappedUuid);
                requestedIds.add(mappedUuid);
                return;
            }
            if (isUuid(rawId)) {
                resolvedUuidSet.add(rawId);
                requestedIds.add(rawId);
                return;
            }
            requestedIds.add(rawId);
            if (seenRefs.has(rawId)) {
                return;
            }
            const meta = sanitizedPayload.gamesMeta?.find((entry) => entry.providerGameId === rawId) ?? null;
            if (meta) {
                gameRefs.push({
                    provider: 'bdl',
                    providerGameId: rawId,
                    dto: buildDtoFromMeta(meta, sanitizedPayload.pickDate),
                });
            }
            else {
                gameRefs.push({
                    provider: 'bdl',
                    providerGameId: rawId,
                });
            }
            seenRefs.add(rawId);
        });
        sanitizedPayload.gameUuids = Array.from(new Set([...requestedIds, ...resolvedUuidSet]));
        sanitizedPayload.gameRefs = gameRefs.length > 0 ? gameRefs : undefined;
        return mutate(() => mutatePicks(sanitizedPayload, method), {
            optimisticData: {
                ...optimisticBase(),
                teams: sanitizedPayload.teams.map((pick) => ({
                    game_id: pick.gameId,
                    selected_team_id: pick.teamId,
                    changes_count: method === 'PUT' ? (data?.changesCount ?? 0) + 1 : 0,
                })),
                players: sanitizedPayload.players.map((pick) => ({
                    game_id: pick.gameId,
                    category: pick.category,
                    player_id: pick.playerId,
                    changes_count: method === 'PUT' ? (data?.changesCount ?? 0) + 1 : 0,
                })),
                highlights: sanitizedPayload.highlights.map((pick, index) => ({
                    player_id: pick.playerId,
                    rank: index + 1,
                    changes_count: method === 'PUT' ? (data?.changesCount ?? 0) + 1 : 0,
                })),
                changesCount: method === 'PUT'
                    ? (data?.changesCount ?? 0) + 1
                    : 0,
            },
            rollbackOnError: true,
            revalidate: true,
        });
    };
    return {
        data,
        isLoading,
        error,
        saveInitialPicks: (payload) => save(payload, 'POST'),
        updatePicks: (payload) => save(payload, 'PUT'),
        refresh: mutate,
    };
};
exports.usePicks = usePicks;
