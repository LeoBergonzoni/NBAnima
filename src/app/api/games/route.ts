import { NextResponse, type NextRequest } from 'next/server';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/constants';
import { getGameProvider } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const isSupportedLocale = (locale?: string | null): locale is Locale =>
  Boolean(locale && SUPPORTED_LOCALES.includes(locale as Locale));

export async function GET(request: NextRequest) {
  const provider = getGameProvider();
  const { searchParams } = request.nextUrl;
  const localeParam = searchParams.get('locale');
  const locale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const timezone = searchParams.get('timezone') ?? undefined;

  try {
    const games = await provider.listNextNightGames({
      locale,
      timezone,
    });

    return NextResponse.json(
      games.map((game) => ({
        id: game.id,
        startsAt: game.startsAt,
        status: game.status,
        arena: game.arena,
        homeTeam: {
          id: game.homeTeam.id,
          name: game.homeTeam.name,
          city: game.homeTeam.city,
          logo: game.homeTeam.logo,
        },
        awayTeam: {
          id: game.awayTeam.id,
          name: game.awayTeam.name,
          city: game.awayTeam.city,
          logo: game.awayTeam.logo,
        },
      })),
    );
  } catch (error) {
    console.error('[api/games]', error);
    return NextResponse.json(
      { error: 'Failed to load games' },
      { status: 500 },
    );
  }
}
