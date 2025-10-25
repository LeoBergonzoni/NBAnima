import * as XLSX from 'xlsx';

import { ID_TO_NAME, TRI_TO_NAME } from './nbaTeamMaps';

export type Player = {
  team: string;
  name: string;
  position: string;
  age?: number;
  height?: string;
  weight?: string;
};

type RosterMap = Map<string, Player[]>;

let rosterCache: RosterMap | null = null;
const LS_KEY = 'nba_rosters_v1';

const normalizeTeamKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const MATCH_ALIASES: Record<string, string> = {
  'la clippers': 'los angeles clippers',
  'los angeles clippers': 'los angeles clippers',
  'la lakers': 'los angeles lakers',
  'los angeles lakers': 'los angeles lakers',
  'ny knicks': 'new york knicks',
  'new york knicks': 'new york knicks',
  'gs warriors': 'golden state warriors',
  'golden state': 'golden state warriors',
  'phoenix': 'phoenix suns',
};

const getBasePath = () => {
  const importMeta = import.meta as { env?: Record<string, string> };
  const fromImport = importMeta?.env?.BASE_URL ?? '';
  const fromEnv = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const base = fromImport || fromEnv || '/';
  return base.endsWith('/') ? base : `${base}/`;
};

const reviveFromLocalStorage = (): RosterMap | null => {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, Player[]>;
    return new Map(Object.entries(parsed));
  } catch {
    return null;
  }
};

const persistToLocalStorage = (map: RosterMap) => {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    const payload: Record<string, Player[]> = {};
    for (const [key, value] of map.entries()) {
      payload[key] = value;
    }
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // ignore persistence failures
  }
};

export async function loadRostersFromExcel(): Promise<RosterMap> {
  if (rosterCache) {
    return rosterCache;
  }
  if (typeof window === 'undefined') {
    throw new Error('client-only');
  }

  const revived = reviveFromLocalStorage();
  if (revived) {
    rosterCache = revived;
    return revived;
  }

  const base = getBasePath();
  const url = `${base}nba_rosters_full.xlsx`.replace(/\/\/+/g, '/');

  const buffer = await fetch(url, { cache: 'no-cache' }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.arrayBuffer();
  });

  const workbook = XLSX.read(buffer, { type: 'array' });
  const map: RosterMap = new Map();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
    });
    const teamKey = normalizeTeamKey(sheetName);

    const players: Player[] = rows
      .map((row) => {
        const name = String(row.Name ?? row.NAME ?? '').trim();
        const position = String(row.Position ?? row.POS ?? '').trim();
        const ageValue = Number(row.Age ?? row.AGE);
        return {
          team: String(row.Team ?? row.TEAM ?? sheetName).trim(),
          name,
          position,
          age: Number.isFinite(ageValue) ? ageValue : undefined,
          height: String(row.Height ?? row.HT ?? '').trim() || undefined,
          weight: String(row.Weight ?? row.WT ?? '').trim() || undefined,
        };
      })
      .filter((player) => Boolean(player.name));

    if (players.length) {
      map.set(teamKey, players);
    }
  }

  rosterCache = map;
  persistToLocalStorage(map);
  return map;
}

const resolveAlias = (key: string) => MATCH_ALIASES[key] ?? key;

const resolveTeamKey = ({
  teamName,
  triCode,
  teamId,
}: {
  teamName?: string;
  triCode?: string;
  teamId?: number;
}) => {
  if (teamName) {
    return resolveAlias(normalizeTeamKey(teamName));
  }
  if (triCode) {
    const name = TRI_TO_NAME[triCode.toUpperCase()];
    if (name) {
      return resolveAlias(normalizeTeamKey(name));
    }
  }
  if (typeof teamId === 'number' && Number.isFinite(teamId)) {
    const name = ID_TO_NAME[teamId];
    if (name) {
      return resolveAlias(normalizeTeamKey(name));
    }
  }
  return null;
};

const sortPlayers = (list: Player[]) =>
  [...list].sort((a, b) => {
    const posCompare = (a.position || '').localeCompare(b.position || '');
    if (posCompare !== 0) {
      return posCompare;
    }
    return a.name.localeCompare(b.name);
  });

export async function getPlayersByTeam(input: {
  teamName?: string;
  triCode?: string;
  teamId?: number;
}): Promise<Player[]> {
  const map = await loadRostersFromExcel();
  const resolvedKey = resolveTeamKey(input);

  if (resolvedKey && map.has(resolvedKey)) {
    return sortPlayers(map.get(resolvedKey)!);
  }

  if (resolvedKey) {
    const fuzzyKey = [...map.keys()].find(
      (key) => key.includes(resolvedKey) || resolvedKey.includes(key),
    );
    if (fuzzyKey && map.has(fuzzyKey)) {
      return sortPlayers(map.get(fuzzyKey)!);
    }
  }

  if (input.triCode) {
    const name = TRI_TO_NAME[input.triCode.toUpperCase()];
    if (name) {
      const normalized = normalizeTeamKey(name);
      if (map.has(normalized)) {
        return sortPlayers(map.get(normalized)!);
      }
    }
  }

  return [];
}

export async function preloadRosters(): Promise<void> {
  try {
    await loadRostersFromExcel();
  } catch (error) {
    console.warn('[preloadRosters] failed:', error);
  }
}
