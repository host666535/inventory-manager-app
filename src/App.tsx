import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppState, loadState, saveLocal, loadStateFromServer, checkServerUpdatedAt, getLastCrudAt, crudAction } from '@/data/store';
import Layout, { Page } from '@/components/Layout';
import CatalogPage from '@/pages/CatalogPage';
import NomenclaturePage from '@/pages/NomenclaturePage';
import AssemblyPage from '@/pages/AssemblyPage';
import PartnersPage from '@/pages/PartnersPage';
import WarehouseMapPage from '@/pages/WarehouseMapPage';
import ReceiptsPage from '@/pages/ReceiptsPage';
import TechnicianPage from '@/pages/TechnicianPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import DashboardPage from '@/pages/DashboardPage';
import InventoryPage from '@/pages/InventoryPage';
import LabelsPage from '@/pages/LabelsPage';
import AuditPage from '@/pages/AuditPage';
import DocumentsPage from '@/pages/DocumentsPage';
import InvoiceTemplatePage from '@/pages/InvoiceTemplatePage';
import LoginPage from '@/pages/LoginPage';
import { AuthContext, AuthUser, apiLogin, apiLogout, apiMe, setToken, getToken, clearToken } from '@/data/auth';
import InstallPWABanner from '@/components/InstallPWABanner';
import { realtime, RealtimeStatus } from '@/data/realtime';
import RealtimeIndicator from '@/components/RealtimeIndicator';

// WS — основной канал синхронизации. Polling остаётся как fallback:
// если WebSocket отвалился (не поднят сервер, прокси режет) — включаем опрос.
const POLL_INTERVAL_ONLINE = 30000;   // 30 сек — когда WS работает, на случай пропуска сообщения
const POLL_INTERVAL_OFFLINE = 5000;   // 5 сек — когда WS отвалился, работаем как раньше

function parseQRParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    itemId: params.get('item'),
    locationId: params.get('location'),
    orderId: params.get('order'),
  };
}

