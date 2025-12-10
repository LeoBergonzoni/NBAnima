"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocaleSync = void 0;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const constants_1 = require("../lib/constants");
const isSupportedLocale = (value) => constants_1.SUPPORTED_LOCALES.includes(value);
const LocaleSync = ({ locale }) => {
    const router = (0, navigation_1.useRouter)();
    const pathname = (0, navigation_1.usePathname)();
    (0, react_1.useEffect)(() => {
        const savedLocale = localStorage.getItem(constants_1.LOCAL_STORAGE_LOCALE_KEY);
        if (!savedLocale) {
            localStorage.setItem(constants_1.LOCAL_STORAGE_LOCALE_KEY, locale);
            return;
        }
        if (isSupportedLocale(savedLocale) && savedLocale !== locale) {
            const segments = pathname.split('/').filter(Boolean);
            segments[0] = savedLocale;
            const nextPath = `/${segments.join('/')}`;
            router.replace(nextPath === '//' ? `/${constants_1.DEFAULT_LOCALE}` : nextPath);
        }
        else {
            localStorage.setItem(constants_1.LOCAL_STORAGE_LOCALE_KEY, locale);
        }
    }, [locale, pathname, router]);
    return null;
};
exports.LocaleSync = LocaleSync;
