"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTeamRecords = void 0;
const react_1 = require("react");
/**
 * Placeholder hook for attaching team W–L records near team names.
 * Replace the mocked data below with:
 * - a direct call to `/v1/standings` when upgrading to GOAT, or
 * - a custom calculation built from `/v1/games` history.
 */
const useTeamRecords = (teamIds) => {
    const records = (0, react_1.useMemo)(() => {
        const map = {};
        teamIds.forEach((id) => {
            map[String(id)] = null; // TODO: fill with real record data once available.
        });
        return map;
    }, [teamIds]);
    return {
        records,
        isLoading: false,
    };
};
exports.useTeamRecords = useTeamRecords;
