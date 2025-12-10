"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoginPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const AuthForm_1 = require("../../../components/auth/AuthForm");
const constants_1 = require("../../../lib/constants");
const dictionaries_1 = require("../../../locales/dictionaries");
const supabase_1 = require("../../../lib/supabase");
async function LoginPage({ params, }) {
    const { locale: rawLocale } = await params;
    const locale = constants_1.SUPPORTED_LOCALES.includes(rawLocale)
        ? rawLocale
        : undefined;
    if (!locale) {
        (0, navigation_1.notFound)();
    }
    const supabase = await (0, supabase_1.createServerSupabase)();
    const { data: { user }, } = await supabase.auth.getUser();
    if (user) {
        (0, navigation_1.redirect)(`/${locale}/dashboard`);
    }
    const dictionary = await (0, dictionaries_1.getDictionary)(locale);
    return ((0, jsx_runtime_1.jsx)(AuthForm_1.AuthForm, { mode: "login", locale: locale, copy: {
            title: dictionary.auth.login.title,
            subtitle: dictionary.auth.login.subtitle,
            submit: dictionary.auth.login.submit,
            switchPrompt: dictionary.auth.login.switchPrompt,
            switchCta: dictionary.auth.login.switchCta,
            emailLabel: dictionary.auth.fields.email,
            passwordLabel: dictionary.auth.fields.password,
            passwordMismatch: dictionary.auth.errors.mismatch,
            genericError: dictionary.auth.errors.generic,
        }, switchHref: `/${locale}/signup` }));
}
