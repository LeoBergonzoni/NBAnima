const ROME_TZ = 'Europe/Rome';
const allowedHours = new Set([19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);
const PAUSED = true; // flip to false to re-enable execution

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

    return jsonResponse(response.status, payload);
  } catch (error) {
    return jsonResponse(500, {
      error: (error as Error).message ?? 'Autofill invocation failed',
    });
  }
};

export default handler;
