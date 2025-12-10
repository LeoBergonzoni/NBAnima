"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardMobileNav = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const image_1 = __importDefault(require("next/image"));
const lucide_react_1 = require("lucide-react");
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const DashboardMobileNav = ({ locale }) => {
    const pathname = (0, navigation_1.usePathname)();
    const isCards = pathname?.startsWith(`/${locale}/dashboard/trading-cards`);
    const isUser = pathname?.startsWith(`/${locale}/user`);
    const isHome = pathname?.startsWith(`/${locale}/dashboard`) && !isCards;
    const items = [
        {
            key: 'cards',
            href: `/${locale}/dashboard/trading-cards`,
            label: locale === 'it' ? 'Carte' : 'Cards',
            active: isCards,
            render: (active) => ((0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[7px] border', active ? 'border-navy-900/70 bg-white/10' : 'border-white/15 bg-white/5'), "aria-hidden": true, children: (0, jsx_runtime_1.jsx)(image_1.default, { src: "/NBAnimaTradingCards.png", alt: "", fill: true, sizes: "24px", className: "object-cover", priority: false }) })),
        },
        {
            key: 'home',
            href: `/${locale}/dashboard`,
            label: 'Home',
            active: isHome,
            render: (active) => ((0, jsx_runtime_1.jsx)(lucide_react_1.Home, { className: (0, clsx_1.default)('h-5 w-5', active ? 'stroke-[2.5]' : 'stroke-[2]') })),
        },
        {
            key: 'user',
            href: `/${locale}/user`,
            label: locale === 'it' ? 'Profilo' : 'User',
            active: isUser,
            render: (active) => ((0, jsx_runtime_1.jsx)(lucide_react_1.UserRound, { className: (0, clsx_1.default)('h-5 w-5', active ? 'stroke-[2.5]' : 'stroke-[2]') })),
        },
    ];
    const navLabel = locale === 'it' ? 'Navigazione dashboard' : 'Dashboard navigation';
    return ((0, jsx_runtime_1.jsx)("nav", { className: "fixed inset-x-4 bottom-4 z-30 sm:hidden", "aria-label": navLabel, children: (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-3 items-center gap-2 rounded-2xl border border-white/10 bg-navy-900/90 px-2.5 py-2 shadow-card backdrop-blur-md", children: items.map(({ key, href, label, active, render }) => ((0, jsx_runtime_1.jsxs)(link_1.default, { href: href, "aria-label": label, "aria-current": active ? 'page' : undefined, className: (0, clsx_1.default)('group relative flex items-center justify-center rounded-xl transition', key === 'home' ? 'p-3.5' : 'p-3', active
                    ? 'bg-accent-gold text-navy-900 shadow-[0_10px_40px_rgba(212,175,55,0.28)]'
                    : 'text-slate-300 hover:text-white'), children: [render(active), (0, jsx_runtime_1.jsx)("span", { className: "sr-only", children: label })] }, key))) }) }));
};
exports.DashboardMobileNav = DashboardMobileNav;
