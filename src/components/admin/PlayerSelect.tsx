'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { PlayerSelect as BasePlayerSelect } from '@/components/ui/PlayerSelect';
import { createBrowserSupabase } from '@/lib/supabase-browser';

type SourceTag = 'supabase' | 'roster';

type BaseOption = {
  value: string;
  label: string;
  meta: {
    altNames: string[];
    source: SourceTag;
    providerPlayerId?: string;
    teamAbbr?: string | null;
    firstName?: string;
    lastName?: string;
    position?: string | null;
    supabaseId?: string;
  };
};

type SupabasePlayerRow = {
  id: string;
  provider: string | null;
  provider_player_id: string | null;
  team_id: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  team: { abbr: string | null } | null;
};

export type PlayerSelectResult = {
  id: string;
  label: string;
  source: SourceTag;
  providerPlayerId?: string;
  teamAbbr?: string | null;
  firstName?: string;
  lastName?: string;
  position?: string | null;
  supabaseId?: string;
};

export type PlayerSelectProps = {
  value?: string;
  onChange: (value: PlayerSelectResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

let cachedOptions: BaseOption[] | null = null;
let cachedLookup: Map<string, BaseOption> | null = null;
let loadPromise: Promise<BaseOption[]> | null = null;

const buildSupabaseOptions = (rows: SupabasePlayerRow[]): [BaseOption[], Map<string, BaseOption>] => {
  const options: BaseOption[] = [];
  const lookup = new Map<string, BaseOption>();

  rows.forEach((row) => {
    const firstName = row.first_name?.trim() ?? '';
    const lastName = row.last_name?.trim() ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || row.provider_player_id || row.id;
    const teamAbbr = row.team?.abbr?.toUpperCase() ?? null;
    const label = teamAbbr ? `${fullName} — ${teamAbbr}` : fullName;
    const option: BaseOption = {
      value: row.id,
      label,
      meta: {
        altNames: [
          fullName,
          firstName,
          lastName,
          row.provider_player_id ?? '',
          teamAbbr ?? '',
        ].filter(Boolean),
        source: 'supabase',
        providerPlayerId: row.provider_player_id ?? undefined,
        teamAbbr,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        position: row.position ?? null,
        supabaseId: row.id,
      },
    };

    options.push(option);
    lookup.set(option.value, option);
    if (row.provider_player_id && !lookup.has(row.provider_player_id)) {
      lookup.set(row.provider_player_id, option);
    }
  });

  return [options, lookup];
};

const loadPlayerOptions = async (): Promise<BaseOption[]> => {
  if (cachedOptions) {
    return cachedOptions;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const supabase = createBrowserSupabase();
        const { data, error } = await supabase
          .from('player')
          .select(
            'id, provider, provider_player_id, team_id, first_name, last_name, position, active, team:team_id (abbr)',
          )
          .eq('provider', 'espn')
          .eq('active', true)
          .limit(2000);

        if (error) {
          console.error('[AdminPlayerSelect] Failed to load Supabase players', error);
        }

        const supabaseRows = (data ?? []) as SupabasePlayerRow[];
        const [supabaseOptions, lookup] = buildSupabaseOptions(supabaseRows);

        const combined = [...supabaseOptions].sort((a, b) => a.label.localeCompare(b.label));

        cachedLookup = lookup;
        cachedOptions = combined;
        return combined;
      } catch (error) {
        loadPromise = null;
        throw error;
      }
    })();
  }

  try {
    cachedOptions = await loadPromise;
  } catch (error) {
    console.error('[AdminPlayerSelect] Failed to load player options', error);
    cachedOptions = [];
  } finally {
    loadPromise = null;
  }

  if (!cachedLookup) {
    cachedLookup = new Map(cachedOptions.map((option) => [option.value, option]));
  }

  return cachedOptions;
};

const resolveOption = (value: string | undefined, options: BaseOption[]): BaseOption | undefined => {
  if (!value) {
    return undefined;
  }
  const lookup = cachedLookup;
  if (lookup && lookup.has(value)) {
    return lookup.get(value);
  }
  return options.find((option) => option.value === value);
};

export const getCachedPlayerSelection = (id: string): PlayerSelectResult | null => {
  if (!id || !cachedLookup?.has(id)) {
    return null;
  }
  const option = cachedLookup.get(id);
  if (!option) {
    return null;
  }
  return {
    id: option.value,
    label: option.label,
    source: option.meta.source,
    providerPlayerId: option.meta.providerPlayerId,
    teamAbbr: option.meta.teamAbbr,
    firstName: option.meta.firstName,
    lastName: option.meta.lastName,
    position: option.meta.position ?? null,
    supabaseId: option.meta.supabaseId,
  };
};

export function PlayerSelect({
  value,
  onChange,
  placeholder = 'Seleziona giocatore',
  disabled = false,
}: PlayerSelectProps) {
  const [options, setOptions] = useState<BaseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadPlayerOptions()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setOptions(result);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[AdminPlayerSelect] options load failed', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback(
    (nextValue: string | null) => {
      if (!nextValue) {
        onChange(null);
        return;
      }
      const option = resolveOption(nextValue, options);
      if (!option) {
        onChange({
          id: nextValue,
          label: nextValue,
          source: 'supabase',
        });
        return;
      }
      onChange({
        id: option.value,
        label: option.label,
        source: option.meta.source,
        providerPlayerId: option.meta.providerPlayerId,
        teamAbbr: option.meta.teamAbbr,
        firstName: option.meta.firstName,
        lastName: option.meta.lastName,
        position: option.meta.position ?? null,
        supabaseId: option.meta.supabaseId,
      });
    },
    [onChange, options],
  );

  const selectOptions = useMemo(
    () =>
      options.map((option) => {
        const subtitleTokens = [
          option.meta.teamAbbr ?? undefined,
          option.meta.position ?? undefined,
          option.meta.source === 'roster' ? 'Roster' : 'Supabase',
        ].filter(Boolean);
        return {
          id: option.value,
          label: option.label,
          subtitle: subtitleTokens.join(' • '),
          disabled: false,
          keywords: option.meta.altNames,
        };
      }),
    [options],
  );

  const resolvedValue = useMemo(() => value ?? '', [value]);

  return (
    <BasePlayerSelect
      value={resolvedValue || undefined}
      onChange={handleChange}
      options={selectOptions}
      placeholder={isLoading ? 'Caricamento…' : placeholder}
      disabled={disabled || isLoading}
      debounceMs={200}
    />
  );
}
