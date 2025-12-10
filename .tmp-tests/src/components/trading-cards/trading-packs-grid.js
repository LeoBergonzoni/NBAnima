"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PacksGrid = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const image_1 = __importDefault(require("next/image"));
const react_1 = require("react");
const actions_1 = require("../../app/[locale]/dashboard/(shop)/actions");
const trading_packs_1 = require("../../config/trading-packs");
const PacksGrid = ({ balance, dictionary, locale, isAdmin, onPackOpened, }) => {
    const [pendingPack, setPendingPack] = (0, react_1.useState)(null);
    const [errorMessage, setErrorMessage] = (0, react_1.useState)(null);
    const [toastMessage, setToastMessage] = (0, react_1.useState)(null);
    const [isPending, startTransition] = (0, react_1.useTransition)();
    const localeTag = locale === 'it' ? 'it-IT' : 'en-US';
    const cardCountLabel = locale === 'it' ? '4 carte' : '4 cards';
    (0, react_1.useEffect)(() => {
        if (!toastMessage) {
            return;
        }
        const timer = setTimeout(() => setToastMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [toastMessage]);
    const confirmMessage = pendingPack
        ? pendingPack.mode === 'admin'
            ? dictionary.packs.confirmAdminMessage.replace('{pack}', pendingPack.pack.name)
            : dictionary.packs.confirmMessage
                .replace('{pack}', pendingPack.pack.name)
                .replace('{price}', pendingPack.pack.price.toLocaleString(localeTag))
        : '';
    const handleConfirmPurchase = () => {
        if (!pendingPack) {
            return;
        }
        startTransition(async () => {
            try {
                setErrorMessage(null);
                const result = await (0, actions_1.buyPackAction)({
                    packId: pendingPack.pack.id,
                    locale,
                    adminOverride: pendingPack.mode === 'admin',
                });
                if (result.ok) {
                    onPackOpened({
                        pack: pendingPack.pack,
                        cards: result.cards,
                        newBalance: result.newBalance,
                    });
                    setPendingPack(null);
                    setToastMessage(dictionary.packs.toastOpened);
                    return;
                }
                const message = (() => {
                    switch (result.error) {
                        case 'INSUFFICIENT_FUNDS':
                            return dictionary.shop.insufficientPoints;
                        case 'NO_CARDS_AVAILABLE':
                        case 'NO_CARDS_FOR_RARITY':
                            return dictionary.packs.errorNoCards;
                        case 'NOT_ADMIN_FOR_OVERRIDE':
                            return dictionary.packs.onlyAdmin;
                        default:
                            return dictionary.packs.errorGeneric;
                    }
                })();
                setErrorMessage(message);
            }
            catch (error) {
                console.error('[PacksGrid] purchase failed', error);
                setErrorMessage(dictionary.packs.errorGeneric);
            }
        });
    };
    const closeConfirm = () => {
        setPendingPack(null);
        setErrorMessage(null);
    };
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-[1.25rem] border border-white/10 bg-navy-900/70 p-4 shadow-card sm:p-6", children: (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white sm:text-xl", children: dictionary.packs.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300 sm:text-base", children: dictionary.packs.description })] }) }) }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-3", children: trading_packs_1.PACK_DEFINITIONS.map((pack) => {
                            const affordable = balance >= pack.price;
                            const loading = isPending && pendingPack?.pack.id === pack.id;
                            const disableNormal = !affordable || loading;
                            const priceLabel = pack.price.toLocaleString(localeTag);
                            return ((0, jsx_runtime_1.jsxs)("div", { className: "group relative overflow-hidden rounded-2xl border border-accent-gold/25 bg-navy-900/70 p-4 shadow-card transition hover:border-accent-gold/50", children: [(0, jsx_runtime_1.jsx)("div", { className: "pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-20", style: { backgroundColor: pack.accent } }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[12px] uppercase tracking-wide text-slate-400", children: dictionary.packs.title }), (0, jsx_runtime_1.jsx)("h4", { className: "text-lg font-semibold text-white", children: pack.name })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-wide text-slate-200", children: dictionary.packs.oddsTitle })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-3", style: { aspectRatio: '4 / 3' }, children: [(0, jsx_runtime_1.jsx)(image_1.default, { src: pack.image, alt: pack.name, fill: true, className: "object-contain transition duration-300 group-hover:scale-105", sizes: "(min-width: 1024px) 25vw, (min-width: 768px) 35vw, 90vw" }), (0, jsx_runtime_1.jsx)("div", { className: "pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-navy-950/40 to-navy-950/70" }), (0, jsx_runtime_1.jsxs)("div", { className: "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-semibold text-white", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-4 w-4 text-accent-gold" }), cardCountLabel] })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: pack.description[locale] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { children: "Common" }), (0, jsx_runtime_1.jsxs)("span", { children: [Math.round(pack.odds.common * 100), "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { children: "Rare" }), (0, jsx_runtime_1.jsxs)("span", { children: [Math.round(pack.odds.rare * 100), "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { children: "Legendary" }), (0, jsx_runtime_1.jsxs)("span", { children: [Math.round(pack.odds.legendary * 100), "%"] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setPendingPack({ pack, mode: 'normal' }), disabled: disableNormal, className: (0, clsx_1.default)('inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed', disableNormal
                                                            ? 'border-white/10 bg-navy-900/60 text-slate-500'
                                                            : 'border-accent-gold bg-accent-gold/25 text-accent-gold hover:bg-accent-gold/35'), children: [loading ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Coins, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: priceLabel })] }), isAdmin ? ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setPendingPack({ pack, mode: 'admin' }), disabled: loading, className: (0, clsx_1.default)('inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 disabled:cursor-not-allowed', loading
                                                            ? 'border-white/10 bg-navy-900/60 text-slate-500'
                                                            : 'border-emerald-400 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'), children: [loading ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.ShieldCheck, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.packs.adminCta })] })) : null, !affordable ? ((0, jsx_runtime_1.jsx)("span", { className: "text-[12px] font-semibold uppercase tracking-wide text-slate-400", children: dictionary.shop.insufficientPoints })) : null] })] })] }, pack.id));
                        }) })] }), pendingPack ? ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4", role: "dialog", "aria-modal": "true", onClick: closeConfirm, children: (0, jsx_runtime_1.jsxs)("div", { className: "relative w-full max-w-md overflow-y-auto rounded-2xl border border-accent-gold/30 bg-black p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)]", onClick: (event) => event.stopPropagation(), children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: closeConfirm, className: "absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10", "aria-label": dictionary.common.cancel, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-white", children: dictionary.packs.confirmTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: confirmMessage }), errorMessage ? (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-red-400", children: errorMessage }) : null, (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:justify-end", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleConfirmPurchase, disabled: isPending, className: "inline-flex items-center justify-center gap-2 rounded-xl border border-accent-gold bg-gradient-to-r from-accent-gold to-accent-coral px-4 py-2 text-sm font-semibold text-navy-900 shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-75", children: [isPending ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : null, dictionary.packs.openCta] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: closeConfirm, className: "inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-accent-gold/40 hover:text-white", disabled: isPending, children: dictionary.common.cancel })] })] })] }) })) : null, toastMessage ? ((0, jsx_runtime_1.jsxs)("div", { className: "fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-card", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ShieldCheck, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: toastMessage })] })) : null] }));
};
exports.PacksGrid = PacksGrid;
