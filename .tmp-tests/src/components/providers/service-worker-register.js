"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceWorkerRegister = ServiceWorkerRegister;
const react_1 = require("react");
const SERVICE_WORKER_PATH = '/sw-v3.js';
const CACHE_PREFIX = 'nbanima-assets-v3';
const shouldRegisterServiceWorker = () => typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    (process.env.NODE_ENV === 'production' || window.location.hostname === 'localhost');
function ServiceWorkerRegister() {
    (0, react_1.useEffect)(() => {
        if (!shouldRegisterServiceWorker()) {
            return;
        }
        const ensureLatestServiceWorker = async () => {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(async (registration) => {
                    const scriptURL = registration.active?.scriptURL ??
                        registration.waiting?.scriptURL ??
                        registration.installing?.scriptURL;
                    if (!scriptURL?.endsWith(SERVICE_WORKER_PATH)) {
                        await registration.unregister();
                    }
                }));
                if ('caches' in window) {
                    const cacheKeys = await caches.keys();
                    await Promise.all(cacheKeys
                        .filter((key) => !key.startsWith(CACHE_PREFIX))
                        .map((key) => caches.delete(key)));
                }
                await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' });
            }
            catch (error) {
                console.error('[pwa] failed to register service worker', error);
            }
        };
        void ensureLatestServiceWorker();
    }, []);
    return null;
}
