import { NextResponse, type NextRequest } from 'next/server';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/constants';

const PUBLIC_FILE = /\.(.*)$/;

const isLocale = (value?: string | null): value is Locale =>
  Boolean(value && SUPPORTED_LOCALES.includes(value as Locale));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const localeCandidate = segments[0];

  if (isLocale(localeCandidate)) {
    return NextResponse.next();
  }

  const locale = DEFAULT_LOCALE;
  const destination = ['/', locale, pathname.replace(/^\//, '')]
    .filter(Boolean)
    .join('/');

  return NextResponse.redirect(new URL(destination.replace('//', '/'), request.url));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
