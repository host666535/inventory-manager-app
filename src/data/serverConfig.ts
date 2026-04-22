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
  // Надёжный признак — глобал, который Capacitor внедряет в WebView:
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
  // Доп. эвристика — нативные схемы.
  const proto = window.location.protocol;
  if (proto === 'capacitor:' || proto === 'file:') return true;
  // ВАЖНО: localhost сам по себе НЕ значит «мобильное приложение» —
  // vite dev на ПК тоже открывается как http://localhost:5173.
  return false;
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

/** Приводит ввод пользователя к валидному http-URL.
 *  - Обрезает пробелы и завершающие слэши.
 *  - Если нет схемы — добавляет http:// (частая ошибка ввода).
 *  - Если указан только IP без порта — добавляет :3000 (порт нашего бэкенда). */
export function normalizeServerUrl(raw: string): string {
  let cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  if (!/^https?:\/\//i.test(cleaned)) cleaned = `http://${cleaned}`;
  // Добавляем порт 3000, если после хоста нет ни порта, ни пути.
  try {
    const u = new URL(cleaned);
    if (!u.port && u.pathname === '/' && !/:\d+/.test(u.host)) {
      // Голый IP/hostname без порта → подставляем 3000
      u.port = '3000';
      cleaned = u.toString().replace(/\/+$/, '');
    }
  } catch {
    /* если URL невалидный — оставляем как есть, pingServer отрапортует */
  }
  return cleaned;
}

export async function pingServer(url: string, timeoutMs = 6000): Promise<{ ok: boolean; error?: string; hint?: string }> {
  const cleaned = normalizeServerUrl(url);
  if (!cleaned) return { ok: false, error: 'Пустой адрес' };
  if (!/^https?:\/\//i.test(cleaned)) {
    return { ok: false, error: 'Неверный формат адреса', hint: 'Пример: http://192.168.1.100:3000' };
  }
  try {
    new URL(cleaned);
  } catch {
    return { ok: false, error: 'Неверный формат адреса', hint: 'Пример: http://192.168.1.100:3000' };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${cleaned}/api/crud?action=check`, {
      signal: ctrl.signal,
      method: 'GET',
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (res.status === 404) {
      return {
        ok: false,
        error: 'Адрес доступен, но это не сервер StockBase',
        hint: 'Проверь порт и версию сервера (ожидается роут /api/crud).',
      };
    }
    if (!res.ok && res.status !== 401) {
      return { ok: false, error: `Сервер ответил с кодом ${res.status}` };
    }
    // Подтверждаем, что это именно наш сервер — в ответе должен быть updatedAt.
    try {
      const data = await res.json();
      if (!data || typeof data !== 'object' || !('updatedAt' in data)) {
        return {
          ok: false,
          error: 'Это не сервер StockBase',
          hint: 'Адрес доступен, но отвечает не тот сервис. Проверь порт.',
        };
      }
    } catch {
      /* не JSON — считаем сервером StockBase уязвимо, но пусть подключится */
    }
    return { ok: true };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        error: 'Сервер не ответил за 6 секунд',
        hint: 'Проверь, что сервер запущен и телефон в той же Wi-Fi сети.',
      };
    }
    const msg = err?.message || '';
    if (/Failed to fetch|NetworkError|Network request failed/i.test(msg)) {
      return {
        ok: false,
        error: 'Сервер не отвечает',
        hint: 'Возможные причины: 1) неверный IP или порт; 2) сервер не запущен; 3) телефон не в той же Wi-Fi сети; 4) брандмауэр блокирует порт.',
      };
    }
    return { ok: false, error: msg || 'Не удалось подключиться' };
  }
}