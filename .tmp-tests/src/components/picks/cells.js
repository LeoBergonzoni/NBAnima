"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamSideBadge = exports.TeamAbbrPill = exports.combineName = exports.matchesTeamIdentity = exports.formatDateTimeNy = exports.formatDateNy = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const constants_1 = require("../../lib/constants");
const DATE_NY = new Intl.DateTimeFormat('en-CA', {
    timeZone: constants_1.TIMEZONES.US_EASTERN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
const DATETIME_NY = new Intl.DateTimeFormat('en-US', {
    timeZone: constants_1.TIMEZONES.US_EASTERN,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
});
const normalizeInput = (value) => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
        const byNumber = new Date(value);
        return Number.isNaN(byNumber.getTime()) ? null : byNumber;
    }
    const stringValue = (value ?? '').toString().trim();
    if (!stringValue) {
        return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
        const parsed = new Date(`${stringValue}T00:00:00Z`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(stringValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const formatDateNy = (value, fallback = '—') => {
    const date = normalizeInput(value);
    return date ? DATE_NY.format(date) : fallback;
};
exports.formatDateNy = formatDateNy;
const formatDateTimeNy = (value, fallback = '—') => {
    const date = normalizeInput(value);
    return date ? DATETIME_NY.format(date) : fallback;
};
exports.formatDateTimeNy = formatDateTimeNy;
const normalizeId = (value) => (value ?? '').trim().toLowerCase();
const matchesTeamIdentity = (left, right) => {
    if (!left || !right) {
        return false;
    }
    const leftId = normalizeId(left.id);
    const rightId = normalizeId(right.id);
    if (leftId && rightId && leftId === rightId) {
        return true;
    }
    const leftAbbr = normalizeId(left.abbr);
    const rightAbbr = normalizeId(right.abbr);
    return Boolean(leftAbbr && rightAbbr && leftAbbr === rightAbbr);
};
exports.matchesTeamIdentity = matchesTeamIdentity;
const combineName = (first, last, fallback = '—') => {
    const value = [first ?? '', last ?? ''].join(' ').trim();
    return value || fallback;
};
exports.combineName = combineName;
const TeamAbbrPill = ({ abbr, variant = 'neutral', }) => ((0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('inline-flex min-w-[2.5rem] items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', variant === 'home'
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
        : variant === 'away'
            ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
            : 'border-white/15 bg-white/5 text-slate-200'), children: abbr ?? '—' }));
exports.TeamAbbrPill = TeamAbbrPill;
const TeamSideBadge = ({ side }) => ((0, jsx_runtime_1.jsx)("span", { className: (0, clsx_1.default)('ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', side === 'home'
        ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30'
        : 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30'), children: side }));
exports.TeamSideBadge = TeamSideBadge;
