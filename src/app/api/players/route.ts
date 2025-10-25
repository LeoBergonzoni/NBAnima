import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { listTeamPlayers } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const querySchema = z.object({
  teamId: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value))
    .refine((value) => value > 0, 'teamId must be a positive number'),
  season: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : new Date().getFullYear()))
    .refine(
      (value) => Number.isInteger(value) && value >= 2000 && value <= 2100,
      'season must be a valid year',
    ),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = querySchema.parse({
      teamId: searchParams.get('teamId'),
      season: searchParams.get('season'),
    });

    const players = await listTeamPlayers(parsed.teamId, parsed.season);
    return NextResponse.json(players);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      );
    }

    console.error('[api/players]', error);
    return NextResponse.json(
      { error: 'Failed to load players' },
      { status: 500 },
    );
  }
}
