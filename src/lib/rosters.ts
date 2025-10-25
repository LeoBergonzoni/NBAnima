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
const DEV =
  typeof window !== 'undefined' && window.location.hostname.includes('localhost');

const normalizeTeamKey = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
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
  phoenix: 'phoenix suns',
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
    if (DEV) {
      console.info('[rosters] revived from localStorage:', revived.size, 'teams');
    }
    return rosterCache;
  }

  const url = new URL('/nba_rosters_full.xlsx', window.location.origin).toString();
  const buffer = await fetch(url, { cache: 'no-cache' }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.arrayBuffer();
  });

  const workbook = XLSX.read(buffer, { type: 'array' });
  const map: RosterMap = new Map();
  if (DEV) {
    console.info('[rosters] sheets:', workbook.SheetNames);
  }

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
        } as Player;
      })
      .filter((player) => Boolean(player.name));

    if (players.length) {
      map.set(teamKey, players);
    }
  }

  rosterCache = map;
  persistToLocalStorage(map);
  if (DEV) {
    console.info('[rosters] loaded teams:', map.size);
  }
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

const orderPlayers = (list: Player[]) =>
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
  const key = resolveTeamKey(input);

  if (DEV) {
    console.info('[rosters] resolve', input, '→', key);
  }

  if (key && map.has(key)) {
    return orderPlayers(map.get(key)!);
  }

  if (key) {
    const fuzzyKey = [...map.keys()].find(
      (entry) => entry.includes(key) || key.includes(entry),
    );
    if (DEV) {
      console.warn('[rosters] fuzzy', key, '→', fuzzyKey);
    }
    if (fuzzyKey && map.has(fuzzyKey)) {
      return orderPlayers(map.get(fuzzyKey)!);
    }
  }

  if (input.triCode) {
    const name = TRI_TO_NAME[input.triCode.toUpperCase()];
    const normalized = name ? normalizeTeamKey(name) : null;
    if (normalized && map.has(normalized)) {
      return orderPlayers(map.get(normalized)!);
    }
  }

  if (DEV) {
    console.error('[rosters] not found for', input);
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
