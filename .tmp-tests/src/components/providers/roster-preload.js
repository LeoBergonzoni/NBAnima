"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.RosterPreload = RosterPreload;
const react_1 = require("react");
function RosterPreload() {
    (0, react_1.useEffect)(() => {
        fetch('/rosters.json', { cache: 'force-cache', credentials: 'omit' }).catch(() => {
            // ignore failures; the API route will handle missing data
        });
    }, []);
    return null;
}
