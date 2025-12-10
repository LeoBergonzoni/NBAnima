"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserNavButton = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const link_1 = __importDefault(require("next/link"));
const UserNavButton = ({ locale, label, className, iconClassName }) => ((0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}/user`, className: (0, clsx_1.default)('inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold', className), "aria-label": label, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.UserRound, { className: (0, clsx_1.default)('h-4 w-4', iconClassName) }), (0, jsx_runtime_1.jsx)("span", { className: "sr-only", children: label })] }));
exports.UserNavButton = UserNavButton;
