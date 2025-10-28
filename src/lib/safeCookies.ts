export function safeJSONCookie(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (!/^\s*[\{\[]/.test(decoded)) {
      return null;
    }
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
