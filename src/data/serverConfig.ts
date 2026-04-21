const STORAGE_KEY = 'stockbase_server_url';

export function getSavedServerUrl(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function saveServerUrl(url: string): void {
  const cleaned = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY, cleaned);
}

export function clearServerUrl(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isMobileApp(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  const host = window.location.hostname;
  return proto === 'capacitor:' || proto === 'file:' || host === 'localhost' || host === '';
}

export function resolveBaseUrl(): string | null {
  const saved = getSavedServerUrl();
  if (saved) return saved;
  const env = import.meta.env.VITE_API_URL;
  if (env && typeof env === 'string' && env !== '/' && env !== '') {
    return env.replace(/\/+$/, '');
  }
  return null;
}

export function needsServerSetup(): boolean {
  if (!isMobileApp()) return false;
  return !resolveBaseUrl();
}

export function buildApiUrl(path: string): string {
  const base = resolveBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (isMobileApp()) {
    if (!base) return normalizedPath;
    return `${base}${normalizedPath}`;
  }
  if (!base) return normalizedPath;
  return `${base}${normalizedPath}`;
}

export function buildWsUrl(): string {
  const base = resolveBaseUrl();
  if (typeof window === 'undefined') return '';
  if (isMobileApp() && base) {
    try {
      const u = new URL(base);
      const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${u.host}/ws`;
    } catch {
      return '';
    }
  }
  if (base) {
    try {
      const u = new URL(base);
      const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${u.host}/ws`;
    } catch {
      /* fallthrough */
    }
  }
  const proto = window.location.protocol;
  const host = window.location.host;
  const wsProto = proto === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${host}/ws`;
}

export async function pingServer(url: string, timeoutMs = 5000): Promise<{ ok: boolean; error?: string }> {
  const cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) return { ok: false, error: 'Пустой адрес' };
  if (!/^https?:\/\//i.test(cleaned)) {
    return { ok: false, error: 'Адрес должен начинаться с http:// или https://' };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${cleaned}/api/crud?action=check`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok && res.status !== 401) {
      return { ok: false, error: `Сервер ответил ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Не удалось подключиться';
    return { ok: false, error: msg };
  }
}
