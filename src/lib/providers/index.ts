import { API_PROVIDER } from '../constants';
import { getServerEnv } from '../env';
import type { GameProvider, ProviderGame, ProviderPlayer } from './types';
import {
  balldontlieProvider,
  listTeamPlayers as balldontlieListTeamPlayers,
  mapBalldontliePlayer,
} from './providers/balldontlie';
import { sportsDataIoProvider } from './providers/sportsdataio';

export const getGameProvider = (): GameProvider => {
  const { NB_API_PROVIDER } = getServerEnv();

  if (NB_API_PROVIDER === API_PROVIDER.SPORTSDATAIO) {
    return sportsDataIoProvider;
  }

  return balldontlieProvider;
};

export const listNextNightGames = async (): Promise<ProviderGame[]> => {
  const { NB_API_PROVIDER } = getServerEnv();
  if (NB_API_PROVIDER === API_PROVIDER.SPORTSDATAIO) {
    return sportsDataIoProvider.listNextNightGames();
  }
  return balldontlieProvider.listNextNightGames();
};

export const listTeamPlayers = async (
  teamId: number,
  season: number,
): Promise<ProviderPlayer[]> => {
  const { NB_API_PROVIDER } = getServerEnv();
  if (NB_API_PROVIDER === API_PROVIDER.SPORTSDATAIO) {
    throw new Error('Team roster lookup is not supported for SportsdataIO');
  }

  const roster = await balldontlieListTeamPlayers(teamId, season);
  return roster.map(mapBalldontliePlayer);
};
