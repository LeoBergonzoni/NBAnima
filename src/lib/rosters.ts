import { promises as fs } from 'node:fs';
import path from 'node:path';

export type RosterPlayer = {
  id: string;
  name: string;
  pos?: string;
  jersey?: string;
};

export type RostersMap = Record<string, RosterPlayer[]>;

type TeamLookupArgs = {
  id?: string | number | null;
  abbr?: string | null;
  name?: string | null;
};

let rostersCache: RostersMap | null = null;
let rostersPromise: Promise<RostersMap> | null = null;

const rostersPath = path.join(process.cwd(), 'public', 'rosters.json');

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function loadRosters(): Promise<RostersMap> {
  const file = await fs.readFile(rostersPath, 'utf8');
  const parsed = JSON.parse(file) as RostersMap;
  return parsed;
}

export async function getRosters(): Promise<RostersMap> {
  if (rostersCache) {
    return rostersCache;
  }
  if (!rostersPromise) {
    rostersPromise = loadRosters()
      .then((data) => {
        rostersCache = data;
        return data;
      })
      .catch((error) => {
        rostersPromise = null;
        throw error;
      });
  }
  return rostersPromise;
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
    }
  }
  if (name) {
    const trimmed = name.trim();
    if (trimmed) {
      keys.add(slugify(trimmed));
      keys.add(trimmed.toUpperCase());
    }
  }
  return Array.from(keys);
}
