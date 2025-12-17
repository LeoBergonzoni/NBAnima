import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase.types';

type DB = SupabaseClient<Database>;
type PlayerRow = Database['public']['Tables']['player']['Row'] & {
  team?: { abbr?: string | null } | null;
};

const PLAYER_PROVIDER = 'espn';

// Da qui in avanti la fonte di verità per i giocatori è public.player con provider='espn'.
// Source of truth for players is rows where provider = 'espn'.
const basePlayerQuery = (client: DB) =>
  client
    .from('player')
    .select('id, provider_player_id, first_name, last_name, team_id, team:team_id (abbr)')
    .eq('provider', PLAYER_PROVIDER);

export const normalizeProviderId = (value: string) => {
  // Align roster slugs to ESPN ids:
  // - lowercase
  // - replace apostrophes/dots/space-ish with "-"
  // - collapse multiple "-"
  // - drop trailing "-g/-f/-c" role suffix
  let cleaned = value.trim().toLowerCase();
  cleaned = cleaned.replace(/['.]/g, '-');
  cleaned = cleaned.replace(/[^a-z0-9-]+/g, '-');
  cleaned = cleaned.replace(/-+/g, '-').replace(/^-|-$/g, '');

  const parts = cleaned.split('-');
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (/^[gfc]$/.test(last)) {
      parts.pop();
      cleaned = parts.join('-');
    }
  }
  return cleaned;
};

export const stripJerseyNumber = (value: string) => {
  const parts = value.split('-');
  if (parts.length < 2) {
    return value;
  }
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) {
    parts.pop();
  }
  return parts.join('-');
};

export const getEspnPlayersByProviderIds = async (
  client: DB,
  providerIds: string[],
): Promise<Map<string, PlayerRow>> => {
  const rawIds = providerIds.filter(Boolean);
  const normalizedIds = rawIds.map(normalizeProviderId);
  const jerseylessIds = [...rawIds, ...normalizedIds].map(stripJerseyNumber);
  const dotNumberVariant = (value: string) => value.replace(/-(\d+)$/, '.$1');
  const queryIds = Array.from(
    new Set([
      ...rawIds,
      ...normalizedIds,
      ...jerseylessIds,
      ...rawIds.map(dotNumberVariant),
      ...normalizedIds.map(dotNumberVariant),
    ]),
  ).filter(Boolean);
  if (queryIds.length === 0) {
    return new Map();
  }

  const { data, error } = await basePlayerQuery(client).in('provider_player_id', queryIds);
  if (error) {
    throw error;
  }

  const deduped = new Map<string, PlayerRow>();
  const addRow = (row: PlayerRow) => {
    const player = row as PlayerRow;
    const raw = player.provider_player_id ?? '';
    if (!raw) return;
    const normalized = normalizeProviderId(raw);
    const jerseyless = stripJerseyNumber(normalized);
    const dotNumber = normalized.replace(/-(\d+)$/, '.$1');
    if (!deduped.has(raw)) {
      deduped.set(raw, player as PlayerRow);
    }
    if (!deduped.has(normalized)) {
      deduped.set(normalized, player as PlayerRow);
    }
    if (jerseyless && !deduped.has(jerseyless)) {
      deduped.set(jerseyless, player as PlayerRow);
    }
    if (!deduped.has(dotNumber)) {
      deduped.set(dotNumber, player as PlayerRow);
    }
  };

  (data ?? []).forEach(addRow);

  // Fallback: if any target id variants are still missing, hydrate the map with all ESPN players
  const requiredVariants = new Set<string>();
  rawIds.forEach((raw) => {
    const norm = normalizeProviderId(raw);
    const jerseyless = stripJerseyNumber(norm);
    requiredVariants.add(raw);
    requiredVariants.add(norm);
    requiredVariants.add(jerseyless);
    requiredVariants.add(dotNumberVariant(raw));
    requiredVariants.add(dotNumberVariant(norm));
  });

  const isMissing = Array.from(requiredVariants)
    .filter(Boolean)
    .some((id) => !deduped.has(id));

  if (isMissing) {
    const { data: allPlayers, error: allError } = await basePlayerQuery(client).select();
    if (allError) {
      throw allError;
    }
    (allPlayers ?? []).forEach(addRow);
  }

  return deduped;
};

export const getEspnPlayersForTeams = async (
  client: DB,
  teamIds: string[],
): Promise<PlayerRow[]> => {
  const uniqueTeams = Array.from(new Set(teamIds.filter(Boolean)));
  if (uniqueTeams.length === 0) {
    return [];
  }

  const { data, error } = await basePlayerQuery(client).in('team_id', uniqueTeams);
  if (error) {
    throw error;
  }

  const byProviderId = new Map<string, PlayerRow>();
  const players = (data ?? []) as PlayerRow[];

  players.forEach((player) => {
    const key = player.provider_player_id ?? player.id;
    if (!byProviderId.has(key)) {
      byProviderId.set(key, player);
    }
  });

  return Array.from(byProviderId.values());
};
