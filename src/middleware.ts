import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { DEFAULT_LOCALE } from '@/lib/constants';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
