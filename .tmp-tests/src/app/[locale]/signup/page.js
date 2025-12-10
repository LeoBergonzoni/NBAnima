"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SignupPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const AuthForm_1 = require("../../../components/auth/AuthForm");
const constants_1 = require("../../../lib/constants");
const dictionaries_1 = require("../../../locales/dictionaries");
const supabase_1 = require("../../../lib/supabase");
async function SignupPage({ params, }) {
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
    return ((0, jsx_runtime_1.jsx)(AuthForm_1.AuthForm, { mode: "signup", locale: locale, copy: {
            title: dictionary.auth.signup.title,
            subtitle: dictionary.auth.signup.subtitle,
            submit: dictionary.auth.signup.submit,
            switchPrompt: dictionary.auth.signup.switchPrompt,
            switchCta: dictionary.auth.signup.switchCta,
            nameLabel: dictionary.auth.fields.fullName,
            emailLabel: dictionary.auth.fields.email,
            passwordLabel: dictionary.auth.fields.password,
            confirmPasswordLabel: dictionary.auth.fields.confirmPassword,
            passwordMismatch: dictionary.auth.errors.mismatch,
            genericError: dictionary.auth.errors.generic,
            confirmationNotice: dictionary.auth.signup.confirmationNotice,
        }, switchHref: `/${locale}/login` }));
}
