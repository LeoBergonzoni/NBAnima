import { API_PROVIDER } from '../constants';
import { getServerEnv } from '../env';
import type { GameProvider } from './types';
import { balldontlieProvider } from './providers/balldontlie';
import { sportsDataIoProvider } from './providers/sportsdataio';

export const getGameProvider = (): GameProvider => {
  const { NB_API_PROVIDER } = getServerEnv();

  if (NB_API_PROVIDER === API_PROVIDER.SPORTSDATAIO) {
    return sportsDataIoProvider;
  }

  return balldontlieProvider;
};
