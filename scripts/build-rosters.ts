import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import * as XLSX from 'xlsx';

type Player = {
  id: string;
  name: string;
  pos?: string;
  jersey?: string;
};

type Rosters = Record<string, Player[]>;

const SOURCE_XLSX = path.join(process.cwd(), 'public', 'nba_rosters_full.xlsx');
const OUTPUT_JSON = path.join(process.cwd(), 'public', 'rosters.json');

const normalizeKey = (key: string) =>
  key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';

const collapseSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

const isTruthy = (value: unknown) => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '') {
    return false;
  }
  return ['1', 'true', 'yes', 'y', 'active'].includes(normalized);
};

const TEAM_ID_KEYS = ['teamid', 'teamcode', 'team', 'franchiseid'];
const TEAM_ABBR_KEYS = ['teamabbr', 'abbr', 'abbreviation'];
const TEAM_NAME_KEYS = ['teamname', 'team', 'name'];
const PLAYER_ID_KEYS = ['playerid', 'id', 'personid', 'playercode'];
const PLAYER_NAME_KEYS = ['playername', 'name', 'fullname', 'full_name'];
const PLAYER_POS_KEYS = ['position', 'pos'];
const PLAYER_JERSEY_KEYS = ['jersey', 'number', 'jerseynumber', 'uniform'];
const ACTIVE_KEYS = ['active', 'isactive', 'status'];

type NormalizedRow = {
  raw: Record<string, unknown>;
  map: Map<string, { key: string; value: unknown }>;
};

const toNormalizedRow = (row: Record<string, unknown>): NormalizedRow => {
  const map = new Map<string, { key: string; value: unknown }>();
  Object.entries(row).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    if (!normalized) {
      return;
    }
    map.set(normalized, { key, value });
  });
  return { raw: row, map };
};

const findValue = (
  row: NormalizedRow,
  candidates: string[],
  predicate?: (normalized: string) => boolean,
) => {
  for (const [normalized, entry] of row.map.entries()) {
    if (
      candidates.some((candidate) => normalized.includes(candidate)) ||
      (predicate && predicate(normalized))
    ) {
      return entry.value;
    }
  }
  return undefined;
};

const ensureString = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }
  return collapseSpaces(String(value));
};

async function buildRosters() {
  const buffer = await fs.readFile(SOURCE_XLSX);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const rostersMap = new Map<string, Map<string, Player>>();

  const registerPlayer = (teamKey: string, player: Player) => {
    if (!teamKey || !player.id || !player.name) {
      return;
    }
    let teamPlayers = rostersMap.get(teamKey);
    if (!teamPlayers) {
      teamPlayers = new Map();
      rostersMap.set(teamKey, teamPlayers);
    }
    const dedupeKey = player.id || `${player.name}|${player.pos ?? ''}`;
    if (!teamPlayers.has(dedupeKey)) {
      teamPlayers.set(dedupeKey, player);
    }
  };

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
    });

    rows.forEach((row) => {
      const normalized = toNormalizedRow(row);

      const rawTeamId = findValue(normalized, TEAM_ID_KEYS, (key) =>
        key.startsWith('team') && key.endsWith('id'),
      );
      const rawTeamAbbr = findValue(normalized, TEAM_ABBR_KEYS, (key) =>
        key.includes('abbr'),
      );
      const rawTeamName = findValue(normalized, TEAM_NAME_KEYS, (key) =>
        key.includes('team') && key.includes('name'),
      );
      const rawPlayerId = findValue(normalized, PLAYER_ID_KEYS, (key) =>
        key.includes('player') && key.endsWith('id'),
      );
      const rawPlayerName = findValue(
        normalized,
        PLAYER_NAME_KEYS,
        (key) => key.endsWith('name') && !key.includes('team'),
      );
      const rawPos = findValue(normalized, PLAYER_POS_KEYS);
      const rawJersey = findValue(normalized, PLAYER_JERSEY_KEYS);
      const rawActive = findValue(normalized, ACTIVE_KEYS);

      const hasActiveColumn =
        rawActive !== undefined && rawActive !== null && rawActive !== '';
      if (hasActiveColumn && !isTruthy(rawActive)) {
        return;
      }

      const name = collapseSpaces(ensureString(rawPlayerName));
      if (!name) {
        return;
      }

      const teamId = ensureString(rawTeamId);
      const teamAbbr = ensureString(rawTeamAbbr).toUpperCase();
      const teamName = ensureString(rawTeamName);
      const fallbackSlug = slugify(teamName || name);

      const teamKey = teamId || teamAbbr || fallbackSlug;
      if (!teamKey) {
        return;
      }

      const playerId = ensureString(rawPlayerId) || slugify(`${name}-${ensureString(rawPos)}`);

      const player: Player = {
        id: playerId,
        name,
      };

      const pos = ensureString(rawPos);
      if (pos) {
        player.pos = pos.toUpperCase();
      }

      const jersey = ensureString(rawJersey);
      if (jersey) {
        player.jersey = jersey;
      }

      registerPlayer(teamKey, player);
    });
  });

  const rosters: Rosters = {};
  const sortedTeams = Array.from(rostersMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  sortedTeams.forEach(([teamKey, playersMap]) => {
    const players = Array.from(playersMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
    );
    rosters[teamKey] = players;
  });

  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(rosters, null, 2)}\n`, 'utf8');
  console.log(
    `[build-rosters] Generated ${Object.keys(rosters).length} teams → ${OUTPUT_JSON}`,
  );
}

buildRosters().catch((error) => {
  console.error('[build-rosters] Failed:', error);
  process.exitCode = 1;
});
