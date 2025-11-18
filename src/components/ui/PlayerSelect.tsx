'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { Check, ChevronDown, X } from 'lucide-react';

export type PlayerOption = {
  id: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
  keywords?: string[];
};

export type PlayerOptionSection = {
  label: string;
  options: PlayerOption[];
};

type PlayerSelectProps = {
  value?: string | null;
  onChange: (id: string | null) => void;
  options: PlayerOption[];
  sections?: PlayerOptionSection[];
  placeholder?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  debounceMs?: number;
};

const DEFAULT_DEBOUNCE_MS = 200;

const normalize = (input: string) =>
  input.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const matchesQuery = (option: PlayerOption, query: string) => {
  if (!query) {
    return true;
  }
  const tokens = [option.label, option.subtitle ?? '', ...(option.keywords ?? [])].filter(Boolean);
  return tokens.some((token) => normalize(token).includes(query));
};

export function PlayerSelect({
  value,
  onChange,
  options,
  sections,
  placeholder = 'Seleziona giocatore',
  disabled = false,
  searchPlaceholder = 'Cerca giocatore...',
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: PlayerSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim() ? normalize(query.trim()) : '');
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, debounceMs]);

  useEffect(() => {
    const html = document.documentElement;
    if (open) {
      html.classList.add('overflow-hidden');
      return () => {
        html.classList.remove('overflow-hidden');
      };
    }
    return undefined;
  }, [open]);

  const filteredOptions = useMemo(() => {
    const lower = options.filter((option) => matchesQuery(option, debouncedQuery));
    return lower;
  }, [options, debouncedQuery]);

  const filteredOptionIds = useMemo(
    () => new Set(filteredOptions.map((option) => option.id)),
    [filteredOptions],
  );

  const hasSections = Boolean(sections?.length);

  const sectionedOptions = useMemo(() => {
    if (!hasSections || !sections) {
      return null;
    }
    return sections
      .map((section) => {
        const filtered = section.options.filter((option) => filteredOptionIds.has(option.id));
        const optionsToRender = debouncedQuery ? filtered : section.options;
        if (debouncedQuery && optionsToRender.length === 0) {
          return null;
        }
        return {
          label: section.label,
          options: optionsToRender,
        };
      })
      .filter((section): section is PlayerOptionSection => Boolean(section));
  }, [debouncedQuery, filteredOptionIds, hasSections, sections]);

  const selected = value ? options.find((option) => option.id === value) : undefined;

  const handleSelect = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (disabled) {
      return;
    }
    setOpen(next);
    if (!next) {
      setQuery('');
      setDebouncedQuery('');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={clsx(
            'inline-flex w-full items-center justify-between rounded-xl border border-accent-gold bg-navy-900 px-3 py-2 text-left text-sm text-white shadow-card transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed disabled:opacity-60',
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown
            className={clsx(
              'ml-2 h-4 w-4 text-accent-gold transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-6 md:items-center md:pt-4"
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-navy-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-white">Seleziona giocatore</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60"
                aria-label="Chiudi selettore"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-white/10 px-4 py-3">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
                inputMode="text"
                enterKeyHint="search"
                placeholder={searchPlaceholder}
                className="w-full rounded-md bg-navy-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none ring-1 ring-white/10 focus:ring-accent-gold/40"
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-1 py-3">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-400">
                  Nessun giocatore disponibile
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-400">
                  Nessun giocatore trovato
                </div>
              ) : (
                (sectionedOptions ?? [
                  {
                    label: '',
                    options: filteredOptions,
                  },
                ]).map((section) => (
                  <div key={section.label || 'default-section'} className="py-1">
                    {section.label ? (
                      <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {section.label}
                      </div>
                    ) : null}
                    {section.options.map((option) => {
                      const isSelected = option.id === value;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleSelect(option.id)}
                          disabled={option.disabled}
                          className={clsx(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-0.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60',
                            option.disabled
                              ? 'cursor-not-allowed text-slate-500 opacity-60'
                              : 'text-white hover:bg-accent-gold/20',
                            isSelected && 'bg-accent-gold/30',
                          )}
                        >
                          <div className="flex min-h-9 flex-1 flex-col overflow-hidden">
                            <span className="text-sm font-medium text-white">{option.label}</span>
                            {option.subtitle ? (
                              <span className="text-xs text-slate-300">{option.subtitle}</span>
                            ) : null}
                          </div>
                          {isSelected ? (
                            <Check className="h-4 w-4 flex-shrink-0 text-accent-gold" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {selected ? (
              <div className="border-t border-white/10 px-4 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className="text-xs text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60"
                >
                  Rimuovi selezione
                </button>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
