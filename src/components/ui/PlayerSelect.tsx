import { useMemo, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

type PlayerOption = {
  id: string | number;
  first_name: string;
  last_name: string;
  position?: string | null;
  disabled?: boolean;
};

type PlayerSelectProps = {
  players: PlayerOption[];
  value?: string | number | null;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptySearchLabel?: string;
  enableSearch?: boolean;
  filterByQuery?: (player: PlayerOption, query: string) => boolean;
};

const DEFAULT_PLACEHOLDER = '—';
const DEFAULT_SEARCH_PLACEHOLDER = 'Search player...';
const DEFAULT_EMPTY_SEARCH = 'No players found';

export function PlayerSelect({
  players,
  value,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
  emptySearchLabel = DEFAULT_EMPTY_SEARCH,
  enableSearch = true,
  filterByQuery,
}: PlayerSelectProps) {
  const [query, setQuery] = useState('');

  const normalizedValue =
    value === undefined || value === null ? '' : String(value);

  const filteredPlayers = useMemo(() => {
    const trimmed = query.trim();
    if (!enableSearch || !trimmed) {
      return players;
    }
    if (filterByQuery) {
      return players.filter((player) => filterByQuery(player, trimmed));
    }
    const lower = trimmed.toLowerCase();
    return players.filter((player) => {
      const base = `${player.first_name} ${player.last_name} ${
        player.position ?? ''
      }`;
      return base.toLowerCase().includes(lower);
    });
  }, [enableSearch, filterByQuery, players, query]);

  const handleValueChange = (nextValue: string) => {
    onChange(nextValue);
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
      value={normalizedValue}
      onValueChange={handleValueChange}
      onOpenChange={handleOpenChange}
    >
      <Select.Trigger
        className={clsx(
          'inline-flex w-full items-center justify-between rounded-xl border border-accent-gold bg-navy-900 px-3 py-2 text-left text-sm text-white shadow-card transition',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60',
        )}
        aria-label="Player"
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="ml-2 transition-transform data-[state=open]:rotate-180">
          <ChevronDown className="h-4 w-4 text-accent-gold" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="z-[1000] rounded-xl border border-accent-gold bg-[#0B1220] shadow-xl"
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

          <Select.Viewport className="max-h-72 w-[var(--radix-select-trigger-width)] overflow-auto">
            <Select.Item
              value=""
              className={clsx(
                'relative cursor-pointer select-none py-2 pl-3 pr-8 text-sm text-white',
                'data-[highlighted]:bg-accent-gold/20 data-[highlighted]:text-accent-gold',
                'data-[state=checked]:font-semibold',
              )}
            >
              <Select.ItemText>{placeholder}</Select.ItemText>
              <Select.ItemIndicator className="absolute inset-y-0 right-2 flex items-center text-accent-gold">
                <Check className="h-4 w-4" />
              </Select.ItemIndicator>
            </Select.Item>

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
                      'relative select-none py-2 pl-3 pr-8 text-sm text-white',
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
