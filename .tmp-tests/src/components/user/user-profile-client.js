"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileClient = UserProfileClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const image_1 = __importDefault(require("next/image"));
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const language_toggle_1 = require("../../components/language-toggle");
const logout_button_1 = require("../../components/logout-button");
const locale_provider_1 = require("../../components/providers/locale-provider");
const avatar_options_1 = require("../../lib/avatar-options");
const supabase_browser_1 = require("../../lib/supabase-browser");
function UserProfileClient({ userId, email, fullName, avatarUrl, locale, }) {
    const { dictionary } = (0, locale_provider_1.useLocale)();
    const copy = dictionary.user;
    const supabase = (0, react_1.useMemo)(() => (0, supabase_browser_1.createBrowserSupabase)(), []);
    const [currentAvatar, setCurrentAvatar] = (0, react_1.useState)(avatarUrl ?? null);
    const [name, setName] = (0, react_1.useState)(fullName ?? '');
    const [isEditingName, setIsEditingName] = (0, react_1.useState)(false);
    const [isSavingName, setIsSavingName] = (0, react_1.useState)(false);
    const [isSavingAvatar, setIsSavingAvatar] = (0, react_1.useState)(false);
    const [avatarModalOpen, setAvatarModalOpen] = (0, react_1.useState)(false);
    const [statusMessage, setStatusMessage] = (0, react_1.useState)(null);
    const [errorMessage, setErrorMessage] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        if (avatarModalOpen) {
            const previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = previousOverflow;
            };
        }
    }, [avatarModalOpen]);
    const updateProfile = async (payload) => {
        setErrorMessage(null);
        setStatusMessage(null);
        const { error } = await supabase
            .from('users')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', userId);
        if (error) {
            throw error;
        }
    };
    const handleAvatarSelect = async (option) => {
        setIsSavingAvatar(true);
        try {
            await updateProfile({ avatar_url: option.src });
            setCurrentAvatar(option.src);
            setStatusMessage(copy.statusSaved);
            setAvatarModalOpen(false);
        }
        catch (error) {
            console.error('[user] failed to save avatar', error);
            setErrorMessage(copy.statusError);
        }
        finally {
            setIsSavingAvatar(false);
        }
    };
    const handleSaveName = async () => {
        const trimmed = name.trim();
        setIsSavingName(true);
        try {
            await updateProfile({ full_name: trimmed.length ? trimmed : null });
            setStatusMessage(copy.statusSaved);
            setIsEditingName(false);
        }
        catch (error) {
            console.error('[user] failed to save name', error);
            setErrorMessage(copy.statusError);
        }
        finally {
            setIsSavingName(false);
        }
    };
    const groupedAvatars = (0, react_1.useMemo)(() => ({
        east: avatar_options_1.AVATAR_OPTIONS.filter((option) => option.coast === 'east'),
        west: avatar_options_1.AVATAR_OPTIONS.filter((option) => option.coast === 'west'),
    }), []);
    const displayName = name.trim() || email || 'NBAnima user';
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto flex max-w-4xl flex-col gap-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-2 text-center", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold text-white", children: copy.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: copy.subtitle })] }), (0, jsx_runtime_1.jsx)("section", { className: "rounded-[2rem] border border-accent-gold/40 bg-navy-900/80 p-6 shadow-card", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center gap-6 text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex flex-col items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-accent-gold/50 bg-navy-800/80 shadow-card sm:h-36 sm:w-36", children: currentAvatar ? ((0, jsx_runtime_1.jsx)(image_1.default, { src: currentAvatar, alt: copy.avatarLabel, fill: true, sizes: "144px", className: "object-cover" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.UserCircle2, { className: "h-20 w-20 text-accent-gold/80 sm:h-24 sm:w-24" })) }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setAvatarModalOpen(true), disabled: isSavingAvatar, className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white shadow-card transition hover:border-accent-gold/50 hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-60", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: copy.changeAvatar })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xl font-semibold text-white", children: displayName }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: copy.nicknameLabel }), isEditingName ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center gap-3 sm:w-80", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: name, onChange: (event) => setName(event.target.value), placeholder: copy.nicknamePlaceholder, className: "w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white outline-none ring-1 ring-transparent transition focus:border-accent-gold/70 focus:ring-accent-gold/30" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleSaveName, disabled: isSavingName, className: "inline-flex items-center gap-2 rounded-full border border-accent-gold/60 bg-accent-gold/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-gold/30 disabled:cursor-not-allowed disabled:opacity-60", children: [isSavingName ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: copy.saveNickname })] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setIsEditingName(false), className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-200/40 hover:text-slate-100", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: dictionary.common.cancel })] })] })] })) : ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setIsEditingName(true), className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: copy.editNickname })] }))] }), statusMessage ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: statusMessage })] })) : null, errorMessage ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: errorMessage })] })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-card", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-300", children: dictionary.common.language }), (0, jsx_runtime_1.jsx)(language_toggle_1.LanguageToggle, { locale: locale })] }), (0, jsx_runtime_1.jsxs)("div", { className: "pt-2", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${locale}/dashboard`, className: "mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent-gold/50 hover:text-accent-gold", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: copy.backToDashboard })] }), (0, jsx_runtime_1.jsx)(logout_button_1.LogoutButton, { locale: locale, label: dictionary.common.logout })] })] }) }), avatarModalOpen ? ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black px-4 py-10", children: (0, jsx_runtime_1.jsxs)("div", { role: "dialog", "aria-modal": "true", className: "relative w-full max-w-5xl rounded-[2rem] border border-accent-gold/40 bg-black p-6 shadow-2xl", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setAvatarModalOpen(false), className: "absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-accent-gold/50 hover:text-white", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 pr-10", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold uppercase tracking-[0.2em] text-accent-gold/70", children: copy.avatarLabel }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl font-semibold text-white", children: copy.avatarModalTitle }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: copy.avatarModalSubtitle })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6 flex max-h-[75vh] flex-col gap-6 overflow-y-auto pr-2", children: ['east', 'west'].map((coast) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400", children: coast === 'east' ? copy.eastLabel : copy.westLabel }), (0, jsx_runtime_1.jsx)("div", { className: "h-px flex-1 bg-white/10" })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4", children: groupedAvatars[coast].map((option) => {
                                            const isSelected = currentAvatar === option.src;
                                            return ((0, jsx_runtime_1.jsxs)("button", { type: "button", disabled: isSavingAvatar, onClick: () => handleAvatarSelect(option), className: (0, clsx_1.default)('group relative overflow-hidden rounded-2xl border bg-navy-800/80 text-left shadow-card transition hover:-translate-y-1 hover:border-accent-gold/50 hover:shadow-lg disabled:cursor-not-allowed', isSelected ? 'border-accent-gold/70' : 'border-white/10'), children: [(0, jsx_runtime_1.jsx)("div", { className: "relative h-28 w-full bg-navy-900/70", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: option.src, alt: option.label, fill: true, sizes: "(max-width: 768px) 50vw, 200px", className: "object-cover transition duration-200 group-hover:scale-105" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-2 border-t border-white/10 bg-black/30 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-semibold text-white", children: option.label }), isSelected ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "h-4 w-4 text-accent-gold" })) : null] })] }, option.id));
                                        }) })] }, coast))) })] }) })) : null] }));
}
