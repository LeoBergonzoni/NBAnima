"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TileFlipGamePage;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const TileFlipGame_1 = require("../../../../components/TileFlipGame");
const constants_1 = require("../../../../lib/constants");
const dictionaries_1 = require("../../../../locales/dictionaries");
async function TileFlipGamePage({ params, }) {
    const { locale: rawLocale } = await params;
    const locale = constants_1.SUPPORTED_LOCALES.includes(rawLocale)
        ? rawLocale
        : undefined;
    if (!locale) {
        (0, navigation_1.notFound)();
    }
    const dictionary = await (0, dictionaries_1.getDictionary)(locale);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-navy-900/70 p-4 md:p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-widest text-accent-gold/70", children: dictionary.tileGame.rewardPointsLabel }), (0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold text-white", children: dictionary.tileGame.sectionTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: dictionary.tileGame.sectionDescription })] }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}/dashboard`, className: "inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-accent-gold/50", children: ["\u2190 ", dictionary.dashboard.playTab] })] }), (0, jsx_runtime_1.jsx)(TileFlipGame_1.TileFlipGameNBAnima, {})] }));
}
