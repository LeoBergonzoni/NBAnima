"use strict";
'use client';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerSelect = PlayerSelect;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Dialog = __importStar(require("@radix-ui/react-dialog"));
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const DEFAULT_DEBOUNCE_MS = 200;
const normalize = (input) => input.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const matchesQuery = (option, query) => {
    if (!query) {
        return true;
    }
    const tokens = [option.label, option.subtitle ?? '', ...(option.keywords ?? [])].filter(Boolean);
    return tokens.some((token) => normalize(token).includes(query));
};
function PlayerSelect({ value, onChange, options, sections, placeholder = 'Seleziona giocatore', disabled = false, searchPlaceholder = 'Cerca giocatore...', debounceMs = DEFAULT_DEBOUNCE_MS, onDialogOpenChange, }) {
    const [open, setOpen] = (0, react_1.useState)(false);
    const [query, setQuery] = (0, react_1.useState)('');
    const [debouncedQuery, setDebouncedQuery] = (0, react_1.useState)('');
    const searchRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!open) {
            return undefined;
        }
        const frame = requestAnimationFrame(() => {
            searchRef.current?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [open]);
    (0, react_1.useEffect)(() => {
        const timer = window.setTimeout(() => {
            setDebouncedQuery(query.trim() ? normalize(query.trim()) : '');
        }, debounceMs);
        return () => window.clearTimeout(timer);
    }, [query, debounceMs]);
    (0, react_1.useEffect)(() => {
        const html = document.documentElement;
        if (open) {
            html.classList.add('overflow-hidden');
            return () => {
                html.classList.remove('overflow-hidden');
            };
        }
        return undefined;
    }, [open]);
    (0, react_1.useEffect)(() => {
        if (!open) {
            setQuery('');
            setDebouncedQuery('');
        }
    }, [open]);
    const filteredOptions = (0, react_1.useMemo)(() => {
        const lower = options.filter((option) => matchesQuery(option, debouncedQuery));
        return lower;
    }, [options, debouncedQuery]);
    const filteredOptionIds = (0, react_1.useMemo)(() => new Set(filteredOptions.map((option) => option.id)), [filteredOptions]);
    const hasSections = Boolean(sections?.length);
    const sectionedOptions = (0, react_1.useMemo)(() => {
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
            .filter((section) => Boolean(section));
    }, [debouncedQuery, filteredOptionIds, hasSections, sections]);
    const selected = value ? options.find((option) => option.id === value) : undefined;
    const handleSelect = (id) => {
        onChange(id);
        handleOpenChange(false);
    };
    const handleOpenChange = (next) => {
        if (disabled) {
            return;
        }
        setOpen(next);
        onDialogOpenChange?.(next);
    };
    return ((0, jsx_runtime_1.jsxs)(Dialog.Root, { open: open, onOpenChange: handleOpenChange, children: [(0, jsx_runtime_1.jsx)(Dialog.Trigger, { asChild: true, children: (0, jsx_runtime_1.jsxs)("button", { type: "button", disabled: disabled, className: (0, clsx_1.default)('inline-flex w-full items-center justify-between rounded-xl border border-accent-gold bg-navy-900 px-3 py-2 text-left text-sm text-white shadow-card transition', 'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed disabled:opacity-60'), "aria-haspopup": "dialog", "aria-expanded": open, children: [(0, jsx_runtime_1.jsx)("span", { className: "truncate", children: selected ? selected.label : placeholder }), (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: (0, clsx_1.default)('ml-2 h-4 w-4 text-accent-gold transition-transform', open && 'rotate-180') })] }) }), (0, jsx_runtime_1.jsxs)(Dialog.Portal, { children: [(0, jsx_runtime_1.jsx)(Dialog.Overlay, { className: "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" }), (0, jsx_runtime_1.jsx)(Dialog.Content, { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-6 md:items-center md:pt-4", onPointerDownOutside: (event) => event.preventDefault(), children: (0, jsx_runtime_1.jsxs)("div", { className: "flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-navy-900 shadow-2xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between border-b border-white/10 px-4 py-3", children: [(0, jsx_runtime_1.jsx)(Dialog.Title, { className: "text-sm font-semibold text-white", children: "Seleziona giocatore" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setOpen(false), className: "rounded-full p-1 text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60", "aria-label": "Chiudi selettore", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "border-b border-white/10 px-4 py-3", children: (0, jsx_runtime_1.jsx)("input", { ref: searchRef, value: query, onChange: (event) => setQuery(event.target.value), autoComplete: "off", inputMode: "text", enterKeyHint: "search", placeholder: searchPlaceholder, className: "w-full rounded-md bg-navy-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none ring-1 ring-white/10 focus:ring-accent-gold/40" }) }), (0, jsx_runtime_1.jsx)("div", { className: "max-h-[60vh] overflow-y-auto px-1 py-3", children: options.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "px-3 py-2 text-sm text-slate-400", children: "Nessun giocatore disponibile" })) : filteredOptions.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "px-3 py-2 text-sm text-slate-400", children: "Nessun giocatore trovato" })) : ((sectionedOptions ?? [
                                        {
                                            label: '',
                                            options: filteredOptions,
                                        },
                                    ]).map((section) => ((0, jsx_runtime_1.jsxs)("div", { className: "py-1", children: [section.label ? ((0, jsx_runtime_1.jsx)("div", { className: "px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400", children: section.label })) : null, section.options.map((option) => {
                                                const isSelected = option.id === value;
                                                return ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleSelect(option.id), disabled: option.disabled, className: (0, clsx_1.default)('flex w-full items-center gap-2 rounded-lg px-3 py-0.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60', option.disabled
                                                        ? 'cursor-not-allowed text-slate-500 opacity-60'
                                                        : 'text-white hover:bg-accent-gold/20', isSelected && 'bg-accent-gold/30'), children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex min-h-9 flex-1 flex-col overflow-hidden", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-white", children: option.label }), option.subtitle ? ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-300", children: option.subtitle })) : null] }), isSelected ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "h-4 w-4 flex-shrink-0 text-accent-gold" })) : null] }, option.id));
                                            })] }, section.label || 'default-section')))) }), selected ? ((0, jsx_runtime_1.jsx)("div", { className: "border-t border-white/10 px-4 py-2 text-right", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleSelect(null), className: "text-xs text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60", children: "Rimuovi selezione" }) })) : null] }) })] })] }));
}
