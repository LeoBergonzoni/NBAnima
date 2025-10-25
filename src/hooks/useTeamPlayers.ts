'use client';

import { useEffect, useMemo, useState } from 'react';

import { getPlayersByTeam, type Player } from '@/lib/rosters';

interface HookInput {
  teamName?: string;
  triCode?: string | null;
  teamId?: string | number;
}

interface PlayerOption {
  label: string;
  value: string;
  meta: Player;
  teamId: string;
}

export function useTeamPlayers(input: HookInput) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [options, setOptions] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericId = useMemo(() => {
    if (typeof input.teamId === 'number') {
      return Number.isFinite(input.teamId) ? input.teamId : undefined;
    }
    if (typeof input.teamId === 'string') {
      const parsed = Number.parseInt(input.teamId, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }, [input.teamId]);

  const hasIdentifier = Boolean(input.teamName || input.triCode || numericId);

  const enqueueStateUpdate = (cb: () => void) => {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(cb);
    } else {
      Promise.resolve().then(cb);
    }
  };

  useEffect(() => {
    if (hasIdentifier) {
      return;
    }
    enqueueStateUpdate(() => {
      setPlayers([]);
      setOptions([]);
      setLoading(false);
      setError(null);
    });
  }, [hasIdentifier]);

  useEffect(() => {
    if (!hasIdentifier) {
      return;
    }

    let active = true;
    enqueueStateUpdate(() => {
      setLoading(true);
      setError(null);
    });

    getPlayersByTeam({
      teamName: input.teamName,
      triCode: input.triCode ?? undefined,
      teamId: numericId,
    })
      .then((list) => {
        if (!active) return;
        setPlayers(list);
        const mapped = list.map((player, index) => {
          const value = `${numericId ?? input.triCode ?? input.teamName ?? 'team'}-${index}-${player.name}`;
          return {
            label: player.name,
            value,
            meta: player,
            teamId: String(input.teamId ?? input.teamName ?? input.triCode ?? ''),
          } satisfies PlayerOption;
        });
        setOptions(mapped);
      })
      .catch((err) => {
        if (!active) return;
        setPlayers([]);
        setOptions([]);
        setError(err instanceof Error ? err.message : 'Failed to load players');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hasIdentifier, input.teamName, input.triCode, input.teamId, numericId]);

  return { players, options, loading, error };
}
