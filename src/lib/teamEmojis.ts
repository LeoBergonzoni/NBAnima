export const TEAM_EMOJIS: Record<string, string> = {
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

export const getTeamEmojiByAbbr = (abbr?: string | null) => {
  const normalized = (abbr ?? '').trim().toUpperCase();
  if (!normalized) return null;
  return TEAM_EMOJIS[normalized] ?? null;
};
