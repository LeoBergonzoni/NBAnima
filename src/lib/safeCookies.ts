export function safeJSONCookie(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    const trimmed = decoded.trim();
    if (!trimmed) {
      return null;
    }
    if (/^base64[-:]/i.test(trimmed)) {
      return null;
    }
    if (!/^\s*[\{\[]/.test(decoded)) {
      return null;
    }
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
