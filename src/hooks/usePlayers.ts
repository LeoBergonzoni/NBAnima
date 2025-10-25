'use client';

import { useEffect, useMemo, useState } from 'react';

import { getPlayersByTeam } from '@/lib/rosters';

interface PlayerSummary {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string | null;
  teamId: string;
}

interface UsePlayersParams {
  teamId?: string | number;
  teamName?: string;
  triCode?: string | null;
  season?: number;
}

const toNumericId = (value?: string | number): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const usePlayers = ({ teamId, teamName, triCode, season }: UsePlayersParams) => {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const numericId = useMemo(() => toNumericId(teamId), [teamId]);
  const key = useMemo(
    () => `${teamName ?? ''}|${triCode ?? ''}|${numericId ?? ''}|${season ?? ''}`,
    [teamName, triCode, numericId, season],
  );

  const hasIdentifier = Boolean(teamName || triCode || numericId);

  useEffect(() => {
    if (hasIdentifier) {
      return;
    }
    setPlayers([]);
    setIsLoading(false);
    setError(null);
  }, [hasIdentifier]);

  useEffect(() => {
    if (!hasIdentifier) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getPlayersByTeam({
      teamName,
      triCode: triCode ?? undefined,
      teamId: numericId,
    })
      .then((list) => {
        if (!active) return;
        const mapped = list.map((player, index) => {
          const [first, ...rest] = player.name.trim().split(/\s+/);
          const lastName = rest.join(' ');
          return {
            id: `${numericId ?? triCode ?? teamName ?? 'team'}-${index}-${player.name}`,
            fullName: player.name,
            firstName: first ?? player.name,
            lastName: lastName || '',
            position: player.position || null,
            teamId: String(numericId ?? teamName ?? triCode ?? ''),
          } satisfies PlayerSummary;
        });
        setPlayers(mapped);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error('Failed to load players'));
        setPlayers([]);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hasIdentifier]);

  return { players, isLoading, error };
};
