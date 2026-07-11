import { useMemo } from "react";
import { subDays, startOfDay, isAfter, format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Icon from "@/components/ui/icon";
import { AppState } from "@/data/store";
import AdvancedAnalytics from "@/pages/dashboard/AdvancedAnalytics";

type Props = {
  state: AppState;
};

const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const FALLBACK_COLORS = [
  "#a855f7",
  "#d946ef",
  "#8b5cf6",
  "#c084fc",
  "#ec4899",
  "#7c3aed",
  "#22d3ee",
];

export default function DashboardPage({ state }: Props) {
  const now = new Date();

  // ── Summary data ──────────────────────────────────────────────────────────
  const totalItems = state.items.length;
  const totalWarehouses = state.warehouses.length;

  const lowStockItems = useMemo(
    () => state.items.filter((i) => i.quantity <= i.lowStockThreshold),
    [state.items]
  );

  const ops30d = useMemo(() => {
    const threshold = startOfDay(subDays(now, 30));
    return state.operations.filter((op) =>
      isAfter(parseISO(op.date), threshold)
    );
  }, [state.operations]);

  // ── Bar chart: last 7 days ────────────────────────────────────────────────
  const barData = useMemo(() => {
    const days: { date: Date; label: string; in: number; out: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(subDays(now, i));
      const dayName = DAY_NAMES[d.getDay()];
      const dateLabel = format(d, "dd.MM");
      days.push({ date: d, label: `${dayName} ${dateLabel}`, in: 0, out: 0 });
    }

    state.operations.forEach((op) => {
      const opDate = startOfDay(parseISO(op.date));
      const entry = days.find((d) => d.date.getTime() === opDate.getTime());
      if (entry) {
        if (op.type === "in") entry.in += op.quantity;
        else entry.out += op.quantity;
      }
    });

    return days.map((d) => ({
      name: d.label,
      Приход: d.in,
      Расход: d.out,
    }));
  }, [state.operations]);

  // ── Pie chart: by category ────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    state.items.forEach((item) => {
      const prev = map.get(item.categoryId) || 0;
      map.set(item.categoryId, prev + item.quantity);
    });

    const catMap = new Map(state.categories.map((c) => [c.id, c]));

    return Array.from(map.entries()).map(([catId, qty], idx) => {
      const cat = catMap.get(catId);
      return {
        name: cat?.name ?? "Без категории",
        value: qty,
        color: cat?.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      };
    });
  }, [state.items, state.categories]);

  // ── Low stock table (sorted, max 10) ──────────────────────────────────────
  const lowStockTable = useMemo(() => {
    const catMap = new Map(state.categories.map((c) => [c.id, c]));
    return [...lowStockItems]
      .sort((a, b) => {
        const ratioA =
          a.lowStockThreshold > 0 ? a.quantity / a.lowStockThreshold : 0;
        const ratioB =
          b.lowStockThreshold > 0 ? b.quantity / b.lowStockThreshold : 0;
        return ratioA - ratioB;
      })
      .slice(0, 10)
      .map((item) => ({
        ...item,
        categoryName: catMap.get(item.categoryId)?.name ?? "—",
      }));
  }, [lowStockItems, state.categories]);

  // ── Recent operations (last 10) ───────────────────────────────────────────
  const recentOps = useMemo(() => {
    const itemMap = new Map(state.items.map((i) => [i.id, i]));
    return [...state.operations]
      .sort(
        (a, b) =>
          parseISO(b.date).getTime() - parseISO(a.date).getTime()
      )
      .slice(0, 10)
      .map((op) => ({
        ...op,
        itemName: itemMap.get(op.itemId)?.name ?? "Неизвестный товар",
        formattedDate: format(parseISO(op.date), "dd.MM HH:mm"),
      }));
  }, [state.operations, state.items]);

  // Метрики для круговых индикаторов (фото 4 и 5)
  const lowStockPct = totalItems > 0 ? Math.round((lowStockItems.length / totalItems) * 100) : 0;
  const ops7d = ops30d.length; // используем для интенсивности

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Hero header — стиль фото 5 (Aaru welcome) */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 glass-card">
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Stockbase · Neon</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-fuchsia-400 bg-clip-text text-transparent">
              Аналитика склада
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md">
              Живой пульс ваших товаров: остатки, движения и риски — в одном окне.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl glass-card text-xs text-muted-foreground">
            <Icon name="Sparkles" size={14} className="text-primary" />
            {format(now, "EEEE · dd MMM HH:mm")}
          </div>
        </div>
      </div>

      {/* Summary Cards — круговые метрики в стиле фото 4 (Skill Points) и фото 5 (Productivity) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <RingCard
          icon="Package"
          value={totalItems}
          label="Всего товаров"
          percent={100}
          color="violet"
        />
        <RingCard
          icon="AlertTriangle"
          value={lowStockItems.length}
          label="Низкий остаток"
          percent={lowStockPct}
          color="rose"
        />
        <RingCard
          icon="ArrowUpDown"
          value={ops7d}
          label="Операций / 30 дн"
          percent={Math.min(100, Math.round(ops7d / 3))}
          color="fuchsia"
        />
        <RingCard
          icon="Warehouse"
          value={totalWarehouses}
          label="Складов"
          percent={100}
          color="cyan"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart — стиль фото 4 Skill Tracker (неоновые столбцы) */}
        <div className="glass-card rounded-3xl p-5 card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="Activity" size={16} className="text-primary" />
              Приход / Расход за 7 дней
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <defs>
                <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="g-out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f472b6" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#be185d" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                cursor={{ fill: 'rgba(168,85,247,0.08)' }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid rgba(192,132,252,0.3)",
                  borderRadius: 12,
                  fontSize: 13,
                  boxShadow: "0 12px 32px -8px rgba(168,85,247,0.4)",
                }}
              />
              <Legend />
              <Bar dataKey="Приход" fill="url(#g-in)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Расход" fill="url(#g-out)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="glass-card rounded-3xl p-5 card-hover">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Icon name="PieChart" size={16} className="text-primary" />
            По категориям
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                paddingAngle={2}
                label={(entry: { percent: number }) =>
                  entry.percent >= 0.05 ? `${(entry.percent * 100).toFixed(0)}%` : ''
                }
                labelLine={false}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid rgba(192,132,252,0.3)",
                  borderRadius: 12,
                  fontSize: 13,
                  boxShadow: "0 12px 32px -8px rgba(168,85,247,0.4)",
                }}
                formatter={(value: number, name: string) => [`${value} шт.`, name]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={10}
                formatter={(value: string) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Table */}
        <div className="glass-card rounded-3xl p-5 card-hover">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Icon name="AlertTriangle" size={16} className="text-rose-400" />
            Товары с низким остатком
          </h3>
          {lowStockTable.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Icon name="CheckCircle" className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Все остатки в норме</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-0">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium">Название</th>
                    <th className="pb-2 pr-3 font-medium text-right">Кол-во</th>
                    <th className="pb-2 pr-3 font-medium text-right hidden sm:table-cell">Порог</th>
                    <th className="pb-2 font-medium hidden sm:table-cell">Категория</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockTable.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 break-words align-top max-w-[140px] sm:max-w-[220px] md:max-w-none">
                        {item.name}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold text-red-500 whitespace-nowrap">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-muted-foreground hidden sm:table-cell">
                        {item.lowStockThreshold}
                      </td>
                      <td className="py-2.5 text-muted-foreground truncate max-w-[120px] hidden sm:table-cell">
                        {item.categoryName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Operations Table */}
        <div className="glass-card rounded-3xl p-5 card-hover">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Icon name="History" size={16} className="text-primary" />
            Последние операции
          </h3>
          {recentOps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Icon name="Inbox" className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Нет операций</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-0">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Дата</th>
                    <th className="pb-2 pr-3 font-medium">Товар</th>
                    <th className="pb-2 pr-3 font-medium">Тип</th>
                    <th className="pb-2 pr-3 font-medium text-right">Кол-во</th>
                    <th className="pb-2 font-medium hidden sm:table-cell">Исполнитель</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOps.map((op) => (
                    <tr key={op.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground hidden sm:table-cell">
                        {op.formattedDate}
                      </td>
                      <td className="py-2.5 pr-3 break-words align-top max-w-[120px] sm:max-w-[220px] md:max-w-none">
                        {op.itemName}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            op.type === "in"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {op.type === "in" ? "Приход" : "Расход"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">{op.quantity}</td>
                      <td className="py-2.5 text-muted-foreground truncate max-w-[120px] hidden sm:table-cell">
                        {op.performedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Расширенная аналитика — сворачиваемые секции */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="BarChart3" size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Детальная аналитика</h2>
          <span className="text-xs text-muted-foreground">— фильтры и срезы по периодам, получателям, складам, поставщикам</span>
        </div>
        <AdvancedAnalytics state={state} />
      </div>
    </div>
  );
}

// ── Ring Card — круговая метрика в стиле фото 4 / 5 ─────────────────────────

const RING_PALETTE = {
  violet:  { from: "#a855f7", to: "#7c3aed", glow: "rgba(168,85,247,0.55)" },
  fuchsia: { from: "#d946ef", to: "#a21caf", glow: "rgba(217,70,239,0.55)" },
  rose:    { from: "#fb7185", to: "#e11d48", glow: "rgba(244,63,94,0.55)"  },
  cyan:    { from: "#22d3ee", to: "#06b6d4", glow: "rgba(34,211,238,0.50)" },
} as const;

function RingCard({
  icon,
  value,
  label,
  percent,
  color,
}: {
  icon: string;
  value: number;
  label: string;
  percent: number; // 0..100
  color: keyof typeof RING_PALETTE;
}) {
  const palette = RING_PALETTE[color];
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  const gradId = `ring-${color}`;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 card-hover relative overflow-hidden">
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none"
        style={{ background: palette.glow }}
      />
      <div className="relative flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={palette.from} />
                <stop offset="100%" stopColor={palette.to} />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r={radius} stroke="hsl(var(--border))" strokeWidth="5" fill="none" opacity="0.35" />
            <circle
              cx="32" cy="32" r={radius}
              stroke={`url(#${gradId})`}
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ filter: `drop-shadow(0 0 6px ${palette.glow})`, transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon name={icon} size={18} className="text-foreground" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-2xl sm:text-3xl font-bold leading-none tracking-tight">{value}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">{label}</p>
        </div>
      </div>
    </div>
  );
}