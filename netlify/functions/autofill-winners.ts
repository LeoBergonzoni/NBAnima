const ROME_TZ = 'Europe/Rome';
const PAUSED = false;

const resolveBaseUrl = () =>
  process.env.AUTOFILL_BASE_URL ??
  process.env.URL ??
  process.env.DEPLOY_PRIME_URL ??
  '';

const shouldRunNow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  if (hour === 19) {
    return minute >= 30;
  }
  if (hour === 8) {
    return minute === 0;
  }
  return hour > 19 || hour < 8;
};

export const config = {
  schedule: '0,30 * * * *', // every 30 minutes
};

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const handler = async () => {
  if (PAUSED) {
    return jsonResponse(200, { skipped: true, reason: 'Paused in code' });
  }

  if (!shouldRunNow()) {
    return jsonResponse(200, { skipped: true, reason: 'Outside Italy window' });
  }

  const token = process.env.AUTOFILL_ADMIN_TOKEN;
  const baseUrl = resolveBaseUrl().replace(/\/$/, '');

  if (!baseUrl) {
    return jsonResponse(500, { error: 'Missing AUTOFILL_BASE_URL/URL' });
  }

  try {
    const target = `${baseUrl}/api/admin/autofill-winners?publish=1`;
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    const payload = await response
      .json()
      .catch(() => ({ error: 'Failed to parse autofill response' }));

    return jsonResponse(response.status, payload);
  } catch (error) {
    return jsonResponse(500, {
      error: (error as Error).message ?? 'Autofill invocation failed',
    });
  }
};

export default handler;
