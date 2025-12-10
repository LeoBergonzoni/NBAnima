"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopGrid = exports.CollectionGrid = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const image_1 = __importDefault(require("next/image"));
const react_1 = require("react");
const actions_1 = require("../../app/[locale]/dashboard/(shop)/actions");
const CATEGORY_ORDER = ['Player', 'Celebration', 'Courtside', 'Iconic'];
const CONFERENCE_ORDER = [
    'Eastern Conference',
    'Western Conference',
    'Special',
];
const RARITY_FILTER_OPTIONS = ['Common', 'Rare', 'Legendary'];
const CATEGORY_FILTER_OPTIONS = ['Player', 'Celebration', 'Courtside', 'Iconic'];
const CONFERENCE_FILTER_OPTIONS = ['Eastern Conference', 'Western Conference'];
const orderIndex = (value, order) => {
    const index = order.indexOf(value);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};
const sortCards = (cards) => [...cards].sort((a, b) => {
    const categoryDiff = orderIndex(a.category, CATEGORY_ORDER) -
        orderIndex(b.category, CATEGORY_ORDER);
    if (categoryDiff !== 0) {
        return categoryDiff;
    }
    const conferenceDiff = orderIndex(a.conference, CONFERENCE_ORDER) -
        orderIndex(b.conference, CONFERENCE_ORDER);
    if (conferenceDiff !== 0) {
        return conferenceDiff;
    }
    return a.price - b.price;
});
const groupCardsByCategory = (cards) => {
    const sorted = sortCards(cards);
    const groups = new Map();
    for (const card of sorted) {
        const key = `${card.category}-${card.conference}`;
        const existing = groups.get(key);
        if (existing) {
            existing.cards.push(card);
            continue;
        }
        groups.set(key, {
            category: card.category,
            conference: card.conference,
            cards: [card],
        });
    }
    return Array.from(groups.values());
};
const groupCollectionCardsByCategory = (cards) => {
    const sorted = sortCards(cards);
    const groups = new Map();
    for (const card of sorted) {
        const key = card.category;
        const existing = groups.get(key);
        if (existing) {
            existing.cards.push(card);
            continue;
        }
        groups.set(key, {
            category: card.category,
            cards: [card],
        });
    }
    return Array.from(groups.values());
};
const CollectionGrid = ({ cards, dictionary, }) => {
    const [selectedCard, setSelectedCard] = (0, react_1.useState)(null);
    const [filters, setFilters] = (0, react_1.useState)({ rarity: '', category: '', conference: '' });
    const filteredCards = (0, react_1.useMemo)(() => {
        const normalize = (value) => value.toLowerCase();
        return cards.filter((card) => {
            const matchesRarity = filters.rarity
                ? normalize(card.rarity) === filters.rarity
                : true;
            const matchesCategory = filters.category
                ? card.category === filters.category
                : true;
            const matchesConference = filters.conference
                ? card.conference === filters.conference
                : true;
            return matchesRarity && matchesCategory && matchesConference;
        });
    }, [cards, filters]);
    const groupedCards = (0, react_1.useMemo)(() => groupCollectionCardsByCategory(filteredCards), [filteredCards]);
    const handleFilterChange = (key) => (event) => {
        setFilters((previous) => ({ ...previous, [key]: event.target.value }));
    };
    (0, react_1.useEffect)(() => {
        if (!selectedCard) {
            return;
        }
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setSelectedCard(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCard]);
    (0, react_1.useEffect)(() => {
        if (!selectedCard) {
            return;
        }
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [selectedCard]);
    if (cards.length === 0) {
        return null;
    }
    const closeModal = () => setSelectedCard(null);
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3 rounded-xl border border-white/10 bg-navy-900/40 p-3 sm:p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 sm:text-[11px]", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "collection-rarity-filter", children: dictionary.collection.filters.rarity }), (0, jsx_runtime_1.jsxs)("select", { id: "collection-rarity-filter", value: filters.rarity, onChange: handleFilterChange('rarity'), className: "min-w-[140px] rounded-lg border border-white/10 bg-navy-900/70 px-3 py-2 text-xs font-semibold text-white shadow-card transition focus:outline-none focus:ring-2 focus:ring-accent-gold/60", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: dictionary.collection.filters.all }), RARITY_FILTER_OPTIONS.map((option) => ((0, jsx_runtime_1.jsx)("option", { value: option.toLowerCase(), children: option }, option.toLowerCase())))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 sm:text-[11px]", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "collection-category-filter", children: dictionary.collection.filters.category }), (0, jsx_runtime_1.jsxs)("select", { id: "collection-category-filter", value: filters.category, onChange: handleFilterChange('category'), className: "min-w-[140px] rounded-lg border border-white/10 bg-navy-900/70 px-3 py-2 text-xs font-semibold text-white shadow-card transition focus:outline-none focus:ring-2 focus:ring-accent-gold/60", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: dictionary.collection.filters.all }), CATEGORY_FILTER_OPTIONS.map((option) => ((0, jsx_runtime_1.jsx)("option", { value: option, children: option }, option)))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 sm:text-[11px]", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "collection-conference-filter", children: dictionary.collection.filters.conference }), (0, jsx_runtime_1.jsxs)("select", { id: "collection-conference-filter", value: filters.conference, onChange: handleFilterChange('conference'), className: "min-w-[160px] rounded-lg border border-white/10 bg-navy-900/70 px-3 py-2 text-xs font-semibold text-white shadow-card transition focus:outline-none focus:ring-2 focus:ring-accent-gold/60", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: dictionary.collection.filters.all }), CONFERENCE_FILTER_OPTIONS.map((option) => ((0, jsx_runtime_1.jsx)("option", { value: option, children: option }, option)))] })] })] }), groupedCards.map((group) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap items-center gap-2", children: (0, jsx_runtime_1.jsx)("span", { className: "rounded-full border border-accent-gold/40 bg-accent-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-gold sm:text-[11px]", children: group.category }) }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-3 lg:gap-4", children: group.cards.map((card) => {
                                    const isMaxed = card.quantity >= 5;
                                    return ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: card.owned ? () => setSelectedCard(card) : undefined, disabled: !card.owned, className: (0, clsx_1.default)('group relative overflow-hidden rounded-xl border bg-navy-800/70 p-2 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 sm:p-3', isMaxed
                                            ? 'border-[#ffd700] shadow-[0_0_30px_rgba(255,215,0,0.55)] ring-2 ring-[#ffd700]/80 ring-offset-2 ring-offset-navy-900 hover:border-[#ffd700]'
                                            : card.owned
                                                ? 'border-accent-gold/20 hover:border-accent-gold/40'
                                                : 'border-white/10 opacity-90'), children: [(0, jsx_runtime_1.jsx)("div", { className: "pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20", style: { backgroundColor: card.accent_color ?? '#8ecae6' } }), (0, jsx_runtime_1.jsxs)("div", { className: "relative flex min-h-full flex-col gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-[7px] uppercase tracking-wide text-slate-400 sm:text-[8px]", children: [(0, jsx_runtime_1.jsx)("span", { children: card.rarity }), (0, jsx_runtime_1.jsxs)("span", { className: "rounded-full border border-white/10 bg-black/60 px-2 py-[2px] text-[10px] font-semibold text-white sm:text-[11px]", children: ["\u00D7", card.quantity] })] }), (0, jsx_runtime_1.jsxs)("div", { className: (0, clsx_1.default)('relative w-full overflow-hidden rounded-xl border bg-navy-900/80 p-1', isMaxed
                                                            ? 'border-[#ffd700] shadow-[0_0_24px_rgba(255,215,0,0.6)]'
                                                            : 'border-white/10'), style: { aspectRatio: '2 / 3' }, children: [(0, jsx_runtime_1.jsx)(image_1.default, { src: card.owned ? card.image_url : '/cards/back.png', alt: card.name, fill: true, className: (0, clsx_1.default)('object-contain transition', card.owned ? '' : 'saturate-50'), sizes: "(min-width: 1024px) 20vw, (min-width: 640px) 35vw, 80vw" }), !card.owned ? ((0, jsx_runtime_1.jsxs)("div", { className: "absolute inset-0 flex items-center justify-center bg-navy-900/60 text-slate-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Lock, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), (0, jsx_runtime_1.jsx)("span", { className: "sr-only", children: dictionary.collection.locked })] })) : null] }), (0, jsx_runtime_1.jsx)("h3", { className: "sr-only", children: card.name }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-auto flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-1", children: Array.from({ length: 5 }).map((_, index) => {
                                                                    const filled = card.quantity > index;
                                                                    return ((0, jsx_runtime_1.jsx)(lucide_react_1.Star, { className: (0, clsx_1.default)('h-3 w-3 sm:h-3.5 sm:w-3.5', filled
                                                                            ? 'text-accent-gold drop-shadow-[0_0_6px_rgba(255,215,0,0.45)]'
                                                                            : 'text-slate-600'), fill: filled ? 'currentColor' : 'none' }, index));
                                                                }) }), (0, jsx_runtime_1.jsxs)("span", { className: "text-[8px] font-semibold uppercase tracking-wide text-slate-300 sm:text-[9px]", children: [Math.min(card.quantity, 5), "/5"] })] })] })] }, card.id));
                                }) })] }, group.category)))] }), selectedCard ? ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black p-4", role: "dialog", "aria-modal": "true", onClick: closeModal, children: (0, jsx_runtime_1.jsxs)("div", { className: "relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-accent-gold/30 bg-navy-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.65)]", onClick: (event) => event.stopPropagation(), children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: closeModal, className: "absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10", "aria-label": dictionary.common.cancel, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-center", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: selectedCard.image_url, alt: selectedCard.name, width: 900, height: 1200, className: "h-[70vh] w-auto max-w-full object-contain" }) }), (0, jsx_runtime_1.jsx)("p", { className: "mt-4 text-center text-sm text-slate-200 sm:text-base", children: selectedCard.description }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 flex justify-center", children: (0, jsx_runtime_1.jsx)("a", { href: selectedCard.image_url, download: true, className: "inline-flex items-center rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 font-semibold text-navy-900 shadow-card transition hover:brightness-110", children: dictionary.collection.download }) })] }) })) : null] }));
};
exports.CollectionGrid = CollectionGrid;
const ShopGrid = ({ cards, balance, dictionary, locale, ownedCardCounts, onPurchaseSuccess, }) => {
    const [pendingCard, setPendingCard] = (0, react_1.useState)(null);
    const [errorMessage, setErrorMessage] = (0, react_1.useState)(null);
    const [toastMessage, setToastMessage] = (0, react_1.useState)(null);
    const [isPending, startTransition] = (0, react_1.useTransition)();
    const handleGuardContextMenu = (0, react_1.useCallback)((event) => {
        event.preventDefault();
    }, []);
    (0, react_1.useEffect)(() => {
        if (!pendingCard) {
            return;
        }
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setPendingCard(null);
                setErrorMessage(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pendingCard]);
    (0, react_1.useEffect)(() => {
        if (!toastMessage) {
            return;
        }
        const timer = setTimeout(() => setToastMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [toastMessage]);
    const localeTag = locale === 'it' ? 'it-IT' : 'en-US';
    const groupedCards = (0, react_1.useMemo)(() => groupCardsByCategory(cards), [cards]);
    const handleConfirmPurchase = () => {
        if (!pendingCard) {
            return;
        }
        startTransition(async () => {
            try {
                setErrorMessage(null);
                const result = await (0, actions_1.buyCardAction)({
                    cardId: pendingCard.id,
                    locale,
                });
                if (result.ok) {
                    setPendingCard(null);
                    setToastMessage(dictionary.dashboard.toasts.cardPurchased);
                    onPurchaseSuccess(pendingCard.price);
                    return;
                }
                const message = (() => {
                    switch (result.error) {
                        case 'INSUFFICIENT_FUNDS':
                            return dictionary.shop.insufficientPoints;
                        case 'ALREADY_OWNED':
                            return dictionary.shop.owned;
                        case 'CARD_NOT_FOUND':
                        case 'USER_CARDS_FAIL':
                        case 'LEDGER_OR_USER_UPDATE_FAIL':
                        case 'UNKNOWN':
                        default:
                            return dictionary.shop.errorGeneric;
                    }
                })();
                setErrorMessage(message);
            }
            catch (error) {
                console.error('[ShopGrid] purchase failed', error);
                setErrorMessage(dictionary.shop.errorGeneric);
            }
        });
    };
    const closeConfirm = () => {
        setPendingCard(null);
        setErrorMessage(null);
    };
    const formattedConfirmMessage = pendingCard
        ? dictionary.shop.confirmMessage.replace('{price}', pendingCard.price.toLocaleString(localeTag))
        : '';
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: groupedCards.map((group) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "rounded-full border border-accent-gold/40 bg-accent-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-gold sm:text-[11px]", children: group.category }), (0, jsx_runtime_1.jsx)("span", { className: "rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 sm:text-[11px]", children: group.conference })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-3 lg:gap-4", children: group.cards.map((card) => {
                                const quantity = Number(ownedCardCounts.get(card.id) ?? 0);
                                const affordable = balance >= card.price;
                                const canBuy = affordable;
                                const isLoadingCard = isPending && pendingCard?.id === card.id;
                                const priceLabel = ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Coins, { className: "h-4 w-4" }), card.price.toLocaleString(localeTag)] }));
                                return ((0, jsx_runtime_1.jsxs)("div", { className: "group relative h-full overflow-hidden rounded-xl border border-accent-gold/20 bg-navy-800/70 p-2 shadow-card transition hover:border-accent-gold/40 sm:p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-30", style: { backgroundColor: card.accent_color ?? '#8ecae6' } }), (0, jsx_runtime_1.jsxs)("div", { className: "relative flex min-h-full flex-col gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center text-[7px] uppercase tracking-wide text-slate-400 sm:text-[10px]", children: (0, jsx_runtime_1.jsx)("span", { children: card.rarity }) }), (0, jsx_runtime_1.jsxs)("div", { className: "relative h-20 w-full overflow-hidden rounded-lg border border-white/10 bg-navy-900 select-none sm:h-32", onContextMenu: handleGuardContextMenu, children: [(0, jsx_runtime_1.jsx)(image_1.default, { src: card.image_url, alt: card.name, fill: true, draggable: false, onContextMenu: handleGuardContextMenu, className: "pointer-events-none object-cover" }), (0, jsx_runtime_1.jsx)("div", { "aria-hidden": "true", onContextMenu: handleGuardContextMenu, className: "pointer-events-auto absolute inset-0 rounded-2xl bg-gradient-to-b from-navy-950/30 via-navy-950/10 to-navy-950/50 backdrop-blur-[1px]" })] }), (0, jsx_runtime_1.jsx)("h3", { className: "text-xs font-semibold text-white sm:text-sm", children: card.name }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => (canBuy ? setPendingCard(card) : undefined), disabled: !canBuy || isPending, className: (0, clsx_1.default)('mt-auto inline-flex w-full items-center justify-center gap-1 rounded-2xl border px-2 py-0.5 text-[8px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed sm:px-2.5 sm:py-1 sm:text-[10px]', !canBuy
                                                        ? 'border-white/10 bg-navy-900/60 text-slate-500'
                                                        : quantity > 0
                                                            ? 'border-accent-gold bg-accent-gold/25 text-accent-gold hover:bg-accent-gold/35'
                                                            : 'border-accent-gold bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30', isLoadingCard ? 'opacity-80' : ''), children: [isLoadingCard ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : null, priceLabel] })] })] }, card.id));
                            }) })] }, `${group.category}-${group.conference}`))) }), pendingCard ? ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black p-4", role: "dialog", "aria-modal": "true", onClick: closeConfirm, children: (0, jsx_runtime_1.jsxs)("div", { className: "relative w-full max-w-md rounded-2xl border border-accent-gold/30 bg-navy-900 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.65)]", onClick: (event) => event.stopPropagation(), children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: closeConfirm, className: "absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10", "aria-label": dictionary.common.cancel, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-white", children: dictionary.shop.confirmTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: formattedConfirmMessage }), errorMessage ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-red-400", children: errorMessage })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:justify-end", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleConfirmPurchase, disabled: isPending, className: "inline-flex items-center justify-center gap-2 rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-75", children: [isPending ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : null, dictionary.common.confirm] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: closeConfirm, className: "inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-accent-gold/40 hover:text-white", disabled: isPending, children: dictionary.common.cancel })] })] })] }) })) : null, toastMessage ? ((0, jsx_runtime_1.jsxs)("div", { className: "fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-card", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: toastMessage })] })) : null] }));
};
exports.ShopGrid = ShopGrid;
