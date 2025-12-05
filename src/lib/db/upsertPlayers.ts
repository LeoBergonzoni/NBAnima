import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase.types';

export type UpsertablePlayer = {
  provider: string;
  provider_player_id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  position?: string | null;
  active?: boolean;
};

const dedupePlayers = (players: UpsertablePlayer[]): UpsertablePlayer[] => {
  const map = new Map<string, UpsertablePlayer>();
  players.forEach((player) => {
    if (!player.provider || !player.provider_player_id) {
      return;
    }
    const key = `${player.provider}:${player.provider_player_id}`;
    map.set(key, player);
  });
  return Array.from(map.values());
};

export const upsertPlayers = async (
  supabaseAdmin: SupabaseClient<Database>,
  players: UpsertablePlayer[],
) => {
  const uniquePlayers = dedupePlayers(players);
  if (uniquePlayers.length === 0) {
    return { data: [], error: null };
  }

  return supabaseAdmin
    .from('player')
    .upsert(uniquePlayers, {
      onConflict: 'provider,provider_player_id',
      ignoreDuplicates: false,
    })
    .select('id, provider, provider_player_id');
};
