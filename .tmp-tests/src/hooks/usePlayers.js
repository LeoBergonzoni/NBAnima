"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePlayers = void 0;
const react_1 = require("react");
const swr_1 = __importDefault(require("swr"));
const fetchRosters = async () => {
    const response = await fetch('/rosters.json', { cache: 'force-cache', credentials: 'omit' });
    if (!response.ok) {
        throw new Error('Failed to load rosters.json');
    }
    return response.json();
};
const slugify = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const toLookupKeys = ({ teamId, teamName, triCode }) => {
    const keys = new Set();
    if (teamId !== undefined && teamId !== null && `${teamId}`.trim() !== '') {
        keys.add(`${teamId}`.trim());
    }
    if (triCode) {
        const trimmed = triCode.trim();
        if (trimmed) {
            keys.add(trimmed.toUpperCase());
        }
    }
    if (teamName) {
        const trimmed = teamName.trim();
        if (trimmed) {
            keys.add(slugify(trimmed));
            keys.add(trimmed.toUpperCase());
        }
    }
    return Array.from(keys);
};
const mapPlayer = (player) => ({
    id: player.id,
    fullName: player.full_name,
    firstName: player.first_name,
    lastName: player.last_name,
    position: player.position || null,
    teamId: player.team_id,
});
const usePlayers = ({ teamId, teamName, triCode }) => {
    const { data, error, isLoading } = (0, swr_1.default)('local-rosters', fetchRosters, {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });
    const keys = (0, react_1.useMemo)(() => toLookupKeys({ teamId, teamName, triCode }), [teamId, teamName, triCode]);
    const players = (0, react_1.useMemo)(() => {
        if (!data) {
            return [];
        }
        let roster;
        let rosterKey;
        for (const key of keys) {
            const candidate = data[key];
            if (candidate && candidate.length) {
                roster = candidate;
                rosterKey = key;
                break;
            }
        }
        if (!roster || !rosterKey) {
            return [];
        }
        const mapped = roster.map((player) => {
            const fullName = player.name ? player.name.replace(/\s+/g, ' ').trim() : `Player ${player.id}`;
            const parts = fullName.split(' ');
            const firstName = parts[0] ?? fullName;
            const lastName = parts.slice(1).join(' ');
            return {
                id: player.id,
                full_name: fullName,
                first_name: firstName,
                last_name: lastName,
                position: player.pos ?? '',
                team_id: rosterKey,
                jersey: player.jersey,
            };
        });
        return mapped.map(mapPlayer);
    }, [data, keys]);
    return { players, isLoading, error };
};
exports.usePlayers = usePlayers;
