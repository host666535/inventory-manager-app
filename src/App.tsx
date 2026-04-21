import { useState, useEffect, useCallback } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppState, getInitialEmptyState, loadStateFromServer, setCrudErrorHandler } from '@/data/store';
import { toast } from 'sonner';
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
import OfflineOverlay from '@/components/OfflineOverlay';

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

  const [state, setState] = useState<AppState>(getInitialEmptyState);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [page, setPage] = useState<Page>('catalog');

  const [qrItemId, setQrItemId] = useState<string | null>(null);
  const [qrLocationId, setQrLocationId] = useState<string | null>(null);
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);

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

  // Единственный путь получения данных — загрузка целиком с сервера.
  // Используется при первом старте и при каждом WS-сигнале «state_changed».
  const reloadFromServer = useCallback(async (): Promise<boolean> => {
    const result = await loadStateFromServer();
    if (!result) return false;
    setState(result.state);
    return true;
  }, []);

  // Первая загрузка — обязательна, иначе показываем экран «Нет подключения».
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await reloadFromServer();
      if (cancelled) return;
      setInitialLoading(false);
      setInitialLoadFailed(!ok);
    })();
    return () => { cancelled = true; };
  }, [reloadFromServer]);

  // ─── Realtime: WebSocket — единственный способ узнать про изменения ───
  const [wsStatus, setWsStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const offMsg = realtime.onMessage((msg) => {
      if (msg.type !== 'state_changed') return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { reloadFromServer(); }, 150);
    });
    const offStatus = realtime.onStatus((s) => {
      setWsStatus(s);
      // Когда WS восстановился — сразу подтягиваем актуальное состояние,
      // чтобы компенсировать пропущенные пока были офлайн.
      if (s === 'online') reloadFromServer();
    });
    realtime.connect();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      offMsg();
      offStatus();
    };
  }, [reloadFromServer]);

  // Глобальная реакция на ошибку crudAction:
  // показываем toast и откатываем оптимистичное обновление через reload.
  useEffect(() => {
    setCrudErrorHandler((action, status) => {
      const reason = status === 0 ? 'нет связи с сервером' : `код ${status}`;
      toast.error(`Не удалось сохранить изменение (${reason})`, {
        description: `Действие «${action}» отклонено сервером. Данные возвращены к последнему успешному состоянию.`,
      });
      reloadFromServer();
    });
    return () => setCrudErrorHandler(null);
  }, [reloadFromServer]);

  // Ручная попытка переподключения из оверлея «Нет подключения».
  const handleRetryConnection = useCallback(async () => {
    setInitialLoadFailed(false);
    setInitialLoading(true);
    const ok = await reloadFromServer();
    setInitialLoading(false);
    setInitialLoadFailed(!ok);
    if (!ok) realtime.connect();
  }, [reloadFromServer]);

  const handleStateChange = useCallback((s: AppState) => {
    // Оптимистичное локальное обновление — чтобы UI реагировал мгновенно.
    // Реальным источником истины остаётся сервер: WS-сигнал после успешного
    // crudAction тут же подтянет свежее состояние и заменит этот снимок.
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

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-muted-foreground text-sm">Загрузка данных…</div>
      </div>
    );
  }

  if (initialLoadFailed) {
    return (
      <OfflineOverlay
        variant="full"
        onRetry={handleRetryConnection}
      />
    );
  }

  // Считаем «нет связи», если WS офлайн. Пока WS переподключается (connecting)
  // — пользователя не блокируем, показываем только индикатор.
  const wsDisconnected = wsStatus === 'offline';

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
        {wsDisconnected && (
          <OfflineOverlay variant="banner" onRetry={handleRetryConnection} />
        )}
        <InstallPWABanner />
      </TooltipProvider>
    </AuthContext.Provider>
  );
}