"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLocale = exports.LocaleProvider = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const LocaleContext = (0, react_1.createContext)(undefined);
const LocaleProvider = ({ value, children, }) => ((0, jsx_runtime_1.jsx)(LocaleContext.Provider, { value: value, children: children }));
exports.LocaleProvider = LocaleProvider;
const useLocale = () => {
    const context = (0, react_1.useContext)(LocaleContext);
    if (!context) {
        throw new Error('useLocale must be used within a LocaleProvider');
    }
    return context;
};
exports.useLocale = useLocale;
