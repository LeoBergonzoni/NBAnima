'use client';

import { useEffect } from 'react';

import { preloadRosters } from '@/lib/rosters';

export function RosterPreload() {
  useEffect(() => {
    preloadRosters().catch(() => {
      // silent fail
    });
  }, []);

  return null;
}
