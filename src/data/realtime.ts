/**
 * Realtime sync через WebSocket.
 *
 * Архитектура:
 *   Клиент делает изменение -> HTTP POST /api/crud -> Flask пишет в БД
 *                                                   -> Flask шлёт broadcast на WS-сервер
 *                                                   -> WS рассылает всем клиентам
 *                                                   -> клиенты получают сигнал и грузят актуальное состояние
 *
 * Если WebSocket недоступен — остаётся fallback на polling (см. App.tsx).
 *
 * Сервер шлёт сообщения вида:
 *   { type: "state_changed", action: "upsert_item", updatedAt: "...", meta: {} }
 *   { type: "hello" | "ping" | "pong", ts: "..." }
 */

export type RealtimeStatus = 'connecting' | 'online' | 'offline';

export type RealtimeMessage = {
  type: 'state_changed' | 'hello' | 'ping' | 'pong';
  action?: string;
  updatedAt?: string;
  ts?: string;
  meta?: Record<string, unknown>;
};

type Listener = (msg: RealtimeMessage) => void;
type StatusListener = (status: RealtimeStatus) => void;

const MAX_RECONNECT_DELAY = 30000; // 30 сек
const HEARTBEAT_INTERVAL = 20000; // 20 сек

function resolveWsUrl(): string {
  // Для Capacitor / локальной разработки — смотрим VITE_API_URL
  const env = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env?.VITE_API_URL;
  if (typeof window === 'undefined') return '';

  const proto = window.location.protocol;
  const host = window.location.host;
  const hostname = window.location.hostname;

  const isCapacitor = proto === 'capacitor:' || proto === 'file:' || hostname === 'localhost' || hostname === '';

  // Если задан явный API_URL — строим ws:// от него
  if (isCapacitor && env) {
    try {
      const u = new URL(env);
      const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${u.host}/ws`;
    } catch {
      /* fallthrough */
    }
  }

  // Обычный случай: ws(s)://<текущий host>/ws
  const wsProto = proto === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${host}/ws`;
}

class RealtimeClient {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private status: RealtimeStatus = 'connecting';
  private closed = false;

  connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = resolveWsUrl();
    if (!url) return;

    this.closed = false;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('online');
      this.startHeartbeat();
    };

    this.ws.onmessage = (ev) => {
      let msg: RealtimeMessage | null = null;
      try {
        msg = JSON.parse(ev.data) as RealtimeMessage;
      } catch {
        return;
      }
      if (!msg) return;
      // Игнорируем служебные — но передадим слушателям если захотят
      this.listeners.forEach(l => {
        try { l(msg as RealtimeMessage); } catch { /* noop */ }
      });
    };

    this.ws.onerror = () => {
      // ошибка приведёт к onclose — там и будем реконнектиться
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.setStatus('offline');
      if (!this.closed) this.scheduleReconnect();
    };
  }

  disconnect(): void {
    this.closed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
    this.setStatus('offline');
  }

  onMessage(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  getStatus(): RealtimeStatus {
    return this.status;
  }

  private setStatus(s: RealtimeStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach(l => {
      try { l(s); } catch { /* noop */ }
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    if (this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    // Экспоненциальный backoff: 1с, 2с, 4с, 8с, 16с, 30с (максимум)
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempt - 1), MAX_RECONNECT_DELAY);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }));
        } catch { /* noop */ }
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// Синглтон — один WS-клиент на всё приложение
export const realtime = new RealtimeClient();
