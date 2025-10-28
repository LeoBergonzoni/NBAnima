import { promises as fs } from 'node:fs';
import path from 'node:path';

export type RosterPlayer = {
  id: string;
  name: string;
  pos?: string;
  jersey?: string;
};

export type RostersMap = Record<string, RosterPlayer[]>;

type AliasMap = Record<string, string>;

type TeamLookupArgs = {
  id?: string | number | null;
  abbr?: string | null;
  name?: string | null;
};

let rostersCache: RostersMap | null = null;
let rostersPromise: Promise<RostersMap> | null = null;
let aliasesCache: AliasMap | null = null;
let aliasesPromise: Promise<AliasMap> | null = null;
let slugToKeyCache: Map<string, string> | null = null;

const rostersPath = path.join(process.cwd(), 'public', 'rosters.json');
const aliasesPath = path.join(process.cwd(), 'public', 'roster-aliases.json');

export const slugTeam = (value: string): string => {
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

const readJSON = async <T>(filePath: string): Promise<T> => {
  const file = await fs.readFile(filePath, 'utf8');
  return JSON.parse(file) as T;
};

export const resetRosterCaches = () => {
  rostersCache = null;
  rostersPromise = null;
  aliasesCache = null;
  aliasesPromise = null;
  slugToKeyCache = null;
};

export async function getRosters(): Promise<RostersMap> {
  if (rostersCache) {
    return rostersCache;
  }
  if (!rostersPromise) {
    rostersPromise = readJSON<RostersMap>(rostersPath)
      .then((data) => {
        rostersCache = data;
        slugToKeyCache = new Map(
          Object.keys(data).map((key) => [slugTeam(key), key]),
        );
        return data;
      })
      .catch((error) => {
        rostersPromise = null;
        throw error;
      });
  }
  return rostersPromise;
}

async function getRosterAliases(): Promise<AliasMap> {
  if (aliasesCache) {
    return aliasesCache;
  }
  if (!aliasesPromise) {
    aliasesPromise = readJSON<AliasMap>(aliasesPath)
      .then((data) => {
        aliasesCache = data;
        return data;
      })
      .catch((error) => {
        aliasesPromise = null;
        throw error;
      });
  }
  return aliasesPromise;
}

export async function resolveTeamKey(input: string | null | undefined): Promise<string | null> {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const rosters = await getRosters();
  const aliases = await getRosterAliases();
  const slugCache = slugToKeyCache ?? new Map<string, string>();
  slugToKeyCache = slugCache;

  if (trimmed in rosters) {
    return trimmed;
  }

  const upper = trimmed.toUpperCase();
  if (upper in rosters) {
    return upper;
  }

  if (/^\d+$/.test(trimmed) && trimmed in rosters) {
    return trimmed;
  }

  const normalized = slugTeam(trimmed);
  if (!normalized) {
    return null;
  }

  if (!slugCache.has(normalized)) {
    Object.keys(rosters).forEach((key) => {
      const slug = slugTeam(key);
      if (slug && !slugCache.has(slug)) {
        slugCache.set(slug, key);
      }
    });
  }

  const directSlugMatch = slugCache.get(normalized);
  if (directSlugMatch) {
    return directSlugMatch;
  }

  const aliasMatch = aliases[normalized];
  if (aliasMatch && aliasMatch in rosters) {
    return aliasMatch;
  }

  for (const [slug, key] of slugCache.entries()) {
    if (normalized.includes(slug) || slug.includes(normalized)) {
      return key;
    }
  }

  return null;
}

export function lookupTeamKeys({ id, abbr, name }: TeamLookupArgs): string[] {
  const keys = new Set<string>();
  if (id !== undefined && id !== null && `${id}`.trim() !== '') {
    keys.add(`${id}`.trim());
  }
  if (abbr) {
    const trimmed = abbr.trim();
    if (trimmed) {
      keys.add(trimmed.toUpperCase());
      keys.add(slugTeam(trimmed));
    }
  }
  if (name) {
    const trimmed = name.trim();
    if (trimmed) {
      keys.add(trimmed);
      keys.add(slugTeam(trimmed));
    }
  }
  return Array.from(keys);
}
