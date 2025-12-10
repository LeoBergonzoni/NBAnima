"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamEmojiByAbbr = exports.TEAM_EMOJIS = void 0;
exports.TEAM_EMOJIS = {
    ATL: '🦅',
    BOS: '☘️',
    BKN: '🕸️',
    CHA: '🐝',
    CHI: '🐂',
    CLE: '⚔️',
    DAL: '🐴',
    DEN: '⛏️',
    DET: '🔩',
    GSW: '🌉',
    HOU: '🚀',
    IND: '🏎️',
    LAC: '🚤',
    LAL: '🌅',
    MEM: '🐻',
    MIA: '🔥',
    MIL: '🦌',
    MIN: '🐺',
    NOP: '🦤',
    NYK: '🗽',
    OKC: '⚡',
    ORL: '🔮',
    PHI: '🎆',
    PHX: '☀️',
    POR: '🔺',
    SAC: '👑',
    SAS: '⚙️',
    TOR: '🦖',
    UTA: '🎷',
    WAS: '🧙‍♂️',
};
const getTeamEmojiByAbbr = (abbr) => {
    const normalized = (abbr ?? '').trim().toUpperCase();
    if (!normalized)
        return null;
    return exports.TEAM_EMOJIS[normalized] ?? null;
};
exports.getTeamEmojiByAbbr = getTeamEmojiByAbbr;