// TEMP: авторизация временно отключена — вход происходит автоматически под гостем-админом.
// Чтобы вернуть — выставить AUTH_DISABLED в false.
const AUTH_DISABLED = true;
const GUEST_USER: AuthUser = {
  id: 'guest',
  username: 'guest',
  displayName: 'Гость',
  role: 'admin',
};

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(AUTH_DISABLED ? GUEST_USER : null);
  const [authLoading, setAuthLoading] = useState(!AUTH_DISABLED);

  useEffect(() => {
    if (AUTH_DISABLED) return;
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    apiMe().then(user => {
      if (user) setAuthUser(user);
      else clearToken();
      setAuthLoading(false);
    });
  }, []);

  const login = async (username: string, password: string): Promise<string | null> => {
    const result = await apiLogin(username, password);
    if ('error' in result) return result.error;
    setToken(result.token);
    setAuthUser(result.user);
    setState(prev => ({ ...prev, currentUser: result.user.displayName }));
    return null;
  };

  const logout = async () => {
    await apiLogout();
    setAuthUser(null);
  };

  const refreshAuth = async () => {
    const user = await apiMe();
    setAuthUser(user);
  };

  const canEdit = authUser?.role === 'admin' || authUser?.role === 'warehouse';
  const isAdmin = authUser?.role === 'admin';

  const authCtx = {
    user: authUser,
    loading: authLoading,
    login,
    logout,
    refresh: refreshAuth,
    canEdit,
    isAdmin,
  };

  const [state, setState] = useState<AppState>(loadState);
  const [page, setPage] = useState<Page>('catalog');

  const [qrItemId, setQrItemId] = useState<string | null>(null);
  const [qrLocationId, setQrLocationId] = useState<string | null>(null);
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);

  const serverUpdatedAtRef = useRef<string | null>(null);
  const lastLocalSaveRef = useRef<number>(0);

  useEffect(() => {
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.darkMode]);

  useEffect(() => {
    const { itemId, locationId, orderId } = parseQRParams();
    if (itemId) { setQrItemId(itemId); setPage('catalog'); }
    else if (locationId) { setQrLocationId(locationId); setPage('warehouse'); }
    else if (orderId) { setQrOrderId(orderId); setPage('assembly'); }
    if (itemId || locationId || orderId) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const mergeServerState = useCallback((local: AppState, server: AppState): AppState => {
    const RECENT_LOCAL_WINDOW_MS = 15000;
    const recentLocalChange = Date.now() - Math.max(lastLocalSaveRef.current, getLastCrudAt()) < RECENT_LOCAL_WINDOW_MS;

    const arrayKeys: (keyof AppState)[] = [
      'items', 'categories', 'locations', 'operations', 'warehouses',
      'partners', 'barcodes', 'locationStocks', 'warehouseStocks',
      'workOrders', 'receipts', 'techDocs', 'invoiceTemplates',
    ];

    // Ключ уникальности записи (для stocks нет id — используем составной ключ)
    const keyOf = (tableKey: string, obj: Record<string, unknown>): string => {
      if (tableKey === 'locationStocks') return `${obj.itemId}::${obj.locationId}`;
      if (tableKey === 'warehouseStocks') return `${obj.itemId}::${obj.warehouseId}`;
      return (obj.id as string) || '';
    };

    // Смёрдж массива сущностей с учётом локальных удалений/добавлений
    const mergeArray = (
      tableKey: string,
      loc: Array<Record<string, unknown>>,
      srv: Array<Record<string, unknown>>,
    ) => {
      const locMap = new Map(loc.map(x => [keyOf(tableKey, x), x]));
      const srvMap = new Map(srv.map(x => [keyOf(tableKey, x), x]));

      // Если недавно были локальные изменения — доверяем локальному состоянию:
      // • элементы, которых нет локально, но есть на сервере = удалены локально → НЕ возвращаем
      // • элементы, которых нет на сервере, но есть локально = добавлены локально → оставляем
      // • общие элементы — берём с сервера (он был обновлён нашим upsert)
      if (recentLocalChange) {
        const result: Array<Record<string, unknown>> = [];
        // Идём по локальному (сохраняем порядок)
        for (const [k, lObj] of locMap) {
          const sObj = srvMap.get(k);
          result.push(sObj || lObj);
        }
        // Добавляем новое с сервера (от других устройств), которого локально не было
        // — только если это НЕ удаление (у нас этих ID локально нет вовсе).
        // Но если запись исчезла локально именно сейчас — она не должна вернуться.
        // Компромисс: при recentLocalChange мы НЕ добавляем серверные записи,
        // которых нет локально — иначе удаление вернёт их обратно.
        return result;
      }

      // Нет свежих локальных изменений — полностью принимаем сервер как источник истины
      return srv;
    };

    const merged: AppState = { ...local, ...server };
    for (const k of arrayKeys) {
      const srv = (server[k] as Array<Record<string, unknown>>) || [];
      const loc = (local[k] as Array<Record<string, unknown>>) || [];

      // Если сервер пуст, а локально есть данные и были недавние изменения —
      // оставляем локальные (сервер ещё не успел применить)
      if ((!srv || srv.length === 0) && loc.length > 0 && recentLocalChange) {
        (merged as Record<string, unknown>)[k as string] = loc;
        continue;
      }

      (merged as Record<string, unknown>)[k as string] = mergeArray(k as string, loc, srv);
    }
    return merged;
  }, []);

  useEffect(() => {
    loadStateFromServer().then(result => {
      if (!result) return;
      const localRaw = localStorage.getItem('stockbase_state');
      const localTs = localRaw ? (JSON.parse(localRaw)._savedAt || '') : '';
      const serverTs = result.updatedAt || '';
      if (localTs && serverTs && localTs > serverTs) {
        serverUpdatedAtRef.current = serverTs;
        return;
      }
      serverUpdatedAtRef.current = result.updatedAt;
      setState(prev => {
        const merged = mergeServerState(prev, result.state);
        saveLocal(merged);
        const srvWh = result.state.warehouses || [];
        const locWh = prev.warehouses || [];
        if (srvWh.length === 0 && locWh.length > 0) {
          locWh.forEach(w => { crudAction('upsert_warehouse', { warehouse: w }); });
        }
        const srvCats = result.state.categories || [];
        const locCats = prev.categories || [];
        if (srvCats.length === 0 && locCats.length > 0) {
          locCats.forEach(c => { crudAction('upsert_category', { category: c }); });
        }
        const srvLocs = result.state.locations || [];
        const locLocs = prev.locations || [];
        if (srvLocs.length === 0 && locLocs.length > 0) {
          locLocs.forEach(l => { crudAction('upsert_location', { location: l }); });
        }
        const srvItems = result.state.items || [];
        const locItems = prev.items || [];
        if (srvItems.length === 0 && locItems.length > 0) {
          locItems.forEach(i => { crudAction('upsert_item', { item: i }); });
        }
        return merged;
      });
    });
  }, [mergeServerState]);

  // Единая функция загрузки актуального состояния с сервера и мерджа в локальное.
  // Используется и WS-сигналом (мгновенно), и polling-fallback.
  // Параметр `skipQuietCheck` — для WS-сигналов: они приходят от ЧУЖИХ изменений,
  // и ждать тишины после своего локального сохранения тут не нужно —
  // merge-функция сама защитит локальные правки через recentLocalChange.
  const pullAndMerge = useCallback(async (opts?: { skipQuietCheck?: boolean }) => {
    const QUIET_WINDOW_MS = 15000;
    const skip = opts?.skipQuietCheck === true;
    if (!skip) {
      const lastChange = Math.max(lastLocalSaveRef.current, getLastCrudAt());
      if (Date.now() - lastChange < QUIET_WINDOW_MS) return;
      const remoteTs = await checkServerUpdatedAt();
      if (!remoteTs) return;
      if (remoteTs === serverUpdatedAtRef.current) return;
    }
    const result = await loadStateFromServer();
    if (!result) return;
    serverUpdatedAtRef.current = result.updatedAt;
    setState(prev => {
      const merged = mergeServerState(prev, result.state);
      saveLocal(merged);
      return merged;
    });
  }, [mergeServerState]);

  // ─── Realtime: WebSocket (главный канал) + polling (fallback) ───
  const [wsStatus, setWsStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    // Подписка на сигналы от сервера: кто-то сохранил изменение — подтянуть свежее состояние.
    // Небольшой дебаунс, чтобы серия событий (напр. целая заявка) тянулась одним load_all.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const offMsg = realtime.onMessage((msg) => {
      if (msg.type !== 'state_changed') return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        pullAndMerge({ skipQuietCheck: true });
      }, 150);
    });
    const offStatus = realtime.onStatus(setWsStatus);
    realtime.connect();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      offMsg();
      offStatus();
      // Не закрываем соединение при unmount корневого компонента — но это и не произойдёт
      // в нормальной работе. На всякий случай оставляем WS живым.
    };
  }, [pullAndMerge]);

  useEffect(() => {
    // Polling-fallback. Интервал меняется в зависимости от статуса WS.
    const interval = wsStatus === 'online' ? POLL_INTERVAL_ONLINE : POLL_INTERVAL_OFFLINE;
    const id = setInterval(() => { pullAndMerge(); }, interval);
    return () => clearInterval(id);
  }, [pullAndMerge, wsStatus]);

  const handleStateChange = useCallback((s: AppState) => {
    lastLocalSaveRef.current = Date.now();
    setState(s);
  }, []);

  const handleQRResult = (type: string, id: string) => {
    if (type === 'item')     { setQrItemId(id); setPage('catalog'); }
    if (type === 'location') { setQrLocationId(id); setPage('warehouse'); }
    if (type === 'order')    { setQrOrderId(id); setPage('assembly'); }
  };

  const handlePageChange = (p: Page) => {
    setPage(p);
    if (p !== 'catalog')   setQrItemId(null);
    if (p !== 'warehouse') setQrLocationId(null);
    if (p !== 'assembly')  setQrOrderId(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-muted-foreground text-sm">Загрузка...</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthContext.Provider value={authCtx}>
        <TooltipProvider>
          <Toaster position="top-right" />
          <LoginPage />
        </TooltipProvider>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={authCtx}>
      <TooltipProvider>
        <Toaster position="top-right" />
        <Layout
          state={state}
          onStateChange={handleStateChange}
          activePage={page}
          onPageChange={handlePageChange}
          onQRResult={handleQRResult}
        >
          {page === 'dashboard'    && <DashboardPage state={state} />}
          {page === 'catalog'      && <CatalogPage state={state} onStateChange={handleStateChange} initialItemId={qrItemId} />}
          {page === 'nomenclature' && <NomenclaturePage state={state} onStateChange={handleStateChange} />}
          {page === 'assembly'     && <AssemblyPage state={state} onStateChange={handleStateChange} initialOrderId={qrOrderId} />}
          {page === 'warehouse'    && <WarehouseMapPage state={state} onStateChange={handleStateChange} initialLocationId={qrLocationId} />}
          {page === 'receipts'     && <ReceiptsPage state={state} onStateChange={handleStateChange} />}
          {page === 'documents'    && <DocumentsPage state={state} onStateChange={handleStateChange} />}
          {page === 'invoice'     && <InvoiceTemplatePage state={state} onStateChange={handleStateChange} />}
          {page === 'inventory'    && <InventoryPage state={state} onStateChange={handleStateChange} />}
          {page === 'technician'   && <TechnicianPage state={state} onStateChange={handleStateChange} />}
          {page === 'partners'     && <PartnersPage state={state} onStateChange={handleStateChange} />}
          {page === 'labels'       && <LabelsPage state={state} />}
          {page === 'history'      && <HistoryPage state={state} />}
          {page === 'audit'        && <AuditPage state={state} />}
          {page === 'settings'     && <SettingsPage state={state} onStateChange={handleStateChange} />}
        </Layout>
        <RealtimeIndicator status={wsStatus} />
        <InstallPWABanner />
      </TooltipProvider>
    </AuthContext.Provider>
  );
}