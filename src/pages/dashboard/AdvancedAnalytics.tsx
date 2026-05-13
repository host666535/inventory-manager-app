import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';

type Props = { state: AppState };

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

const FALLBACK_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#a855f7', '#84cc16'];

function dateOnly(d: Date | string): Date {
  const x = typeof d === 'string' ? new Date(d) : new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodRange(period: Period, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  if (period === 'all') return { from: null, to: null };
  if (period === 'custom') {
    return {
      from: customFrom ? dateOnly(customFrom) : null,
      to: customTo ? dateOnly(customTo) : null,
    };
  }
  const to = dateOnly(new Date());
  const from = new Date(to);
  if (period === 'today') {
    // оставляем сегодня
  } else if (period === 'week') from.setDate(to.getDate() - 6);
  else if (period === 'month') from.setDate(to.getDate() - 29);
  else if (period === 'quarter') from.setDate(to.getDate() - 89);
  else if (period === 'year') from.setDate(to.getDate() - 364);
  return { from, to };
}

function Section({
  title, icon, defaultOpen = false, children,
}: { title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-xl border shadow-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name={icon} size={16} className="text-primary" />
          <span className="font-semibold">{title}</span>
        </div>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground" />
      </button>
      {open && <div className="border-t p-5">{children}</div>}
    </div>
  );
}

export function AdvancedAnalytics({ state }: Props) {
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  // Map lookups
  const itemMap = useMemo(() => new Map(state.items.map(i => [i.id, i])), [state.items]);
  const categoryMap = useMemo(() => new Map(state.categories.map(c => [c.id, c])), [state.categories]);
  const warehouseMap = useMemo(() => new Map((state.warehouses || []).map(w => [w.id, w])), [state.warehouses]);
  const orderMap = useMemo(() => new Map((state.workOrders || []).map(o => [o.id, o])), [state.workOrders]);
  const partnerByName = useMemo(() => new Map((state.partners || []).map(p => [p.name, p])), [state.partners]);
  const receipts = state.receipts || [];

  // Operations in range
  const ops = useMemo(() => {
    return (state.operations || []).filter(op => {
      if (warehouseFilter !== 'all' && op.warehouseId !== warehouseFilter) return false;
      const it = itemMap.get(op.itemId);
      if (!it) return false;
      if (categoryFilter !== 'all' && it.categoryId !== categoryFilter) return false;
      const d = new Date(op.date);
      if (range.from && d < range.from) return false;
      if (range.to) {
        const toEnd = new Date(range.to);
        toEnd.setHours(23, 59, 59, 999);
        if (d > toEnd) return false;
      }
      return true;
    });
  }, [state.operations, itemMap, range, warehouseFilter, categoryFilter]);

  // ── Линейный график: приход vs расход по дням ────────────────────────────
  const lineData = useMemo(() => {
    if (!range.from || !range.to) {
      // если "Всё время" — соберём по 30 последним дням
      const today = dateOnly(new Date());
      const buckets: { date: string; in: number; out: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        buckets.push({ date: fmtDate(d), in: 0, out: 0 });
      }
      const idx = new Map(buckets.map((b, i) => [b.date, i]));
      for (const op of ops) {
        const k = fmtDate(dateOnly(new Date(op.date)));
        const i = idx.get(k);
        if (i === undefined) continue;
        if (op.type === 'in') buckets[i].in += op.quantity;
        else buckets[i].out += op.quantity;
      }
      return buckets.map(b => ({ date: b.date.slice(5), Приход: b.in, Расход: b.out }));
    }
    const buckets: { date: string; in: number; out: number }[] = [];
    const cur = new Date(range.from);
    while (cur <= range.to) {
      buckets.push({ date: fmtDate(cur), in: 0, out: 0 });
      cur.setDate(cur.getDate() + 1);
    }
    const idx = new Map(buckets.map((b, i) => [b.date, i]));
    for (const op of ops) {
      const k = fmtDate(dateOnly(new Date(op.date)));
      const i = idx.get(k);
      if (i === undefined) continue;
      if (op.type === 'in') buckets[i].in += op.quantity;
      else buckets[i].out += op.quantity;
    }
    return buckets.map(b => ({ date: b.date.slice(5), Приход: b.in, Расход: b.out }));
  }, [ops, range]);

  // ── Топ получателей ─────────────────────────────────────────────────────
  const topRecipients = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; count: number; itemSet: Set<string> }>();
    for (const op of ops) {
      if (op.type !== 'out') continue;
      const order = op.orderId ? orderMap.get(op.orderId) : undefined;
      const name = order?.recipientName || op.to || 'Без получателя';
      const partner = partnerByName.get(name);
      const key = partner?.department || name;
      let row = map.get(key);
      if (!row) {
        row = { name: key, qty: 0, count: 0, itemSet: new Set() };
        map.set(key, row);
      }
      row.qty += op.quantity;
      row.count += 1;
      row.itemSet.add(op.itemId);
    }
    return Array.from(map.values())
      .map(r => ({ name: r.name, qty: r.qty, count: r.count, uniqueItems: r.itemSet.size }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [ops, orderMap, partnerByName]);

  // ── По категориям (расход) ───────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const op of ops) {
      if (op.type !== 'out') continue;
      const item = itemMap.get(op.itemId);
      if (!item) continue;
      map.set(item.categoryId, (map.get(item.categoryId) || 0) + op.quantity);
    }
    return Array.from(map.entries()).map(([catId, qty], i) => {
      const cat = categoryMap.get(catId);
      return {
        name: cat?.name || 'Без категории',
        value: qty,
        color: cat?.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      };
    }).sort((a, b) => b.value - a.value);
  }, [ops, itemMap, categoryMap]);

  // ── Топ позиций по расходу ──────────────────────────────────────────────
  const topItemsOut = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; qty: number; count: number; category: string; color: string }>();
    for (const op of ops) {
      if (op.type !== 'out') continue;
      const item = itemMap.get(op.itemId);
      if (!item) continue;
      const cat = categoryMap.get(item.categoryId);
      let row = map.get(op.itemId);
      if (!row) {
        row = { name: item.name, unit: item.unit, qty: 0, count: 0, category: cat?.name || '—', color: cat?.color || '#888' };
        map.set(op.itemId, row);
      }
      row.qty += op.quantity;
      row.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 20);
  }, [ops, itemMap, categoryMap]);

  // ── По складам ──────────────────────────────────────────────────────────
  const byWarehouse = useMemo(() => {
    const map = new Map<string, { name: string; inQty: number; outQty: number; operations: number }>();
    for (const op of ops) {
      const whId = op.warehouseId || '__none__';
      const wh = whId === '__none__' ? null : warehouseMap.get(whId);
      const name = wh?.name || 'Без склада';
      let row = map.get(whId);
      if (!row) {
        row = { name, inQty: 0, outQty: 0, operations: 0 };
        map.set(whId, row);
      }
      if (op.type === 'in') row.inQty += op.quantity;
      else row.outQty += op.quantity;
      row.operations += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.operations - a.operations);
  }, [ops, warehouseMap]);

  // ── Мёртвый груз: > 90 дней без операций, но quantity > 0 ──────────────
  const deadStock = useMemo(() => {
    const lastOpByItem = new Map<string, Date>();
    for (const op of state.operations || []) {
      const d = new Date(op.date);
      const cur = lastOpByItem.get(op.itemId);
      if (!cur || d > cur) lastOpByItem.set(op.itemId, d);
    }
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 90);
    return state.items
      .filter(it => it.quantity > 0)
      .map(it => ({
        ...it,
        lastOp: lastOpByItem.get(it.id),
        categoryName: categoryMap.get(it.categoryId)?.name || '—',
      }))
      .filter(it => !it.lastOp || it.lastOp < threshold)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);
  }, [state.operations, state.items, categoryMap]);

  // ── Самые ходовые (по числу операций) ──────────────────────────────────
  const mostActive = useMemo(() => {
    const map = new Map<string, { name: string; ops: number; unit: string }>();
    for (const op of ops) {
      const item = itemMap.get(op.itemId);
      if (!item) continue;
      let row = map.get(op.itemId);
      if (!row) {
        row = { name: item.name, ops: 0, unit: item.unit };
        map.set(op.itemId, row);
      }
      row.ops += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.ops - a.ops).slice(0, 15);
  }, [ops, itemMap]);

  // ── Заканчивается (quantity <= lowStockThreshold && quantity > 0) ──────
  const runningOut = useMemo(() => {
    return state.items
      .filter(it => it.quantity > 0 && it.quantity <= it.lowStockThreshold)
      .map(it => ({ ...it, categoryName: categoryMap.get(it.categoryId)?.name || '—' }))
      .sort((a, b) => (a.quantity / a.lowStockThreshold) - (b.quantity / b.lowStockThreshold))
      .slice(0, 20);
  }, [state.items, categoryMap]);

  // ── Поставщики (по receipts) ────────────────────────────────────────────
  const topSuppliers = useMemo(() => {
    const map = new Map<string, { name: string; sumQty: number; sumAmount: number; receipts: number; prices: number[] }>();
    for (const r of receipts) {
      const d = new Date(r.date);
      if (range.from && d < range.from) continue;
      if (range.to) {
        const toEnd = new Date(range.to);
        toEnd.setHours(23, 59, 59, 999);
        if (d > toEnd) continue;
      }
      const name = r.supplierName || 'Без поставщика';
      let row = map.get(name);
      if (!row) {
        row = { name, sumQty: 0, sumAmount: 0, receipts: 0, prices: [] };
        map.set(name, row);
      }
      row.receipts += 1;
      for (const l of r.lines) {
        row.sumQty += l.confirmedQty || l.qty;
        if (l.price) {
          row.sumAmount += (l.price * (l.confirmedQty || l.qty));
          row.prices.push(l.price);
        }
      }
    }
    return Array.from(map.values()).map(r => ({
      ...r,
      avgPrice: r.prices.length > 0 ? r.prices.reduce((s, p) => s + p, 0) / r.prices.length : 0,
    })).sort((a, b) => b.sumAmount - a.sumAmount).slice(0, 10);
  }, [receipts, range]);

  // Totals
  const totalIn = ops.filter(o => o.type === 'in').reduce((s, o) => s + o.quantity, 0);
  const totalOut = ops.filter(o => o.type === 'out').reduce((s, o) => s + o.quantity, 0);
  const totalOps = ops.length;
  const uniqueItems = new Set(ops.map(o => o.itemId)).size;

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 13,
  };

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="bg-card rounded-xl border shadow-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="SlidersHorizontal" size={14} className="text-primary" />
          Фильтры аналитики
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'today', label: 'Сегодня' },
            { id: 'week', label: '7 дней' },
            { id: 'month', label: '30 дней' },
            { id: 'quarter', label: '90 дней' },
            { id: 'year', label: 'Год' },
            { id: 'all', label: 'Всё время' },
            { id: 'custom', label: 'Свой период' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as Period)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                ${period === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-border'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="h-8 px-2 text-sm rounded border border-border bg-card" />
            <span className="text-muted-foreground text-sm">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="h-8 px-2 text-sm rounded border border-border bg-card" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(state.warehouses || []).length > 1 && (
            <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border border-border bg-card">
              <option value="all">Все склады</option>
              {(state.warehouses || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="h-8 px-2 text-sm rounded-lg border border-border bg-card">
            <option value="all">Все категории</option>
            {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
          <div className="rounded-lg bg-muted/30 p-2">
            <div className="text-xs text-muted-foreground">Операций</div>
            <div className="text-lg font-bold tabular-nums">{totalOps}</div>
          </div>
          <div className="rounded-lg bg-success/10 p-2">
            <div className="text-xs text-muted-foreground">Принято</div>
            <div className="text-lg font-bold text-success tabular-nums">+{totalIn}</div>
          </div>
          <div className="rounded-lg bg-destructive/10 p-2">
            <div className="text-xs text-muted-foreground">Выдано</div>
            <div className="text-lg font-bold text-destructive tabular-nums">-{totalOut}</div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <div className="text-xs text-muted-foreground">Позиций</div>
            <div className="text-lg font-bold text-primary tabular-nums">{uniqueItems}</div>
          </div>
        </div>
      </div>

      <Section title="Динамика приход / расход" icon="LineChart" defaultOpen>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="Приход" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Расход" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Топ получателей" icon="Users">
        {topRecipients.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Нет данных за выбранный период</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(220, topRecipients.length * 32)}>
              <BarChart data={topRecipients} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={11} />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={11}
                  width={180}
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  interval={0}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, _name: string, props: { payload?: { count?: number; uniqueItems?: number } }) => [
                    `${value} шт. · ${props?.payload?.count ?? 0} операций · ${props?.payload?.uniqueItems ?? 0} позиций`,
                    'Получено',
                  ]}
                />
                <Bar dataKey="qty" fill="#6366f1" radius={[0, 4, 4, 0]} name="Количество" label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--foreground))' }} />
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium">Получатель</th>
                    <th className="pb-2 pr-3 font-medium text-right">Количество</th>
                    <th className="pb-2 pr-3 font-medium text-right">Операций</th>
                    <th className="pb-2 font-medium text-right">Уник. позиций</th>
                  </tr>
                </thead>
                <tbody>
                  {topRecipients.map(r => (
                    <tr key={r.name} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium break-words">{r.name}</td>
                      <td className="py-2 pr-3 text-right font-bold tabular-nums">{r.qty}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{r.count}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{r.uniqueItems}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section title="Расход по категориям" icon="PieChart">
        {byCategory.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Нет расходов за выбранный период</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  label={(entry: { name: string; value: number; percent: number }) =>
                    `${entry.name}: ${entry.value} (${(entry.percent * 100).toFixed(0)}%)`
                  }
                  labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                >
                  {byCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => [`${value}`, name]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium">Категория</th>
                    <th className="pb-2 font-medium text-right">Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((c, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ background: c.color }} />
                        <span className="font-medium">{c.name}</span>
                      </td>
                      <td className="py-2 text-right font-bold tabular-nums">{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section title="Топ позиций по расходу" icon="TrendingUp">
        {topItemsOut.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Нет расходов</div>
        ) : (
          <div className="space-y-4">
            {/* Горизонтальный bar chart с НАЗВАНИЯМИ позиций по оси Y */}
            <ResponsiveContainer width="100%" height={Math.max(260, topItemsOut.length * 28)}>
              <BarChart data={topItemsOut} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={11} />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={11}
                  width={180}
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  interval={0}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, _name: string, props: { payload?: { unit?: string } }) => [
                    `${value} ${props?.payload?.unit || ''}`,
                    'Расход',
                  ]}
                />
                <Bar dataKey="qty" fill="#ef4444" radius={[0, 4, 4, 0]}>
                  {topItemsOut.map((entry, i) => (
                    <Cell key={i} fill={entry.color || '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium">#</th>
                    <th className="pb-2 pr-3 font-medium">Позиция</th>
                    <th className="pb-2 pr-3 font-medium">Категория</th>
                    <th className="pb-2 pr-3 font-medium text-right">Расход</th>
                    <th className="pb-2 font-medium text-right">Операций</th>
                  </tr>
                </thead>
                <tbody>
                  {topItemsOut.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3 text-xs" style={{ color: r.color }}>{r.category}</td>
                      <td className="py-2 pr-3 text-right font-bold tabular-nums text-destructive">-{r.qty} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span></td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section title="Активность складов" icon="Warehouse">
        {byWarehouse.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Нет операций</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, byWarehouse.length * 60)}>
            <BarChart data={byWarehouse} layout="vertical" margin={{ left: 10, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" fontSize={11} />
              <YAxis
                dataKey="name"
                type="category"
                fontSize={11}
                width={160}
                tick={{ fill: 'hsl(var(--foreground))' }}
                interval={0}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [`${value}`, name]}
              />
              <Legend />
              <Bar dataKey="inQty" stackId="a" fill="#10b981" name="Приход" />
              <Bar dataKey="outQty" stackId="a" fill="#ef4444" name="Расход" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      <Section title="Самые ходовые позиции" icon="Zap">
        {mostActive.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Нет данных</div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={Math.max(220, mostActive.length * 28)}>
              <BarChart data={mostActive} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={11} />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={11}
                  width={180}
                  tick={{ fill: 'hsl(var(--foreground))' }}
                  interval={0}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${value}`, 'Операций']}
                />
                <Bar dataKey="ops" fill="#8b5cf6" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--foreground))' }} />
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium">#</th>
                    <th className="pb-2 pr-3 font-medium">Позиция</th>
                    <th className="pb-2 font-medium text-right">Операций за период</th>
                  </tr>
                </thead>
                <tbody>
                  {mostActive.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 text-right font-bold tabular-nums">{r.ops}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section title="Заканчивается на складе" icon="AlertTriangle">
        {runningOut.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Все остатки в норме</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 pr-3 font-medium">Позиция</th>
                  <th className="pb-2 pr-3 font-medium">Категория</th>
                  <th className="pb-2 pr-3 font-medium text-right">Остаток</th>
                  <th className="pb-2 font-medium text-right">Порог</th>
                </tr>
              </thead>
              <tbody>
                {runningOut.map((it, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{it.name}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{it.categoryName}</td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums text-orange-500">{it.quantity} {it.unit}</td>
                    <td className="py-2 text-right text-xs text-muted-foreground tabular-nums">{it.lowStockThreshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Мёртвый груз (без движения > 90 дней)" icon="Box">
        {deadStock.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Нет залежавшегося товара</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 pr-3 font-medium">Позиция</th>
                  <th className="pb-2 pr-3 font-medium">Категория</th>
                  <th className="pb-2 pr-3 font-medium text-right">На складе</th>
                  <th className="pb-2 font-medium">Последнее движение</th>
                </tr>
              </thead>
              <tbody>
                {deadStock.map((it, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{it.name}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{it.categoryName}</td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">{it.quantity} {it.unit}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {it.lastOp ? it.lastOp.toLocaleDateString('ru-RU') : 'Никогда'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Поставщики" icon="Truck">
        {topSuppliers.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Нет приходов за период</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 pr-3 font-medium">Поставщик</th>
                  <th className="pb-2 pr-3 font-medium text-right">Приходов</th>
                  <th className="pb-2 pr-3 font-medium text-right">Кол-во</th>
                  <th className="pb-2 pr-3 font-medium text-right">Сумма ₽</th>
                  <th className="pb-2 font-medium text-right">Ср. цена</th>
                </tr>
              </thead>
              <tbody>
                {topSuppliers.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{s.receipts}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold">{s.sumQty}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-bold">{s.sumAmount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{s.avgPrice > 0 ? s.avgPrice.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

export default AdvancedAnalytics;