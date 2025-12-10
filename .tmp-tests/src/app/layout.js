"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
const local_1 = __importDefault(require("next/font/local"));
require("./globals.css");
const roster_preload_1 = require("../components/providers/roster-preload");
const service_worker_register_1 = require("../components/providers/service-worker-register");
const constants_1 = require("../lib/constants");
const geist = (0, local_1.default)({
    src: [
        {
            path: '../../public/fonts/geist/GeistVF.woff2',
            weight: '100 900',
            style: 'normal',
        },
    ],
    variable: '--font-geist',
    fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial'],
    display: 'swap',
});
const geistMono = (0, local_1.default)({
    src: [
        {
            path: '../../public/fonts/geist/GeistMonoVF.woff2',
            weight: '100 900',
            style: 'normal',
        },
    ],
    variable: '--font-geist-mono',
    fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    display: 'swap',
});
exports.metadata = {
    title: `${constants_1.APP_TITLE} · NBA picks & cards platform`,
    description: 'Gioca con le notti NBA, ottieni Anima Points e colleziona carte esclusive.',
    manifest: '/manifest.json',
};
function RootLayout({ children, }) {
    return ((0, jsx_runtime_1.jsx)("html", { lang: "en", className: `${geist.variable} ${geistMono.variable}`, children: (0, jsx_runtime_1.jsxs)("body", { className: "antialiased bg-navy-950 text-slate-100", children: [(0, jsx_runtime_1.jsx)(roster_preload_1.RosterPreload, {}), (0, jsx_runtime_1.jsx)(service_worker_register_1.ServiceWorkerRegister, {}), children] }) }));
}
