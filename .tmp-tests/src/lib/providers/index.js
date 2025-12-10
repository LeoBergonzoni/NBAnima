"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTeamPlayers = exports.listNextNightGames = exports.getGameProvider = void 0;
const constants_1 = require("../constants");
const env_1 = require("../env");
const balldontlie_1 = require("./providers/balldontlie");
const sportsdataio_1 = require("./providers/sportsdataio");
const getGameProvider = () => {
    const { NB_API_PROVIDER } = (0, env_1.getServerEnv)();
    if (NB_API_PROVIDER === constants_1.API_PROVIDER.SPORTSDATAIO) {
        return sportsdataio_1.sportsDataIoProvider;
    }
    return balldontlie_1.balldontlieProvider;
};
exports.getGameProvider = getGameProvider;
const listNextNightGames = async () => {
    const { NB_API_PROVIDER } = (0, env_1.getServerEnv)();
    if (NB_API_PROVIDER === constants_1.API_PROVIDER.SPORTSDATAIO) {
        return sportsdataio_1.sportsDataIoProvider.listNextNightGames();
    }
    return balldontlie_1.balldontlieProvider.listNextNightGames();
};
exports.listNextNightGames = listNextNightGames;
const listTeamPlayers = async (teamId, season) => {
    const { NB_API_PROVIDER } = (0, env_1.getServerEnv)();
    if (NB_API_PROVIDER === constants_1.API_PROVIDER.SPORTSDATAIO) {
        throw new Error('Team roster lookup is not supported for SportsdataIO');
    }
    const roster = await (0, balldontlie_1.listTeamPlayers)(teamId, season);
    return roster.map(balldontlie_1.mapBalldontliePlayer);
};
exports.listTeamPlayers = listTeamPlayers;
