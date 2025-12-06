import { NextResponse } from 'next/server';

import { listNextNightGames } from '@/lib/providers';
import { createAdminSupabaseClient } from '@/lib/supabase';
import { resolveOrUpsertGame, type ClientGameDTO } from '@/lib/server/resolveGame';
import { TIMEZONES } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const toDateNy = (iso: string | null | undefined) => {
  if (!iso) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONES.US_EASTERN,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONES.US_EASTERN,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONES.US_EASTERN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export async function GET() {
  try {
    const games = await listNextNightGames();
    const supabaseAdmin = createAdminSupabaseClient();

    const results = await Promise.allSettled(
      games.map(async (game) => {
        const dto: ClientGameDTO = {
          provider: 'bdl',
          providerGameId: game.id,
          season: 'unknown',
          status: game.status ?? 'scheduled',
          dateNY: toDateNy(game.startsAt),
          startTimeUTC: game.startsAt ?? null,
          home: {
            abbr: game.homeTeam?.abbreviation ?? undefined,
            name: game.homeTeam?.name ?? undefined,
            providerTeamId: game.homeTeam?.id,
          },
          away: {
            abbr: game.awayTeam?.abbreviation ?? undefined,
            name: game.awayTeam?.name ?? undefined,
            providerTeamId: game.awayTeam?.id,
          },
        };

        const result = await resolveOrUpsertGame({
          supabaseAdmin,
          gameProvider: 'bdl',
          providerGameId: game.id,
          dto,
        });

        return {
          ...game,
          id: result.id,
          provider_game_id: game.id,
        };
      }),
    );

    const enrichedGames = results.map((entry, index) => {
      if (entry.status === 'fulfilled') {
        return entry.value;
      }
      return {
        ...games[index],
        provider_game_id: games[index].id,
      };
    });

    const warnings = results
      .map((result, index) => ({ result, game: games[index] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, game }) => ({
        providerGameId: game.id,
        reason:
          (result as PromiseRejectedResult).reason instanceof Error
            ? (result as PromiseRejectedResult).reason.message
            : String((result as PromiseRejectedResult).reason),
      }));

    const payload =
      warnings.length > 0
        ? { games: enrichedGames, warnings }
        : enrichedGames;

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[api/games]', error);
    return NextResponse.json(
      { error: 'Failed to load games' },
      { status: 500 },
    );
  }
}
