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
type AliasMap = Record<string, string>;

type TeamMeta = {
  id: string;
  abbr: string;
  city: string;
  nickname: string;
};

const SOURCE_XLSX = path.join(process.cwd(), 'public', 'nba_rosters_full.xlsx');
const OUTPUT_ROSTERS = path.join(process.cwd(), 'public', 'rosters.json');
const OUTPUT_ALIASES = path.join(process.cwd(), 'public', 'roster-aliases.json');

const slugTeam = (value: string): string => {
  if (!value) {
    return '';
  }

  let normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .trim();

  const prefixReplacements: Array<[RegExp, string]> = [
    [/^ny(?=[-\s]|$)/, 'new york'],
    [/^nyc(?=[-\s]|$)/, 'new york city'],
    [/^la(?=[-\s]|$)/, 'los angeles'],
    [/^gsw(?=[-\s]|$)/, 'golden state'],
    [/^gs(?=[-\s]|$)/, 'golden state'],
    [/^okc(?=[-\s]|$)/, 'oklahoma city'],
    [/^sa(?=[-\s]|$)/, 'san antonio'],
    [/^no(?=[-\s]|$)/, 'new orleans'],
    [/^phx(?=[-\s]|$)/, 'phoenix'],
    [/^phila(?=[-\s]|$)/, 'philadelphia'],
  ];

  for (const [pattern, replacement] of prefixReplacements) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement);
      break;
    }
  }

  normalized = normalized.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
  return normalized.replace(/^-+|-+$/g, '');
};

const TEAM_DATA: TeamMeta[] = [
  { id: '1610612737', abbr: 'ATL', city: 'Atlanta', nickname: 'Hawks' },
  { id: '1610612738', abbr: 'BOS', city: 'Boston', nickname: 'Celtics' },
  { id: '1610612751', abbr: 'BKN', city: 'Brooklyn', nickname: 'Nets' },
  { id: '1610612766', abbr: 'CHA', city: 'Charlotte', nickname: 'Hornets' },
  { id: '1610612741', abbr: 'CHI', city: 'Chicago', nickname: 'Bulls' },
  { id: '1610612739', abbr: 'CLE', city: 'Cleveland', nickname: 'Cavaliers' },
  { id: '1610612742', abbr: 'DAL', city: 'Dallas', nickname: 'Mavericks' },
  { id: '1610612743', abbr: 'DEN', city: 'Denver', nickname: 'Nuggets' },
  { id: '1610612765', abbr: 'DET', city: 'Detroit', nickname: 'Pistons' },
  { id: '1610612744', abbr: 'GSW', city: 'Golden State', nickname: 'Warriors' },
  { id: '1610612745', abbr: 'HOU', city: 'Houston', nickname: 'Rockets' },
  { id: '1610612754', abbr: 'IND', city: 'Indiana', nickname: 'Pacers' },
  { id: '1610612746', abbr: 'LAC', city: 'Los Angeles', nickname: 'Clippers' },
  { id: '1610612747', abbr: 'LAL', city: 'Los Angeles', nickname: 'Lakers' },
  { id: '1610612763', abbr: 'MEM', city: 'Memphis', nickname: 'Grizzlies' },
  { id: '1610612748', abbr: 'MIA', city: 'Miami', nickname: 'Heat' },
  { id: '1610612749', abbr: 'MIL', city: 'Milwaukee', nickname: 'Bucks' },
  { id: '1610612750', abbr: 'MIN', city: 'Minnesota', nickname: 'Timberwolves' },
  { id: '1610612740', abbr: 'NOP', city: 'New Orleans', nickname: 'Pelicans' },
  { id: '1610612752', abbr: 'NYK', city: 'New York', nickname: 'Knicks' },
  { id: '1610612760', abbr: 'OKC', city: 'Oklahoma City', nickname: 'Thunder' },
  { id: '1610612753', abbr: 'ORL', city: 'Orlando', nickname: 'Magic' },
  { id: '1610612755', abbr: 'PHI', city: 'Philadelphia', nickname: '76ers' },
  { id: '1610612756', abbr: 'PHX', city: 'Phoenix', nickname: 'Suns' },
  { id: '1610612757', abbr: 'POR', city: 'Portland', nickname: 'Trail Blazers' },
  { id: '1610612758', abbr: 'SAC', city: 'Sacramento', nickname: 'Kings' },
  { id: '1610612759', abbr: 'SAS', city: 'San Antonio', nickname: 'Spurs' },
  { id: '1610612761', abbr: 'TOR', city: 'Toronto', nickname: 'Raptors' },
  { id: '1610612762', abbr: 'UTA', city: 'Utah', nickname: 'Jazz' },
  { id: '1610612764', abbr: 'WAS', city: 'Washington', nickname: 'Wizards' },
];

const TEAM_BY_ABBR = new Map(TEAM_DATA.map((meta) => [meta.abbr, meta]));
const TEAM_BY_ID = new Map(TEAM_DATA.map((meta) => [meta.id, meta]));
const TEAM_BY_SLUG = new Map(
  TEAM_DATA.map((meta) => [slugTeam(`${meta.city} ${meta.nickname}`), meta]),
);

