import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AuditEventType, PAGE_SIZE, TYPE_FILTER_OPTIONS } from './utils';

// ─── StatPill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${color}`}
    >
      <Icon name={icon} size={12} />
      {label}: {count}
    </div>
  );
}

type Props = {
  totalEvents: number;
  filteredCount: number;
  typeCounts: Partial<Record<AuditEventType, number>>;
  typeFilter: 'all' | AuditEventType;
  setTypeFilter: (v: 'all' | AuditEventType) => void;
  userFilter: string;
  setUserFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  uniqueUsers: string[];
  activeFilters: number;
  resetFilters: () => void;
  setVisibleCount: (v: number) => void;
};

export default function AuditFilters({
  totalEvents, filteredCount, typeCounts,
  typeFilter, setTypeFilter,
  userFilter, setUserFilter,
  search, setSearch,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  uniqueUsers, activeFilters, resetFilters, setVisibleCount,
}: Props) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Аудит-лог</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalEvents} событий &middot; все действия в системе
          </p>
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex flex-wrap gap-2">
        <StatPill
          label="Приход"
          count={typeCounts.operation_in || 0}
          color="bg-success/15 text-success"
          icon="ArrowDownLeft"
        />
        <StatPill
          label="Расход"
          count={typeCounts.operation_out || 0}
          color="bg-destructive/15 text-destructive"
          icon="ArrowUpRight"
        />
        <StatPill
          label="Заявки"
          count={(typeCounts.order_created || 0) + (typeCounts.order_completed || 0)}
          color="bg-blue-500/15 text-blue-600 dark:text-blue-400"
          icon="PackageCheck"
        />
        <StatPill
          label="Приёмки"
          count={(typeCounts.receipt_created || 0) + (typeCounts.receipt_posted || 0)}
          color="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          icon="PackagePlus"
        />
        <StatPill
          label="Документы"
          count={typeCounts.doc_created || 0}
          color="bg-violet-500/15 text-violet-600 dark:text-violet-400"
          icon="FileText"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value as 'all' | AuditEventType);
              setVisibleCount(PAGE_SIZE);
            }}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            {TYPE_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* User filter */}
          <select
            value={userFilter}
            onChange={e => {
              setUserFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="all">Все пользователи</option>
            {uniqueUsers.map(u => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          {activeFilters > 0 && (
            <button
              onClick={resetFilters}
              className="h-9 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors"
            >
              <Icon name="X" size={13} />
              Сбросить ({activeFilters})
            </button>
          )}
        </div>

        {/* Search + date range */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-0 sm:min-w-48">
            <Icon
              name="Search"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              placeholder="Поиск по описанию, пользователю..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-9 text-sm flex-1 sm:w-36 sm:flex-none"
            />
            <span className="text-muted-foreground text-sm">&mdash;</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-9 text-sm flex-1 sm:w-36 sm:flex-none"
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      {activeFilters > 0 && filteredCount !== totalEvents && (
        <div className="text-sm text-muted-foreground">
          Найдено: <span className="font-semibold text-foreground">{filteredCount}</span>{' '}
          из {totalEvents} событий
        </div>
      )}
    </>
  );
}
