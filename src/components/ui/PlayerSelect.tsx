import { useMemo, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

import '@/components/ui/radix-select-hardening.css';

type PlayerOption = {
  id: string | number;
  first_name: string;
  last_name: string;
  position?: string | null;
  disabled?: boolean;
};

type PlayerSelectProps = {
  players: PlayerOption[];
  value?: string | number | null | undefined;
  onChange: (id: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptySearchLabel?: string;
  enableSearch?: boolean;
  filterByQuery?: (player: PlayerOption, query: string) => boolean;
  allowClear?: boolean;
  clearLabel?: string;
};

const DEFAULT_PLACEHOLDER = '-';
const DEFAULT_SEARCH_PLACEHOLDER = 'Search player...';
const DEFAULT_EMPTY_SEARCH = 'No players found';
const DEFAULT_CLEAR_LABEL = '↺ Clear selection';
const CLEAR_VALUE = '__CLEAR__';

export function PlayerSelect({
  players,
  value,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
  emptySearchLabel = DEFAULT_EMPTY_SEARCH,
  enableSearch = true,
  filterByQuery,
  allowClear = false,
  clearLabel = DEFAULT_CLEAR_LABEL,
}: PlayerSelectProps) {
  const [query, setQuery] = useState('');

  const safeValue = value == null ? '' : String(value);

  const cleanedPlayers = useMemo(() => {
    const map = new Map<string, PlayerOption>();
    players.forEach((player) => {
      if (!player) {
        return;
      }
      const rawId = player.id;
      if (rawId === null || rawId === undefined) {
        return;
      }
      const stringId = String(rawId).trim();
      if (!stringId) {
        return;
      }
      map.set(stringId, { ...player, id: stringId });
    });
    return Array.from(map.values());
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const trimmed = query.trim();
    if (!enableSearch || !trimmed) {
      return cleanedPlayers;
    }
    if (filterByQuery) {
      return cleanedPlayers.filter((player) => filterByQuery(player, trimmed));
    }
    const lower = trimmed.toLowerCase();
    return cleanedPlayers.filter((player) => {
      const base = `${player.first_name} ${player.last_name} ${player.position ?? ''}`;
      return base.toLowerCase().includes(lower);
    });
  }, [cleanedPlayers, enableSearch, filterByQuery, query]);

  const handleValueChange = (nextValue: string) => {
    if (nextValue === CLEAR_VALUE) {
      onChange(null);
      return;
    }
    onChange(nextValue === '' ? null : nextValue);
  };

  const showNoResults =
    enableSearch && query.trim().length > 0 && filteredPlayers.length === 0;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setQuery('');
    }
  };

  return (
    <Select.Root
      value={safeValue}
      onValueChange={handleValueChange}
      onOpenChange={handleOpenChange}
    >
      <Select.Trigger
        className={clsx(
          'w-full rounded-xl border border-accent-gold bg-navy-900 px-3 py-2 text-white shadow-card inline-flex items-center justify-between',
          'text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60',
        )}
        aria-label="Player"
      >
        <Select.Value placeholder={placeholder ?? DEFAULT_PLACEHOLDER} />
        <Select.Icon className="ml-2 transition-transform data-[state=open]:rotate-180">
          <ChevronDown className="h-4 w-4 text-accent-gold" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="nb-radix-select-content"
          position="popper"
          sideOffset={6}
        >
          <Select.ScrollUpButton className="flex items-center justify-center py-1 text-accent-gold">
            <ChevronDown className="h-4 w-4 rotate-180" />
          </Select.ScrollUpButton>

          {enableSearch ? (
            <div className="sticky top-0 z-10 border-b border-accent-gold/30 bg-[#0B1220] px-3 py-2">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-accent-gold/40 bg-navy-900 px-2 py-1 text-sm text-white placeholder-slate-400 focus:border-accent-gold focus:outline-none"
                autoComplete="off"
              />
            </div>
          ) : null}

          <Select.Viewport className="nb-radix-select-viewport max-h-72 w-[var(--radix-select-trigger-width)] overflow-auto">
            {allowClear ? (
              <Select.Item
                value={CLEAR_VALUE}
                className={clsx(
                  'nb-radix-select-item relative cursor-pointer select-none py-2 pl-3 pr-8 text-sm text-white/70',
                  'data-[highlighted]:text-white data-[highlighted]:bg-accent-gold/10',
                )}
              >
                <Select.ItemText>{clearLabel}</Select.ItemText>
              </Select.Item>
            ) : null}

            {showNoResults ? (
              <div className="px-3 py-2 text-sm italic text-slate-400">
                {emptySearchLabel}
              </div>
            ) : (
              filteredPlayers.map((player) => {
                const valueId = String(player.id);
                const label = `${player.first_name} ${player.last_name}${
                  player.position ? ` (${player.position})` : ''
                }`;
                return (
                  <Select.Item
                    key={valueId}
                    value={valueId}
                    disabled={player.disabled}
                    className={clsx(
                      'nb-radix-select-item relative select-none py-2 pl-3 pr-8 text-sm text-white',
                      'data-[highlighted]:cursor-pointer data-[highlighted]:bg-accent-gold/20 data-[highlighted]:text-accent-gold',
                      'data-[state=checked]:font-semibold',
                      player.disabled &&
                        'cursor-not-allowed text-slate-500 opacity-60 data-[highlighted]:bg-accent-gold/10 data-[highlighted]:text-slate-500',
                    )}
                  >
                    <Select.ItemText>{label}</Select.ItemText>
                    <Select.ItemIndicator className="absolute inset-y-0 right-2 flex items-center text-accent-gold">
                      <Check className="h-4 w-4" />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })
            )}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex items-center justify-center py-1 text-accent-gold">
            <ChevronDown className="h-4 w-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export type { PlayerOption };
