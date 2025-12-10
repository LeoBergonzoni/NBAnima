"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageToggle = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const constants_1 = require("../lib/constants");
const languages = [
    { label: 'IT', value: 'it' },
    { label: 'EN', value: 'en' },
];
const LanguageToggle = ({ locale, }) => {
    const router = (0, navigation_1.useRouter)();
    const pathname = (0, navigation_1.usePathname)();
    const [activeLocale, setActiveLocale] = (0, react_1.useState)(locale);
    const [isPending, startTransition] = (0, react_1.useTransition)();
    (0, react_1.useEffect)(() => {
        setActiveLocale(locale);
    }, [locale]);
    const switchLocale = (value) => {
        if (value === activeLocale) {
            return;
        }
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length === 0) {
            segments.push(value);
        }
        else {
            segments[0] = value;
        }
        const nextPath = `/${segments.join('/')}`;
        localStorage.setItem(constants_1.LOCAL_STORAGE_LOCALE_KEY, value);
        startTransition(() => {
            router.push(nextPath === '//' ? `/${value}` : nextPath);
        });
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "flex rounded-full border border-accent-gold/50 bg-navy-900/60 p-1 text-[11px] uppercase shadow-card sm:text-xs", children: languages.map(({ label, value }) => ((0, jsx_runtime_1.jsx)("button", { type: "button", disabled: isPending, onClick: () => switchLocale(value), className: `px-2 py-1 transition-colors ${value === activeLocale
                ? 'bg-gradient-to-r from-accent-gold/90 to-accent-ice/90 font-semibold text-navy-950 shadow-lg sm:text-sm'
                : 'text-[10px] font-medium text-slate-200 hover:text-white sm:text-xs'}`, children: label }, value))) }));
};
exports.LanguageToggle = LanguageToggle;
