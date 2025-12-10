"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingShowcase = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const framer_motion_1 = require("framer-motion");
const image_1 = __importDefault(require("next/image"));
const OnboardingShowcase = ({ cards }) => {
    const variants = {
        hidden: { opacity: 0, y: 24 },
        visible: (index) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: index * 0.12,
                duration: 0.5,
                ease: 'easeOut',
            },
        }),
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "flex gap-6 overflow-x-auto pb-8 pr-2 [scrollbar-color:rgba(212,175,55,0.6)_transparent]", children: cards.map((card, index) => ((0, jsx_runtime_1.jsxs)(framer_motion_1.motion.article, { className: "group relative min-w-[260px] max-w-sm flex-1 overflow-hidden rounded-[1.75rem] border border-accent-gold/40 bg-gradient-to-br from-navy-900/80 via-navy-800/70 to-navy-900/80 p-6 shadow-card backdrop-blur transition-transform duration-300 hover:scale-[1.02]", variants: variants, initial: "hidden", whileInView: "visible", viewport: { once: true, amount: 0.2 }, custom: index, children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 opacity-0 transition group-hover:opacity-20", children: (0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-gradient-to-br from-accent-gold/20 via-transparent to-accent-coral/20" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "relative flex h-full flex-col gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: card.title }), (0, jsx_runtime_1.jsx)(image_1.default, { src: card.image, alt: card.title, width: 144, height: 144, className: "size-36 rounded-xl border border-white/10 bg-navy-950 object-cover" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-200", children: card.description })] })] }, `${card.title}-${index}`))) }));
};
exports.OnboardingShowcase = OnboardingShowcase;
