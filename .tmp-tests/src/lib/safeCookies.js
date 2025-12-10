"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJSONCookie = safeJSONCookie;
function safeJSONCookie(value) {
    if (!value) {
        return null;
    }
    try {
        const decoded = decodeURIComponent(value);
        const trimmed = decoded.trim();
        if (!trimmed) {
            return null;
        }
        if (/^base64[-:]/i.test(trimmed)) {
            return null;
        }
        if (!/^\s*[\{\[]/.test(decoded)) {
            return null;
        }
        return JSON.parse(decoded);
    }
    catch {
        return null;
    }
}
