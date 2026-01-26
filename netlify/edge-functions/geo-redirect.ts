const getCountryCode = (request: Request, context: any) => {
  const ctxCode =
    context?.geo?.country?.code ??
    context?.geo?.country?.code ??
    context?.geo?.country;
  if (typeof ctxCode === 'string' && ctxCode.length > 0) {
    return ctxCode.toUpperCase();
  }

  const headerCode =
    request.headers.get('x-nf-country-code') ??
    request.headers.get('x-country') ??
    request.headers.get('cf-ipcountry');
  if (headerCode) {
    return headerCode.toUpperCase();
  }

  return null;
};

export default async (request: Request, context: any) => {
  const url = new URL(request.url);

  if (url.pathname !== '/') {
    return context.next();
  }

  const country = getCountryCode(request, context);
  const target = country === 'IT' ? '/it' : '/en';

  return Response.redirect(new URL(target, url.origin), 302);
};
