"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingCardsClient = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const image_1 = __importDefault(require("next/image"));
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const actions_1 = require("../../app/[locale]/dashboard/(shop)/actions");
const trading_packs_1 = require("../../config/trading-packs");
const locale_provider_1 = require("../../components/providers/locale-provider");
const trading_cards_grids_1 = require("../../components/trading-cards/trading-cards-grids");
const trading_packs_grid_1 = require("../../components/trading-cards/trading-packs-grid");
const TradingCardsClient = ({ locale, balance, shopCards, ownedCardCounts, isAdmin, nextDailyPearlPackAvailableAt, }) => {
    const { dictionary } = (0, locale_provider_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [activeSection, setActiveSection] = (0, react_1.useState)('collection');
    const [currentBalance, setCurrentBalance] = (0, react_1.useState)(balance);
    const [openingPack, setOpeningPack] = (0, react_1.useState)(null);
    const [openingStage, setOpeningStage] = (0, react_1.useState)('sealed');
    const [openingCardIndex, setOpeningCardIndex] = (0, react_1.useState)(0);
    const [touchStartX, setTouchStartX] = (0, react_1.useState)(null);
    const [dailyAvailableAt, setDailyAvailableAt] = (0, react_1.useState)(nextDailyPearlPackAvailableAt);
    const [isClaimingDailyPack, setIsClaimingDailyPack] = (0, react_1.useState)(false);
    const [dailyError, setDailyError] = (0, react_1.useState)(null);
    const [now, setNow] = (0, react_1.useState)(() => Date.now());
    const ownedCardCountsMap = (0, react_1.useMemo)(() => new Map(Object.entries(ownedCardCounts ?? {})), [ownedCardCounts]);
    const collectionCards = (0, react_1.useMemo)(() => shopCards.map((card) => {
        const quantity = Number(ownedCardCountsMap.get(card.id) ?? 0);
        return { ...card, owned: quantity > 0, quantity };
    }), [shopCards, ownedCardCountsMap]);
    const numberFormatter = (0, react_1.useMemo)(() => new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-US'), [locale]);
    const formatMsToClock = (ms) => {
        if (ms <= 0) {
            return '00:00';
        }
        const totalMinutes = Math.max(Math.floor(ms / 1000 / 60), 0);
        const hours = Math.floor(totalMinutes / 60)
            .toString()
            .padStart(2, '0');
        const minutes = Math.floor(totalMinutes % 60)
            .toString()
            .padStart(2, '0');
        return `${hours}:${minutes}`;
    };
    const totalOwnedCards = (0, react_1.useMemo)(() => Object.values(ownedCardCounts ?? {}).reduce((sum, value) => sum + Number(value), 0), [ownedCardCounts]);
    const dailyRemainingMs = (0, react_1.useMemo)(() => (dailyAvailableAt ? new Date(dailyAvailableAt).getTime() - now : 0), [dailyAvailableAt, now]);
    const dailyCountdownLabel = formatMsToClock(dailyRemainingMs);
    const isDailyOnCooldown = dailyRemainingMs > 0;
    (0, react_1.useEffect)(() => {
        setCurrentBalance(balance);
    }, [balance]);
    (0, react_1.useEffect)(() => {
        setDailyAvailableAt(nextDailyPearlPackAvailableAt);
    }, [nextDailyPearlPackAvailableAt]);
    (0, react_1.useEffect)(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    (0, react_1.useEffect)(() => {
        if (!openingPack) {
            return;
        }
        setOpeningStage('sealed');
        setOpeningCardIndex(0);
        const timer = setTimeout(() => setOpeningStage('cards'), 1400);
        return () => clearTimeout(timer);
    }, [openingPack]);
    const handlePackOpened = (payload) => {
        setOpeningPack(payload);
        setCurrentBalance(payload.newBalance);
        setActiveSection('packs');
    };
    const handleCloseOpening = () => {
        setOpeningPack(null);
        setOpeningStage('sealed');
        setOpeningCardIndex(0);
        setTouchStartX(null);
        router.refresh();
    };
    const handleGoToCollection = () => {
        setActiveSection('collection');
        handleCloseOpening();
    };
    const handleNextCard = () => {
        if (!openingPack) {
            return;
        }
        setOpeningCardIndex((prev) => Math.min(prev + 1, openingPack.cards.length - 1));
    };
    const handlePrevCard = () => {
        if (!openingPack) {
            return;
        }
        setOpeningCardIndex((prev) => Math.max(prev - 1, 0));
    };
    const handleTouchStart = (event) => {
        setTouchStartX(event.touches[0]?.clientX ?? null);
    };
    const handleTouchEnd = (event) => {
        if (touchStartX === null) {
            return;
        }
        const deltaX = event.changedTouches[0]?.clientX - touchStartX;
        if (Math.abs(deltaX) < 40) {
            return;
        }
        if (deltaX < 0) {
            handleNextCard();
        }
        else {
            handlePrevCard();
        }
        setTouchStartX(null);
    };
    const handleClaimDailyPack = () => {
        if (isDailyOnCooldown || isClaimingDailyPack) {
            return;
        }
        setIsClaimingDailyPack(true);
        setDailyError(null);
        (0, actions_1.claimDailyPearlPackAction)({ locale })
            .then((result) => {
            if (result.ok) {
                setDailyAvailableAt(result.nextAvailableAt);
                handlePackOpened({
                    pack: trading_packs_1.PACK_DEFINITION_MAP.pearl,
                    cards: result.cards,
                    newBalance: result.newBalance,
                });
                return;
            }
            if (result.nextAvailableAt) {
                setDailyAvailableAt(result.nextAvailableAt);
            }
            if (result.error === 'DAILY_LIMIT') {
                setDailyError(dictionary.tradingCards.dailyPackCountdown.replace('{time}', formatMsToClock((result.nextAvailableAt ? new Date(result.nextAvailableAt).getTime() : now) - now)));
                return;
            }
            setDailyError(dictionary.tradingCards.dailyPackError);
        })
            .catch(() => {
            setDailyError(dictionary.tradingCards.dailyPackError);
        })
            .finally(() => {
            setIsClaimingDailyPack(false);
        });
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 pb-16 pt-1 sm:pt-5 lg:pb-10", children: [(0, jsx_runtime_1.jsx)("header", { className: "overflow-hidden rounded-2xl border border-accent-gold/50 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-850 px-4 pb-4 pt-0 shadow-card sm:px-5 sm:py-5", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center", children: (0, jsx_runtime_1.jsx)("div", { className: "relative h-56 w-56 sm:h-64 sm:w-64", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: "/NBAnimaTradingCards.png", alt: dictionary.tradingCards.heroImageAlt, fill: true, priority: true, className: "object-contain", sizes: "228px" }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-accent-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-gold sm:text-[11px]", children: dictionary.tradingCards.ctaLabel }), (0, jsx_runtime_1.jsx)(link_1.default, { href: `/${locale}/dashboard`, className: "hidden items-center rounded-full border border-accent-gold/60 bg-accent-gold/15 px-3 py-2 text-xs font-semibold text-accent-gold transition hover:bg-accent-gold/25 sm:inline-flex sm:text-sm", children: "Dashboard" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-semibold text-white sm:text-2xl", children: dictionary.tradingCards.pageTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300 sm:text-base", children: dictionary.tradingCards.pageSubtitle })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2 text-xs text-slate-200 sm:gap-3 sm:text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "inline-flex items-center gap-2 rounded-xl border border-accent-gold/40 bg-navy-900/60 px-3 py-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Coins, { className: "h-4 w-4 text-accent-gold sm:h-4 sm:w-4" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-[2px]", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[10px] uppercase tracking-wide text-slate-400 sm:text-[11px]", children: dictionary.dashboard.animaPoints }), (0, jsx_runtime_1.jsx)("span", { className: "text-base font-semibold text-white sm:text-lg", children: numberFormatter.format(currentBalance) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "inline-flex items-center gap-2 rounded-xl border border-accent-gold/40 bg-navy-900/60 px-3 py-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-4 w-4 text-accent-gold sm:h-4 sm:w-4" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-[2px]", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[10px] uppercase tracking-wide text-slate-400 sm:text-[11px]", children: dictionary.collection.title }), (0, jsx_runtime_1.jsx)("span", { className: "text-base font-semibold text-white sm:text-lg", children: numberFormatter.format(totalOwnedCards) })] })] })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleClaimDailyPack, disabled: isDailyOnCooldown || isClaimingDailyPack, className: (0, clsx_1.default)('group relative flex w-full items-center overflow-hidden rounded-[1.25rem] border p-3 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 sm:p-4', isDailyOnCooldown || isClaimingDailyPack
                            ? 'border-white/10 bg-navy-900/70 text-slate-300'
                            : 'border-accent-gold/60 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-850 text-white hover:border-accent-gold'), children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex items-center gap-3 sm:gap-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black/40 p-1.5 shadow-inner sm:h-16 sm:w-16", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: "/PackagePearl.png", alt: "Pearl Pack", fill: true, className: "object-contain", sizes: "64px" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[12px] uppercase tracking-wide text-accent-gold sm:text-xs", children: dictionary.tradingCards.dailyPackTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-[12px] text-slate-300 sm:text-[13px]", children: dictionary.tradingCards.dailyPackSubtitle })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-accent-gold", children: [isClaimingDailyPack ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-4 w-4" })), (0, jsx_runtime_1.jsx)("span", { children: isDailyOnCooldown
                                            ? dailyCountdownLabel
                                            : dictionary.tradingCards.dailyPackBadge })] })] }), dailyError ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-red-300", children: dailyError })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 rounded-[1.25rem] border border-white/10 bg-navy-900/60 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between", role: "tablist", "aria-label": dictionary.tradingCards.pageTitle, children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2 sm:gap-3", children: [
                                    { key: 'collection', label: dictionary.tradingCards.collectionTab },
                                    { key: 'packs', label: dictionary.tradingCards.packsTab },
                                    { key: 'shop', label: dictionary.tradingCards.shopTab },
                                ].map((option) => ((0, jsx_runtime_1.jsx)("button", { type: "button", role: "tab", onClick: () => setActiveSection(option.key), "aria-selected": activeSection === option.key, className: (0, clsx_1.default)('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 sm:px-4', activeSection === option.key
                                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                                        : 'border-white/10 bg-navy-800/70 text-slate-300 hover:border-accent-gold/30'), children: option.label }, option.key))) }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 sm:text-sm", children: dictionary.tradingCards.ctaDescription })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-[1.25rem] border border-white/10 bg-navy-900/70 p-4 shadow-card sm:p-6", children: [activeSection === 'collection' ? (collectionCards.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "rounded-2xl border border-white/10 bg-navy-900/50 p-6 text-sm text-slate-300", children: dictionary.collection.empty })) : ((0, jsx_runtime_1.jsx)(trading_cards_grids_1.CollectionGrid, { cards: collectionCards, dictionary: dictionary }))) : null, activeSection === 'shop' ? ((0, jsx_runtime_1.jsx)(trading_cards_grids_1.ShopGrid, { cards: shopCards, balance: currentBalance, dictionary: dictionary, locale: locale, ownedCardCounts: ownedCardCountsMap, onPurchaseSuccess: (spent) => {
                                    setCurrentBalance((prev) => Math.max(prev - spent, 0));
                                    router.refresh();
                                } })) : null, activeSection === 'packs' ? ((0, jsx_runtime_1.jsx)(trading_packs_grid_1.PacksGrid, { balance: currentBalance, dictionary: dictionary, locale: locale, isAdmin: isAdmin, onPackOpened: handlePackOpened })) : null] })] }), openingPack ? ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black p-3 sm:p-6", role: "dialog", "aria-modal": "true", onClick: handleCloseOpening, children: (0, jsx_runtime_1.jsxs)("div", { className: "relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-accent-gold/30 bg-black p-4 shadow-[0_20px_60px_rgba(0,0,0,0.65)] sm:max-w-4xl sm:p-6", onClick: (event) => event.stopPropagation(), children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleCloseOpening, className: "absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10", "aria-label": dictionary.common.cancel, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 sm:space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap items-center gap-2", children: (0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-2 rounded-full border border-accent-gold/40 bg-accent-gold/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-4 w-4" }), openingPack.pack.name] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "relative max-h-[82vh] rounded-3xl border border-white/10 bg-black p-3 sm:max-h-[85vh] sm:p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: (0, clsx_1.default)('absolute inset-0 flex items-center justify-center transition duration-1200', openingStage === 'sealed' ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-105'), children: (0, jsx_runtime_1.jsx)(image_1.default, { src: openingPack.pack.image, alt: openingPack.pack.name, width: 540, height: 360, className: "h-[44vh] w-auto max-w-full object-contain sm:h-[60vh]", priority: true }) }), (0, jsx_runtime_1.jsxs)("div", { className: (0, clsx_1.default)('relative flex flex-col items-center gap-4 px-3 py-4 transition duration-1200 sm:flex-row sm:gap-6 sm:px-6 sm:py-6', openingStage === 'cards'
                                                ? 'opacity-100 translate-y-0'
                                                : 'pointer-events-none translate-y-6 opacity-0'), onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd, children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handlePrevCard, disabled: openingCardIndex === 0, className: "hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-40 sm:inline-flex", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { className: "h-6 w-6" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "relative w-full flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black p-3 shadow-card sm:p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute left-3 top-3 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200", children: openingPack.cards[openingCardIndex]?.rarity }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-center", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: openingPack.cards[openingCardIndex]?.image_url ?? '/cards/back.png', alt: openingPack.cards[openingCardIndex]?.name ?? 'Card', width: 720, height: 1080, className: "h-[44vh] w-auto max-w-full object-contain sm:h-[60vh]", priority: true }) }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 space-y-1 text-center sm:text-left", children: (0, jsx_runtime_1.jsx)("h3", { className: "text-base font-semibold text-white sm:text-lg", children: openingPack.cards[openingCardIndex]?.name }) })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleNextCard, disabled: openingCardIndex === openingPack.cards.length - 1, className: "hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-40 sm:inline-flex", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-6 w-6" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-4 w-4 text-accent-gold" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.packs.swipeHint })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2", children: openingPack.cards.map((card, index) => ((0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('h-2 w-8 rounded-full transition', index === openingCardIndex
                                                    ? 'bg-accent-gold shadow-[0_0_10px_rgba(255,215,0,0.5)]'
                                                    : 'bg-white/15') }, card.id + index.toString()))) }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-semibold text-white", children: [openingCardIndex + 1, "/", openingPack.cards.length] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex min-h-[60px] items-center justify-center", children: openingCardIndex === openingPack.cards.length - 1 ? ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleGoToCollection, className: "inline-flex items-center justify-center gap-2 rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-3.5 py-2.5 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 sm:px-4 sm:py-2 sm:text-sm", children: dictionary.packs.toCollection })) : null })] })] }) })) : null] }));
};
exports.TradingCardsClient = TradingCardsClient;