const TEAM_ID_KEYS = ['teamid', 'teamcode', 'team', 'franchiseid'];
const TEAM_ABBR_KEYS = ['teamabbr', 'abbr', 'abbreviation'];
const TEAM_NAME_KEYS = ['teamname', 'team', 'name'];
const PLAYER_ID_KEYS = ['playerid', 'id', 'personid', 'playercode'];
const PLAYER_NAME_KEYS = ['playername', 'name', 'fullname', 'full_name'];
const PLAYER_POS_KEYS = ['position', 'pos'];
const PLAYER_JERSEY_KEYS = ['jersey', 'number', 'jerseynumber', 'uniform'];
const ACTIVE_KEYS = ['active', 'isactive', 'status'];

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

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

const TEAM_ALIAS_OVERRIDES: Record<string, string[]> = {
  LAC: ['la clippers', 'los angeles clippers', 'clipper', 'clippers'],
  LAL: ['la lakers', 'los angeles lakers', 'laker', 'lakers'],
  NYK: ['ny knicks', 'new york knicks', 'knicks'],
  OKC: ['okc thunder', 'oklahoma city thunder', 'thunder'],
  GSW: ['gs warriors', 'golden state warriors', 'warriors'],
  SAS: ['sa spurs', 'san antonio spurs', 'spurs'],
  NOP: ['no pelicans', 'new orleans pelicans', 'pelicans', 'pels'],
  PHX: ['phoenix suns', 'suns'],
  PHI: ['philadelphia 76ers', 'sixers', '76ers'],
  POR: ['portland trail blazers', 'trail blazers', 'blazers'],
};

const rostersMap = new Map<string, Map<string, Player>>();
const aliasMap = new Map<string, string>();
const registeredTeams = new Set<string>();

const addAlias = (alias: string | null | undefined, canonical: string) => {
  if (!alias) {
    return;
  }
  const trimmed = alias.trim();
  if (!trimmed) {
    return;
  }
  if (/^\d+$/.test(trimmed)) {
    if (!aliasMap.has(trimmed)) {
      aliasMap.set(trimmed, canonical);
    }
    return;
  }
  const slug = slugTeam(trimmed);
  if (!slug) {
    return;
  }
  if (!aliasMap.has(slug)) {
    aliasMap.set(slug, canonical);
  }
};

const registerTeam = (
  canonicalKey: string,
  details: {
    teamId?: string;
    teamAbbr?: string;
    teamName?: string;
  },
  meta: TeamMeta | null,
) => {
  if (registeredTeams.has(canonicalKey)) {
    return;
  }
  registeredTeams.add(canonicalKey);

  addAlias(canonicalKey, canonicalKey);

  if (meta) {
    addAlias(meta.abbr, canonicalKey);
    addAlias(meta.abbr.toLowerCase(), canonicalKey);
    addAlias(meta.id, canonicalKey);
    const cityNickname = `${meta.city} ${meta.nickname}`;
    addAlias(cityNickname, canonicalKey);
    addAlias(meta.nickname, canonicalKey);
    addAlias(meta.city, canonicalKey);
    addAlias(`${meta.city}-${meta.nickname}`, canonicalKey);
    addAlias(`${meta.nickname}-${meta.city}`, canonicalKey);

    const override = TEAM_ALIAS_OVERRIDES[meta.abbr];
    if (override) {
      override.forEach((alias) => addAlias(alias, canonicalKey));
    }

    addAlias(`the ${meta.nickname}`, canonicalKey);
  }

  if (details.teamId) addAlias(details.teamId, canonicalKey);
  if (details.teamAbbr) addAlias(details.teamAbbr, canonicalKey);
  if (details.teamName) addAlias(details.teamName, canonicalKey);
};

const findTeamMeta = (teamId: string, teamAbbr: string, teamName: string): TeamMeta | null => {
  if (teamAbbr && TEAM_BY_ABBR.has(teamAbbr)) {
    return TEAM_BY_ABBR.get(teamAbbr)!;
  }
  if (teamId && TEAM_BY_ID.has(teamId)) {
    return TEAM_BY_ID.get(teamId)!;
  }
  if (teamName) {
    const slug = slugTeam(teamName);
    if (TEAM_BY_SLUG.has(slug)) {
      return TEAM_BY_SLUG.get(slug)!;
    }
  }
  return null;
};

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

async function buildRosters() {
  const buffer = await fs.readFile(SOURCE_XLSX);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

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

      const meta = findTeamMeta(teamId, teamAbbr, teamName);

      const canonicalKey = meta?.abbr
        ? meta.abbr
        : teamId
        ? teamId
        : teamAbbr
        ? teamAbbr
        : slugTeam(teamName);

      if (!canonicalKey) {
        return;
      }

      registerTeam(canonicalKey, { teamId, teamAbbr, teamName }, meta);

      const playerId = ensureString(rawPlayerId) || slugTeam(`${name}-${ensureString(rawPos)}`);

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

      registerPlayer(canonicalKey, player);
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

  const aliases: AliasMap = {};
  for (const [alias, key] of aliasMap.entries()) {
    aliases[alias] = key;
  }

  await fs.mkdir(path.dirname(OUTPUT_ROSTERS), { recursive: true });
  await fs.writeFile(OUTPUT_ROSTERS, `${JSON.stringify(rosters, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUTPUT_ALIASES, `${JSON.stringify(aliases, null, 2)}\n`, 'utf8');

  console.log(
    `[build-rosters] Generated ${Object.keys(rosters).length} teams → ${OUTPUT_ROSTERS}`,
  );
  console.log(
    `[build-rosters] Generated ${Object.keys(aliases).length} aliases → ${OUTPUT_ALIASES}`,
  );
}

buildRosters().catch((error) => {
  console.error('[build-rosters] Failed:', error);
  process.exitCode = 1;
});
