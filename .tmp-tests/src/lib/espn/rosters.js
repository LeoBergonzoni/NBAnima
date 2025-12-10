"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchEspnRosters = void 0;
const ESPN_BASE = 'https://www.espn.com';
const TEAMS_URL = `${ESPN_BASE}/nba/teams`;
const stripTags = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const decodeEntities = (value) => {
    const entities = {
        '&amp;': '&',
        '&#38;': '&',
        '&apos;': "'",
        '&#x27;': "'",
        '&#39;': "'",
        '&quot;': '"',
        '&#34;': '"',
        '&lt;': '<',
        '&#60;': '<',
        '&gt;': '>',
        '&#62;': '>',
    };
    return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match) => entities[match.toLowerCase()] ?? match);
};
const normalizeName = (raw) => {
    const decoded = decodeEntities(raw).trim();
    // Se il numero di maglia è attaccato al cognome, inserisci uno spazio (es. Walter14 -> Walter 14)
    const spaced = decoded.replace(/([A-Za-z])(\d{1,3})$/, '$1 $2');
    return spaced;
};
const extractRosterLinks = (html) => {
    const links = new Set();
    const regex = /href="([^"]*?\/team\/roster\/[^"]*?)"[^>]*>Roster</gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        const href = match[1];
        const absolute = href.startsWith('http') ? href : `${ESPN_BASE}${href}`;
        links.add(absolute);
    }
    return Array.from(links);
};
const parseRosterPage = (html, url) => {
    // Team abbr dal path
    const abbrMatch = /\/name\/([a-z0-9-]+)/i.exec(url);
    const abbr = abbrMatch ? abbrMatch[1]?.toUpperCase().replace(/-/g, '') : '';
    // Team name dall'h1
    let teamName = '';
    const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    if (h1Match) {
        teamName = stripTags(h1Match[1]).replace(/Roster\s+\d{4}-\d{2}/, '').trim();
    }
    // Prima tabella nel markup
    const tableMatch = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(html);
    if (!tableMatch) {
        return { team: { name: teamName, abbr, id: abbr }, players: [] };
    }
    const tableHtml = tableMatch[1];
    const headerCells = Array.from(tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map((m) => stripTags(m[1]));
    const colIndex = (name) => {
        const idx = headerCells.findIndex((h) => h.toLowerCase() === name.toLowerCase());
        return idx >= 0 ? idx : null;
    };
    const idxName = colIndex('Name');
    const idxPos = colIndex('POS');
    const rows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    const players = [];
    rows.forEach((rowMatch) => {
        const rowHtml = rowMatch[1];
        const cells = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => stripTags(m[1]));
        if (!cells.length)
            return;
        const name = idxName !== null ? cells[idxName] ?? '' : cells[0] ?? '';
        const pos = idxPos !== null ? cells[idxPos] ?? '' : '';
        if (!name)
            return;
        const cleanName = normalizeName(name);
        players.push({
            id: cleanName.toLowerCase().replace(/\s+/g, '-'),
            fullName: cleanName,
            position: pos || null,
            jersey: null,
        });
    });
    return { team: { name: teamName, abbr, id: abbr }, players };
};
const fetchEspnRosters = async () => {
    const teamsPage = await fetch(TEAMS_URL, { cache: 'no-store' });
    if (!teamsPage.ok) {
        const text = await teamsPage.text().catch(() => '');
        throw new Error(`Failed to fetch teams page: ${teamsPage.status} ${text || teamsPage.statusText}`);
    }
    const teamsHtml = await teamsPage.text();
    const rosterLinks = extractRosterLinks(teamsHtml);
    if (!rosterLinks.length) {
        throw new Error('No roster links found on ESPN teams page');
    }
    const results = await Promise.all(rosterLinks.map(async (link) => {
        try {
            const res = await fetch(link, { cache: 'no-store' });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Roster fetch failed ${res.status}: ${text || res.statusText}`);
            }
            const html = await res.text();
            return parseRosterPage(html, link);
        }
        catch (error) {
            return { team: { name: link, abbr: '', id: '' }, players: [], error: error.message };
        }
    }));
    const successes = results.filter((r) => !r.error);
    const errors = results
        .filter((r) => r.error)
        .map((r) => ({ team: r.team, error: r.error }));
    return { teams: successes, errors };
};
exports.fetchEspnRosters = fetchEspnRosters;
