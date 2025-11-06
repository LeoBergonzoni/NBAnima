'use client';

import { useEffect } from 'react';

const SERVICE_WORKER_PATH = '/sw-v2.js';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const shouldRegister =
      process.env.NODE_ENV === 'production' || window.location.hostname === 'localhost';

    if (!shouldRegister) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' });
      } catch (error) {
        console.error('[pwa] failed to register service worker', error);
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
