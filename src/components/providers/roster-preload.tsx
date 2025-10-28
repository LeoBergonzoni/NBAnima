'use client';

import { useEffect } from 'react';

export function RosterPreload() {
  useEffect(() => {
    fetch('/rosters.json', { cache: 'force-cache', credentials: 'omit' }).catch(() => {
      // ignore failures; the API route will handle missing data
    });
  }, []);

  return null;
}
