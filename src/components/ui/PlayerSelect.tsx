'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';

type PlayerOption = {
  id: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
  keywords?: string[];
};

type PlayerSelectProps = {
  value?: string | null;
  onChange: (id: string | undefined) => void;
  options: PlayerOption[];
  placeholder?: string;
  disabled?: boolean;
  usePopover?: boolean;
  searchPlaceholder?: string;
  debounceMs?: number;
};

const DEFAULT_DEBOUNCE_MS = 300;

const normalize = (text: string) => {
  const lower = text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return lower;
};

const useBodyScrollLock = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return;
    }
    const element = document.documentElement;
    const previous = element.style.overflow;
    element.style.overflow = 'hidden';
    return () => {
      element.style.overflow = previous;
    };
  }, [enabled]);
};

const renderOptionLabel = (option: PlayerOption) => (
  <div className="flex min-h-9 flex-1 flex-col overflow-hidden">
    <span className="text-sm font-medium text-white">{option.label}</span>
    {option.subtitle ? (
      <span className="text-xs text-slate-300">{option.subtitle}</span>
    ) : null}
  </div>
);

const getDisplayLabel = (option: PlayerOption | undefined, placeholder: string) =>
  option?.label ?? placeholder;

export function PlayerSelect({
  value,
  onChange,
  options,
  placeholder = 'Scegli giocatore',
  disabled = false,
  usePopover = false,
  searchPlaceholder = 'Cerca giocatore...',
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: PlayerSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const popoverSearchRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, debounceMs]);

  const normalizedQuery = useMemo(
    () => (debouncedQuery ? normalize(debouncedQuery) : ''),
    [debouncedQuery],
  );

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) {
      return options;
    }
    return options.filter((option) => {
      const label = normalize(option.label);
      const subtitle = option.subtitle ? normalize(option.subtitle) : '';
      const keywords = option.keywords?.map((keyword) => normalize(keyword)) ?? [];
      return (
        label.includes(normalizedQuery) ||
        subtitle.includes(normalizedQuery) ||
        keywords.some((keyword) => keyword.includes(normalizedQuery))
      );
    });
  }, [options, normalizedQuery]);

  const currentValue = value ?? '';
  const selectedOption = useMemo(
    () => options.find((option) => option.id === currentValue),
    [options, currentValue],
  );

  const handleSelect = useCallback(
    (nextId: string) => {
      onChange(nextId || undefined);
      setOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (usePopover && open) {
      popoverSearchRef.current?.focus({ preventScroll: true });
    }
  }, [usePopover, open]);

  useBodyScrollLock(open && usePopover);

  const handleTriggerClick = () => {
    if (!disabled) {
      setOpen((previous) => !previous);
    }
  };

  const closePanel = () => setOpen(false);

  if (usePopover) {
    return (
      <div className="w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={handleTriggerClick}
          className={clsx(
            'inline-flex w-full items-center justify-between rounded-xl border border-accent-gold bg-navy-900 px-3 py-2 text-left text-sm text-white shadow-card transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed disabled:opacity-60',
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className="truncate">
            {getDisplayLabel(selectedOption, placeholder)}
          </span>
          <ChevronDown
            className={clsx(
              'ml-2 h-4 w-4 text-accent-gold transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {isClient && open
          ? createPortal(
              <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div
                  role="dialog"
                  aria-modal="true"
                  className="flex w-[92%] max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-navy-900 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <span className="text-sm font-semibold text-white">
                      Seleziona giocatore
                    </span>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-full p-1 text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60"
                      aria-label="Chiudi selettore"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="border-b border-white/10 px-4 py-3">
                    {/* ANDROID HOTFIX: campo di ricerca nel popover, evita blur su trigger */}
                    <input
                      ref={popoverSearchRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      autoComplete="off"
                      inputMode="text"
                      enterKeyHint="search"
                      className="w-full rounded-md bg-navy-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none ring-1 ring-white/10 focus:ring-accent-gold/40"
                      placeholder={searchPlaceholder}
                    />
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto px-2 py-3">
                    {filteredOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        Nessun giocatore trovato
                      </div>
                    ) : (
                      filteredOptions.map((option) => {
                        const selected = option.id === currentValue;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleSelect(option.id)}
                            disabled={option.disabled}
                            className={clsx(
                              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-accent-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60',
                              option.disabled
                                ? 'cursor-not-allowed opacity-60 text-slate-400'
                                : 'text-white',
                              selected && 'bg-accent-gold/30',
                            )}
                          >
                            {renderOptionLabel(option)}
                            {selected ? (
                              <Check className="h-4 w-4 flex-shrink-0 text-accent-gold" />
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2">
        {/* ANDROID HOTFIX: la ricerca vive fuori dal pannello Radix per evitare autoclose */}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          inputMode="text"
          enterKeyHint="search"
          className="w-full rounded-lg bg-navy-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none ring-1 ring-white/10 focus:ring-accent-gold/40"
          placeholder={searchPlaceholder}
        />
      </div>

      <Select.Root
        open={open}
        onOpenChange={setOpen}
        value={currentValue}
        onValueChange={(nextValue) => handleSelect(nextValue)}
        disabled={disabled}
      >
        <Select.Trigger
          disabled={disabled}
          aria-autocomplete="none"
          className={clsx(
            'inline-flex w-full items-center justify-between rounded-xl border border-accent-gold bg-navy-900 px-3 py-2 text-white shadow-card',
            'text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <Select.Value placeholder={placeholder}>
            {selectedOption ? selectedOption.label : null}
          </Select.Value>
          <Select.Icon className="ml-2 transition-transform data-[state=open]:rotate-180">
            <ChevronDown className="h-4 w-4 text-accent-gold" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            position="popper"
            sideOffset={0}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <div className="flex w-[90%] max-w-md flex-col overflow-hidden rounded-xl border border-white/10 bg-navy-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="text-sm font-semibold text-white">
                  Seleziona giocatore
                </span>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-full p-1 text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60"
                  aria-label="Chiudi selettore"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Select.Viewport className="max-h-[60vh] w-full overflow-auto px-2 py-3">
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-400">
                    Nessun giocatore trovato
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <Select.Item
                      key={option.id}
                      value={option.id}
                      disabled={Boolean(option.disabled)}
                      className={clsx(
                        'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-white data-[highlighted]:bg-accent-gold/20 data-[state=checked]:bg-accent-gold/30',
                        option.disabled &&
                          'cursor-not-allowed opacity-60 text-slate-400 data-[highlighted]:bg-accent-gold/10',
                      )}
                    >
                      <Select.ItemText asChild>
                        {renderOptionLabel(option)}
                      </Select.ItemText>
                      <Select.ItemIndicator className="ml-auto pl-2 text-accent-gold">
                        <Check className="h-4 w-4" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))
                )}
              </Select.Viewport>
            </div>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
