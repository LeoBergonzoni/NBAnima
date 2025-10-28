export const safeJSONCookie = <T = unknown>(name: string): T | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((entry) => entry.startsWith(`${name}=`));
  if (!match) {
    return null;
  }

  const value = decodeURIComponent(match.substring(name.length + 1)).trim();
  if (!value || (value[0] !== '{' && value[0] !== '[')) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((entry) => entry.startsWith(`${name}=`));
  if (!match) {
    return null;
  }

  return decodeURIComponent(match.substring(name.length + 1));
};
