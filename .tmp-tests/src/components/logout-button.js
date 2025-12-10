"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogoutButton = LogoutButton;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = __importDefault(require("clsx"));
const lucide_react_1 = require("lucide-react");
const navigation_1 = require("next/navigation");
const react_1 = require("react");
const supabase_browser_1 = require("../lib/supabase-browser");
function LogoutButton({ locale, label, className, iconClassName }) {
    const router = (0, navigation_1.useRouter)();
    const supabase = (0, supabase_browser_1.createBrowserSupabase)();
    const [isLoggingOut, setIsLoggingOut] = (0, react_1.useState)(false);
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await supabase.auth.signOut();
            router.push(`/${locale}`);
            router.refresh();
        }
        catch (error) {
            console.error('[logout] signOut failed', error);
        }
        finally {
            setIsLoggingOut(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("button", { type: 'button', onClick: handleLogout, disabled: isLoggingOut, className: (0, clsx_1.default)('inline-flex items-center gap-1 rounded-full border border-white/15 bg-navy-900/80 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-accent-gold/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60', className), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.LogOut, { className: (0, clsx_1.default)('h-3 w-3', iconClassName) }), (0, jsx_runtime_1.jsx)("span", { children: isLoggingOut ? '…' : label })] }));
}
