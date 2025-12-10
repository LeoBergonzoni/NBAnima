"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamMetadata = void 0;
const nbaTeamMaps_1 = require("./nbaTeamMaps");
const logos_1 = require("./logos");
const getTeamMetadata = (rawTeamId) => {
    if (!rawTeamId) {
        return null;
    }
    const numericId = Number.parseInt(String(rawTeamId), 10);
    if (!Number.isFinite(numericId)) {
        return {
            id: String(rawTeamId),
            name: String(rawTeamId),
            abbreviation: null,
            logo: null,
        };
    }
    const name = nbaTeamMaps_1.ID_TO_NAME[numericId] ?? String(rawTeamId);
    const abbreviation = nbaTeamMaps_1.ID_TO_TRI[numericId] ?? null;
    const logo = abbreviation ? logos_1.TEAM_LOGOS[abbreviation] ?? null : null;
    return {
        id: String(rawTeamId),
        name,
        abbreviation,
        logo,
    };
};
exports.getTeamMetadata = getTeamMetadata;
