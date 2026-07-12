import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { AppState, crudAction } from '@/data/store';
import QRScanner from '@/components/QRScanner';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import { useAuth } from '@/data/auth';

export type Page = 'catalog' | 'nomenclature' | 'assembly' | 'warehouse' | 'receipts' | 'documents' | 'technician' | 'partners' | 'history' | 'settings' | 'dashboard' | 'inventory' | 'labels' | 'audit' | 'invoice';

type LayoutProps = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  activePage: Page;
  onPageChange: (p: Page) => void;
  children: React.ReactNode;
};

export default function Layout({ state, onStateChange, activePage, onPageChange, children, onQRResult }: LayoutProps & {
  onQRResult?: (type: string, id: string) => void;
}) {
  const { user: authUser, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const desktopMoreRef = useRef<HTMLDivElement>(null);

  const lowStockItems = state.items.filter(i => i.quantity <= i.lowStockThreshold);
  const recentOps = state.operations
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const notifCount = lowStockItems.length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(e.target as Node)) setDesktopMoreOpen(false);
    };
    if (desktopMoreOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [desktopMoreOpen]);

  useEffect(() => {
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.darkMode]);

  // Close "More" popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDark = () => {
    const next = { ...state, darkMode: !state.darkMode };
    onStateChange(next); crudAction('update_setting', { key: 'darkMode', value: String(!state.darkMode) });
  };

  const lowStockCount = state.items.filter(i => i.quantity <= i.lowStockThreshold).length;
  const activeOrdersCount = (state.workOrders || []).filter(o => ['active', 'draft', 'pending_stock'].includes(o.status)).length;

  const navItems: { id: Page; label: string; icon: string; badge?: number; badgeColor?: string }[] = [
    { id: 'catalog',       label: 'Каталог',         icon: 'LayoutGrid',  badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'destructive' },
    { id: 'assembly',      label: 'Сборка',          icon: 'PackageCheck', badge: activeOrdersCount > 0 ? activeOrdersCount : undefined, badgeColor: 'blue' },
    { id: 'warehouse',     label: 'Склады',          icon: 'Map' },
    { id: 'receipts',      label: 'Приёмка',         icon: 'PackagePlus' },
    { id: 'documents',     label: 'Документы',       icon: 'FileText' },
    { id: 'invoice',       label: 'Накладная',       icon: 'FileSignature' },
    { id: 'dashboard',     label: 'Аналитика',       icon: 'BarChart3' },
    { id: 'nomenclature',  label: 'Номенклатура',    icon: 'List' },
    { id: 'inventory',     label: 'Инвентаризация',  icon: 'ClipboardCheck' },
    { id: 'technician',    label: 'Техник',           icon: 'Wrench' },
    { id: 'partners',      label: 'Партнёры',        icon: 'Users2' },
    { id: 'history',       label: 'История',         icon: 'History' },
    { id: 'labels',        label: 'Этикетки',        icon: 'Printer' },
    { id: 'audit',         label: 'Аудит-лог',       icon: 'Shield' },
    { id: 'settings',      label: 'Настройки',       icon: 'Settings' },
  ];

  const desktopNavVisible = navItems.slice(0, 8);
  const desktopNavHidden = navItems.slice(8);
  const desktopMoreIsActive = desktopNavHidden.some(n => n.id === activePage);

  // Mobile bottom nav — 4 primary + "Ещё" button
  const mobileNavPrimary = navItems.slice(0, 4);
  const mobileNavMore = navItems.slice(4);

  // "Ещё" is active if current page is in the "more" group
  const moreIsActive = mobileNavMore.some(n => n.id === activePage);

  const navigate = (page: Page) => {
    onPageChange(page);
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — чистая шапка */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary">
              <Icon name="Boxes" size={18} className="text-primary-foreground" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-bold text-base tracking-tight text-foreground">StockBase</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">Управление складом</span>
            </div>
          </div>

          {/* Desktop nav — стеклянная пилюля */}
          <nav className="hidden xl:flex items-center gap-1 p-1 rounded-2xl glass-card">
            {desktopNavVisible.map(n => {
              const active = activePage === n.id;
              return (
                <button key={n.id} onClick={() => navigate(n.id)}
                  className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-300 press hover:-translate-y-0.5
                    ${active
                      ? 'text-primary-foreground bg-primary shadow-sm scale-[1.03]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'}`}>
                  <Icon name={n.icon} size={14} className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-6'}`} />
                  {n.label}
                  {n.badge !== undefined && (
                    <span className={`ml-0.5 text-[11px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center leading-none animate-pop-in
                      ${n.badgeColor === 'blue' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                      {n.badge > 9 ? '9+' : n.badge}
                    </span>
                  )}
                </button>
              );
            })}
            {desktopNavHidden.length > 0 && (
              <div ref={desktopMoreRef} className="relative">
                <button onClick={() => setDesktopMoreOpen(!desktopMoreOpen)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium transition-all
                    ${desktopMoreIsActive
                      ? 'text-primary-foreground bg-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'}`}>
                  <Icon name="MoreHorizontal" size={16} />
                </button>
                {desktopMoreOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 glass-card rounded-2xl z-50 p-1.5 animate-fade-in">
                    {desktopNavHidden.map(n => (
                      <button key={n.id} onClick={() => { navigate(n.id); setDesktopMoreOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all
                          ${activePage === n.id
                            ? 'text-primary-foreground bg-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'}`}>
                        <Icon name={n.icon} size={14} />
                        {n.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* QR Scanner button */}
            <button onClick={() => setQrOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary bg-primary/5 hover:bg-primary/15 border border-primary/10 transition-all"
              title="Сканировать QR-код">
              <Icon name="ScanLine" size={16} />
            </button>
            <div ref={notifRef} className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary bg-primary/5 hover:bg-primary/15 border border-primary/10 transition-all"
                title="Уведомления">
                <Icon name="Bell" size={16} />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive ring-2 ring-background" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 glass-card rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <span className="font-semibold text-sm">Уведомления</span>
                    {notifCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">{notifCount}</span>}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {lowStockItems.length > 0 && (
                      <div className="px-4 py-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Icon name="AlertTriangle" size={11} className="text-warning" />Низкий остаток
                        </div>
                        {lowStockItems.slice(0, 5).map(item => (
                          <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="truncate text-foreground">{item.name}</span>
                            <span className={`font-bold tabular-nums shrink-0 ml-2 ${item.quantity === 0 ? 'text-destructive' : 'text-warning'}`}>
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                        {lowStockItems.length > 5 && (
                          <div className="text-xs text-muted-foreground mt-1">и ещё {lowStockItems.length - 5}...</div>
                        )}
                      </div>
                    )}
                    {recentOps.length > 0 && (
                      <div className="px-4 py-2 border-t border-border">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Icon name="ArrowUpDown" size={11} />Последние операции
                        </div>
                        {recentOps.map(op => {
                          const it = state.items.find(i => i.id === op.itemId);
                          return (
                            <div key={op.id} className="flex items-center gap-2 py-1.5 text-sm">
                              <span className={`text-xs font-bold ${op.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                                {op.type === 'in' ? '+' : '−'}{op.quantity}
                              </span>
                              <span className="truncate text-foreground">{it?.name || '—'}</span>
                              <span className="text-xs text-muted-foreground shrink-0 ml-auto">{new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {lowStockItems.length === 0 && recentOps.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        <Icon name="BellOff" size={20} className="mx-auto mb-2 opacity-40" />
                        Нет уведомлений
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setNotifOpen(false); onPageChange('settings'); }}
                    className="w-full px-4 py-2.5 border-t border-border text-xs text-primary hover:bg-muted/50 font-medium transition-colors">
                    Настроить уведомления
                  </button>
                </div>
              )}
            </div>
            <button onClick={toggleDark}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary bg-primary/5 hover:bg-primary/15 border border-primary/10 transition-all">
              <Icon name={state.darkMode ? 'Sun' : 'Moon'} size={15} />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-card text-sm font-medium">
                <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                  {(authUser?.displayName || state.currentUser || 'U').slice(0, 1).toUpperCase()}
                </div>
                <span className="max-w-24 truncate text-foreground">{authUser?.displayName || state.currentUser}</span>
                {authUser?.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/20 text-primary font-semibold">Админ</span>}
                {authUser?.role === 'warehouse' && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-semibold">Склад</span>}
                {authUser?.role === 'viewer' && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted-foreground/15 text-muted-foreground font-semibold">Просмотр</span>}
              </div>
              <button onClick={() => setPwDialogOpen(true)} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary bg-primary/5 hover:bg-primary/15 border border-primary/10 transition-colors" title="Сменить пароль">
                <Icon name="KeyRound" size={15} />
              </button>
              <button onClick={() => logout()} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive bg-primary/5 hover:bg-destructive/10 border border-border transition-colors" title="Выйти">
                <Icon name="LogOut" size={15} />
              </button>
            </div>
            {/* Hamburger for tablet (shown between sm and xl) */}
            <button className="xl:hidden w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary bg-primary/5 hover:bg-primary/15 border border-primary/10 transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Icon name={mobileMenuOpen ? 'X' : 'Menu'} size={18} />
            </button>
          </div>
        </div>

        {/* Tablet dropdown menu — full grid */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-border backdrop-blur-md bg-background/90 px-3 py-3 grid grid-cols-4 sm:grid-cols-8 gap-1.5 animate-fade-in">
            {navItems.map(n => {
              const active = activePage === n.id;
              return (
                <button key={n.id} onClick={() => navigate(n.id)}
                  className={`relative flex flex-col items-center gap-1.5 px-1 py-3 rounded-xl text-[10px] font-medium transition-all
                    ${active
                      ? 'text-primary-foreground bg-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground bg-primary/[0.04] hover:bg-primary/10 border border-border'}`}>
                  <Icon name={n.icon} size={18} />
                  <span className="leading-tight text-center">{n.label}</span>
                  {n.badge !== undefined && (
                    <span className={`absolute top-1 right-1 text-[9px] font-bold rounded-full min-w-3.5 h-3.5 px-1 flex items-center justify-center
                      ${n.badgeColor === 'blue' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                      {n.badge > 9 ? '9+' : n.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Low stock banner */}
      {lowStockCount > 0 && activePage !== 'catalog' && activePage !== 'nomenclature' && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
            <Icon name="AlertTriangle" size={13} className="text-destructive shrink-0" />
            <span className="text-destructive font-medium">
              {lowStockCount} {lowStockCount === 1 ? 'товар' : lowStockCount < 5 ? 'товара' : 'товаров'} с низким остатком
            </span>
            <button onClick={() => navigate('catalog')} className="ml-auto text-destructive/80 hover:text-destructive text-xs underline underline-offset-2">
              Посмотреть
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 pb-28 xl:pb-6 relative">
        {/* Floating objects — catalog only */}
        {activePage === 'catalog' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            {([
              { s: 90,  x: 2,   y: 3,   d: 0,   dr: 7.0, r: 14,  t: 'box'      },
              { s: 54,  x: 79,  y: 2,   d: 1.2, dr: 5.8, r: -18, t: 'box'      },
              { s: 110, x: 87,  y: 42,  d: 0.5, dr: 8.2, r: 28,  t: 'box'      },
              { s: 46,  x: 48,  y: 70,  d: 2.1, dr: 5.0, r: -10, t: 'box'      },
              { s: 72,  x: 12,  y: 55,  d: 0.9, dr: 7.4, r: 22,  t: 'box'      },
              { s: 50,  x: 64,  y: 12,  d: 1.7, dr: 6.1, r: -32, t: 'box'      },
              { s: 120, x: 34,  y: 26,  d: 0.3, dr: 9.0, r: 8,   t: 'box'      },
              { s: 40,  x: 91,  y: 20,  d: 2.6, dr: 5.3, r: 44,  t: 'box'      },
              { s: 62,  x: 22,  y: 78,  d: 1.4, dr: 7.6, r: -16, t: 'box'      },
              { s: 38,  x: 73,  y: 78,  d: 0.7, dr: 4.7, r: 26,  t: 'box'      },
              { s: 78,  x: 52,  y: 38,  d: 1.9, dr: 6.5, r: -4,  t: 'box'      },
              { s: 52,  x: 1,   y: 40,  d: 0.1, dr: 8.8, r: 38,  t: 'box'      },
              { s: 64,  x: 43,  y: 88,  d: 0.6, dr: 7.2, r: 16,  t: 'shelf'    },
              { s: 48,  x: 6,   y: 20,  d: 1.5, dr: 6.0, r: -8,  t: 'shelf'    },
              { s: 56,  x: 58,  y: 60,  d: 2.3, dr: 8.5, r: 5,   t: 'barcode'  },
              { s: 44,  x: 17,  y: 8,   d: 0.8, dr: 5.5, r: -25, t: 'barcode'  },
              { s: 50,  x: 95,  y: 60,  d: 1.1, dr: 7.8, r: 20,  t: 'arrow'    },
              { s: 40,  x: 30,  y: 48,  d: 2.8, dr: 6.3, r: -40, t: 'arrow'    },
              { s: 58,  x: 68,  y: 86,  d: 0.4, dr: 9.2, r: 12,  t: 'tag'      },
              { s: 42,  x: 8,   y: 88,  d: 1.8, dr: 5.2, r: -30, t: 'tag'      },
            ] as {s:number;x:number;y:number;d:number;dr:number;r:number;t:string}[]).map((b, i) => {
              const op = 0.13;
              let svgContent: React.ReactNode;
              if (b.t === 'box') {
                svgContent = <>
                  <rect x="4" y="17" width="32" height="21" rx="2" fill="#6366f1"/>
                  <path d="M4 17 L20 8 L36 17 L20 26 Z" fill="#818cf8"/>
                  <path d="M36 17 L36 38 L20 32 L20 26 Z" fill="#4338ca"/>
                  <line x1="4"  y1="27.5" x2="36" y2="27.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
                  <line x1="20" y1="17"   x2="20" y2="38"   stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
                </>;
              } else if (b.t === 'shelf') {
                svgContent = <>
                  <rect x="2"  y="32" width="36" height="4" rx="1" fill="#6366f1"/>
                  <rect x="2"  y="18" width="36" height="4" rx="1" fill="#6366f1"/>
                  <rect x="2"  y="4"  width="36" height="4" rx="1" fill="#6366f1"/>
                  <rect x="2"  y="4"  width="3"  height="32" rx="1" fill="#4338ca"/>
                  <rect x="35" y="4"  width="3"  height="32" rx="1" fill="#4338ca"/>
                  <rect x="8"  y="22" width="8"  height="10" rx="1" fill="#818cf8"/>
                  <rect x="20" y="22" width="6"  height="10" rx="1" fill="#818cf8"/>
                  <rect x="10" y="8"  width="10" height="10" rx="1" fill="#818cf8"/>
                </>;
              } else if (b.t === 'barcode') {
                svgContent = <>
                  <rect x="2"  y="6"  width="3" height="28" fill="#4338ca"/>
                  <rect x="7"  y="6"  width="2" height="28" fill="#6366f1"/>
                  <rect x="11" y="6"  width="4" height="28" fill="#4338ca"/>
                  <rect x="17" y="6"  width="2" height="28" fill="#6366f1"/>
                  <rect x="21" y="6"  width="3" height="28" fill="#4338ca"/>
                  <rect x="26" y="6"  width="2" height="28" fill="#6366f1"/>
                  <rect x="30" y="6"  width="4" height="28" fill="#4338ca"/>
                  <rect x="36" y="6"  width="2" height="28" fill="#6366f1"/>
                  <rect x="2"  y="36" width="36" height="3"  rx="1" fill="#818cf8"/>
                </>;
              } else if (b.t === 'arrow') {
                svgContent = <>
                  <circle cx="20" cy="20" r="17" fill="#6366f1"/>
                  <path d="M20 10 L20 28 M12 21 L20 30 L28 21" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                </>;
              } else {
                svgContent = <>
                  <rect x="4"  y="4"  width="32" height="32" rx="4" fill="#6366f1"/>
                  <rect x="10" y="2"  width="20" height="6"  rx="2" fill="#818cf8"/>
                  <line x1="9"  y1="14" x2="31" y2="14" stroke="white" strokeWidth="2" strokeOpacity="0.5"/>
                  <line x1="9"  y1="20" x2="25" y2="20" stroke="white" strokeWidth="2" strokeOpacity="0.5"/>
                  <line x1="9"  y1="26" x2="28" y2="26" stroke="white" strokeWidth="2" strokeOpacity="0.5"/>
                </>;
              }
              return (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${b.x}%`, top: `${b.y}%`,
                  width: b.s, height: b.s,
                  animation: `catalogFloat ${b.dr}s ease-in-out ${b.d}s infinite`,
                  rotate: `${b.r}deg`,
                  opacity: op,
                }}>
                  <svg viewBox="0 0 40 40" fill="none" width={b.s} height={b.s}>
                    {svgContent}
                  </svg>
                </div>
              );
            })}
            <style>{`
              @keyframes catalogFloat {
                0%,100% { translate: 0 0px;   }
                50%     { translate: 0 -22px; }
              }
            `}</style>
          </div>
        )}
        <div key={activePage} className="page-enter relative z-10">
          {children}
        </div>
      </main>

      <ChangePasswordDialog open={pwDialogOpen} onClose={() => setPwDialogOpen(false)} />

      {/* QR Scanner Modal */}
      <QRScanner
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onResult={result => {
          setQrOpen(false);
          if (result.type === 'item')     { onPageChange('catalog');    onQRResult?.(result.type, result.id); }
          if (result.type === 'location') { onPageChange('warehouse');  onQRResult?.(result.type, result.id); }
          if (result.type === 'order')    { onPageChange('assembly');   onQRResult?.(result.type, result.id); }

          if (result.type === 'unknown')  { onQRResult?.(result.type, result.raw); }
        }}
      />

      {/* Mobile bottom nav — плавающая капсула */}
      <nav className="xl:hidden fixed bottom-3 left-3 right-3 z-40 safe-bottom">
        <div className="glass-card rounded-2xl flex h-16 shadow-xl">
          {mobileNavPrimary.map(n => {
            const active = activePage === n.id;
            return (
              <button key={n.id} onClick={() => navigate(n.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all press relative
                  ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                {active && (
                  <span className="absolute inset-x-3 inset-y-1.5 rounded-xl bg-primary shadow-sm -z-0 animate-pop-in" />
                )}
                <Icon name={n.icon} size={20} className={`relative z-10 transition-transform duration-300 ${active ? 'scale-110 -translate-y-0.5' : ''}`} />
                <span className="leading-tight mt-0.5 relative z-10">{n.label}</span>
                {n.badge !== undefined && (
                  <span className={`absolute top-1.5 right-[calc(50%-16px)] text-[9px] font-bold rounded-full min-w-3.5 h-3.5 px-1 flex items-center justify-center z-10
                    ${n.badgeColor === 'blue' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                    {n.badge > 9 ? '9+' : n.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div ref={moreRef} className="relative flex-1">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`w-full h-full flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all relative
                ${moreIsActive ? 'text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {moreIsActive && (
                <span className="absolute inset-x-3 inset-y-1.5 rounded-xl bg-primary shadow-sm -z-0" />
              )}
              <Icon name={moreMenuOpen ? 'X' : 'MoreHorizontal'} size={20} className="relative z-10" />
              <span className="leading-tight mt-0.5 relative z-10">Ещё</span>
              {mobileNavMore.some(n => n.badge) && !moreMenuOpen && (
                <span className="absolute top-1.5 right-[calc(50%-16px)] text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center bg-destructive text-destructive-foreground z-10">!</span>
              )}
            </button>

            {moreMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 glass-card rounded-2xl overflow-hidden animate-scale-in shadow-xl">
                <div className="p-1.5">
                  {mobileNavMore.map(n => {
                    const active = activePage === n.id;
                    return (
                      <button
                        key={n.id}
                        onClick={() => navigate(n.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                          ${active ? 'text-primary-foreground bg-primary shadow-sm' : 'text-foreground hover:bg-primary/10'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                          ${active ? 'bg-white/20 text-primary-foreground' : 'bg-primary/10 text-muted-foreground'}`}>
                          <Icon name={n.icon} size={15} />
                        </div>
                        <span>{n.label}</span>
                        {n.badge !== undefined && (
                          <span className={`ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full
                            ${n.badgeColor === 'blue' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                            {n.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}