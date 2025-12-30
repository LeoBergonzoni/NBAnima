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
  if (hour === 9) {
    return minute <= 30;
  }
  if (hour === 8) {
    return true;
  }
  return hour > 19 || hour < 9;
};

const isDualDateWindow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  return hour === 7 ? minute >= 30 : hour === 8 || (hour === 9 && minute <= 30);
};

const formatEtDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const getEtDateList = (now = new Date()) => {
  const todayEt = formatEtDate(now);
  if (!isDualDateWindow(now)) {
    return [todayEt];
  }
  const yesterday = new Date(now.getTime());
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayEt = formatEtDate(yesterday);
  return [todayEt, yesterdayEt];
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
  const nowIso = new Date().toISOString();
  console.info('[autofill-winners] start', { nowIso });

  if (PAUSED) {
    console.info('[autofill-winners] skipped', { reason: 'Paused in code' });
    return jsonResponse(200, { skipped: true, reason: 'Paused in code' });
  }

  if (!shouldRunNow()) {
    console.info('[autofill-winners] skipped', { reason: 'Outside Italy window' });
    return jsonResponse(200, { skipped: true, reason: 'Outside Italy window' });
  }

  const token = process.env.AUTOFILL_ADMIN_TOKEN;
  const baseUrl = resolveBaseUrl().replace(/\/$/, '');

  if (!baseUrl) {
    console.error('[autofill-winners] missing base url');
    return jsonResponse(500, { error: 'Missing AUTOFILL_BASE_URL/URL' });
  }

  try {
    const dates = getEtDateList();
    const payloads = [];
    let status = 200;

    for (const date of dates) {
      const target = `${baseUrl}/api/admin/autofill-winners?publish=1&date=${encodeURIComponent(
        date,
      )}`;
      console.info('[autofill-winners] invoking', { target });
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const payload = await response
        .json()
        .catch(() => ({ error: 'Failed to parse autofill response' }));

      if (response.ok) {
        console.info('[autofill-winners] success', {
          status: response.status,
          payload,
        });
      } else {
        console.error('[autofill-winners] failed', {
          status: response.status,
          payload,
        });
      }

      status = Math.max(status, response.status);
      payloads.push({ date, status: response.status, payload });
    }

    return jsonResponse(status, { results: payloads });
  } catch (error) {
    console.error('[autofill-winners] exception', error);
    return jsonResponse(500, {
      error: (error as Error).message ?? 'Autofill invocation failed',
    });
  }
};

export default handler;
