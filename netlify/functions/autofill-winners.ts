import type { Handler } from '@netlify/functions';

const ROME_TZ = 'Europe/Rome';
const allowedHours = new Set([19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);

const resolveBaseUrl = () =>
  process.env.AUTOFILL_BASE_URL ??
  process.env.URL ??
  process.env.DEPLOY_PRIME_URL ??
  '';

const shouldRunNow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME_TZ,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return allowedHours.has(hour);
};

export const config = {
  schedule: '0,30 * * * *', // every 30 minutes
};

const handler: Handler = async () => {
  if (!shouldRunNow()) {
    return {
      statusCode: 200,
      body: JSON.stringify({ skipped: true, reason: 'Outside Italy window' }),
    };
  }

  const token = process.env.AUTOFILL_ADMIN_TOKEN;
  const baseUrl = resolveBaseUrl().replace(/\/$/, '');

  if (!baseUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing AUTOFILL_BASE_URL/URL' }),
    };
  }

  const target = `${baseUrl}/api/admin/autofill-winners`;
  const response = await fetch(target, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  const payload = await response
    .json()
    .catch(() => ({ error: 'Failed to parse autofill response' }));

  return {
    statusCode: response.status,
    body: JSON.stringify(payload),
  };
};

export default handler;
