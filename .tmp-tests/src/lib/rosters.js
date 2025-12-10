"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetRosterCaches = exports.slugTeam = void 0;
exports.getRosters = getRosters;
exports.resolveTeamKey = resolveTeamKey;
exports.lookupTeamKeys = lookupTeamKeys;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
let rostersCache = null;
let rostersPromise = null;
let aliasesCache = null;
let aliasesPromise = null;
let slugToKeyCache = null;
const BDL_TEAM_ID_MAP = {
    '1': 'AtlantaHawks',
    '2': 'BostonCeltics',
    '3': 'BrooklynNets',
    '4': 'CharlotteHornets',
    '5': 'ChicagoBulls',
    '6': 'ClevelandCavaliers',
    '7': 'DallasMavericks',
    '8': 'DenverNuggets',
    '9': 'DetroitPistons',
    '10': 'GoldenStateWarriors',
    '11': 'HoustonRockets',
    '12': 'IndianaPacers',
    '13': 'LAClippers',
    '14': 'LosAngelesLakers',
    '15': 'MemphisGrizzlies',
    '16': 'MiamiHeat',
    '17': 'MilwaukeeBucks',
    '18': 'MinnesotaTimberwolves',
    '19': 'NewOrleansPelicans',
    '20': 'NewYorkKnicks',
    '21': 'OklahomaCityThunder',
    '22': 'OrlandoMagic',
    '23': 'Philadelphia76ers',
    '24': 'PhoenixSuns',
    '25': 'PortlandTrailBlazers',
    '26': 'SacramentoKings',
    '27': 'SanAntonioSpurs',
    '28': 'TorontoRaptors',
    '29': 'UtahJazz',
    '30': 'WashingtonWizards',
};
const rostersPath = node_path_1.default.join(process.cwd(), 'public', 'rosters.json');
const aliasesPath = node_path_1.default.join(process.cwd(), 'public', 'roster-aliases.json');
const slugTeam = (value) => {
    if (!value) {
        return '';
    }
    let normalized = value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .trim();
    const prefixReplacements = [
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
exports.slugTeam = slugTeam;
const readJSON = async (filePath) => {
    const file = await node_fs_1.promises.readFile(filePath, 'utf8');
    return JSON.parse(file);
};
const resetRosterCaches = () => {
    rostersCache = null;
    rostersPromise = null;
    aliasesCache = null;
    aliasesPromise = null;
    slugToKeyCache = null;
};
exports.resetRosterCaches = resetRosterCaches;
async function getRosters() {
    if (rostersCache) {
        return rostersCache;
    }
    if (!rostersPromise) {
        rostersPromise = readJSON(rostersPath)
            .then((data) => {
            rostersCache = data;
            slugToKeyCache = new Map(Object.keys(data).map((key) => [(0, exports.slugTeam)(key), key]));
            return data;
        })
            .catch((error) => {
            rostersPromise = null;
            throw error;
        });
    }
    return rostersPromise;
}
async function getRosterAliases() {
    if (aliasesCache) {
        return aliasesCache;
    }
    if (!aliasesPromise) {
        aliasesPromise = readJSON(aliasesPath)
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
async function resolveTeamKey(input) {
    if (!input) {
        return null;
    }
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }
    const numericCandidate = /^\d+$/.test(trimmed) ? String(Number(trimmed)) : null;
    if (numericCandidate && BDL_TEAM_ID_MAP[numericCandidate]) {
        return BDL_TEAM_ID_MAP[numericCandidate];
    }
    const rosters = await getRosters();
    const aliases = await getRosterAliases();
    const slugCache = slugToKeyCache ?? new Map();
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
    const normalized = (0, exports.slugTeam)(trimmed);
    if (!normalized) {
        return null;
    }
    if (!slugCache.has(normalized)) {
        Object.keys(rosters).forEach((key) => {
            const slug = (0, exports.slugTeam)(key);
            if (slug && !slugCache.has(slug)) {
                slugCache.set(slug, key);
            }
        });
    }
    const directSlugMatch = slugCache.get(normalized);
    if (directSlugMatch) {
        return directSlugMatch;
    }
    // 1) alias per abbreviazione (es. "nyk") → chiave rosters
    const abbrLower = upper.toLowerCase();
    const abbrAlias = aliases[abbrLower];
    if (abbrAlias && abbrAlias in rosters) {
        return abbrAlias;
    }
    // 2) alias per slug normalizzato (es. "new-york-knicks")
    const slugAlias = aliases[normalized];
    if (slugAlias && slugAlias in rosters) {
        return slugAlias;
    }
    for (const [slug, key] of slugCache.entries()) {
        if (normalized.includes(slug) || slug.includes(normalized)) {
            return key;
        }
    }
    return null;
}
function lookupTeamKeys({ id, abbr, name }) {
    const keys = new Set();
    if (id !== undefined && id !== null && `${id}`.trim() !== '') {
        keys.add(`${id}`.trim());
    }
    if (abbr) {
        const trimmed = abbr.trim();
        if (trimmed) {
            keys.add(trimmed.toUpperCase());
            keys.add((0, exports.slugTeam)(trimmed));
        }
    }
    if (name) {
        const trimmed = name.trim();
        if (trimmed) {
            keys.add(trimmed);
            keys.add((0, exports.slugTeam)(trimmed));
        }
    }
    return Array.from(keys);
}
