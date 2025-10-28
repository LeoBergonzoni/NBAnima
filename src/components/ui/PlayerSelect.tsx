import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

type PlayerOption = {
  value: string;
  label: string;
  meta?: {
    altNames?: string[];
    disabled?: boolean;
  };
};

type PlayerSelectProps = {
  value?: string;
  onChange: (val: string | undefined) => void;
  options: PlayerOption[];
  placeholder?: string;
  disabled?: boolean;
};

const DEBOUNCE_MS = 130;

export function PlayerSelect({
  value,
  onChange,
  options,
  placeholder = 'Scegli giocatore',
  disabled = false,
}: PlayerSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // debounce ricerca
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // apertura/chiusura menu
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery('');
    }
  }, []);

  // focus automatico sull'input
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // shortcut Cmd/Ctrl + K
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // filtro giocatori
  const filteredOptions = useMemo(() => {
    if (!debouncedQuery) return options;
    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(debouncedQuery);
      if (labelMatch) return true;
      const altNames = option.meta?.altNames;
      if (!altNames?.length) return false;
      return altNames.some((name) =>
        name.toLowerCase().includes(debouncedQuery),
      );
    });
  }, [options, debouncedQuery]);

  const handleValueChange = (nextValue: string) => {
    onChange(nextValue || undefined);
    setOpen(false);
  };

  const currentValue = value ?? '';

  const noResults = filteredOptions.length === 0;

  return (
    <div data-disabled-typeahead="true">
      <Select.Root
        open={open}
        onOpenChange={handleOpenChange}
        value={currentValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <Select.Trigger
          disabled={disabled}
          aria-autocomplete="none"
          className={clsx(
            'w-full rounded-xl border border-accent-gold bg-navy-900 px-3 py-2 text-white shadow-card inline-flex items-center justify-between',
            'text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <Select.Value placeholder={placeholder} />
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
            {/* barra di ricerca */}
            <div className="sticky top-0 z-10 bg-navy-900 p-2 border-b border-white/10">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Escape' && query) {
                    event.preventDefault();
                    setQuery('');
                    return;
                  }
                }}
                inputMode="search"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-md bg-navy-800 px-3 py-2 text-white placeholder:text-slate-400 outline-none ring-1 ring-white/10 focus:ring-accent-gold/40"
                placeholder="Cerca giocatore…"
              />
            </div>

            <Select.Viewport className="nb-radix-select-viewport max-h-[60vh] w-[var(--radix-select-trigger-width)] overflow-auto">
              {noResults ? (
                <div className="px-3 py-3 text-sm text-slate-400">
                  Nessun giocatore trovato
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    disabled={Boolean(option.meta?.disabled)}
                    className={clsx(
                      'nb-radix-select-item px-3 py-2 min-h-10 text-white cursor-pointer select-none data-[highlighted]:bg-accent-gold/20 data-[state=checked]:bg-accent-gold/30',
                      option.meta?.disabled &&
                        'opacity-60 cursor-not-allowed text-slate-400 data-[highlighted]:bg-accent-gold/10',
                    )}
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className="ml-auto pl-2 text-accent-gold">
                      <Check className="h-4 w-4" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))
              )}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}