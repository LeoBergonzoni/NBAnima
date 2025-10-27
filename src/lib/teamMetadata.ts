import { ID_TO_NAME, ID_TO_TRI } from './nbaTeamMaps';
import { TEAM_LOGOS } from './logos';

export interface TeamMetadata {
  id: string;
  name: string;
  abbreviation: string | null;
  logo: string | null;
}

export const getTeamMetadata = (rawTeamId?: string | null): TeamMetadata | null => {
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

  const name = ID_TO_NAME[numericId] ?? String(rawTeamId);
  const abbreviation = ID_TO_TRI[numericId] ?? null;
  const logo = abbreviation ? TEAM_LOGOS[abbreviation] ?? null : null;

  return {
    id: String(rawTeamId),
    name,
    abbreviation,
    logo,
  };
};
