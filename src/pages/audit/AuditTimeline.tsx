import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  AuditEvent,
  PAGE_SIZE,
  TYPE_LABELS,
  formatDateTime,
  getBorderColor,
  getIconBg,
  getTypeBadge,
} from './utils';

// ─── EventRow ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: AuditEvent }) {
  const borderColor = getBorderColor(event.type);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg bg-card border border-border shadow-card transition-colors hover:bg-muted/30 border-l-[3px] ${borderColor}`}
    >
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${getIconBg(event.type)}`}
      >
        <Icon name={event.icon} size={15} className={event.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {event.description}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getTypeBadge(event.type)}`}
            >
              {TYPE_LABELS[event.type]}
            </span>
          </div>
        </div>

        {event.details && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.details}</p>
        )}

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 tabular-nums">
            <Icon name="Clock" size={11} />
            {formatDateTime(event.date)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="User" size={11} />
            {event.user}
          </span>
        </div>
      </div>
    </div>
  );
}

type Props = {
  filteredCount: number;
  totalEvents: number;
  groupedEvents: { label: string; events: AuditEvent[] }[];
  hasMore: boolean;
  visibleCount: number;
  activeFilters: number;
  resetFilters: () => void;
  setVisibleCount: (fn: (prev: number) => number) => void;
};

export default function AuditTimeline({
  filteredCount, totalEvents, groupedEvents, hasMore, visibleCount,
  activeFilters, resetFilters, setVisibleCount,
}: Props) {
  if (filteredCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon name="Shield" size={28} className="text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          {totalEvents === 0 ? 'Лог пуст' : 'Событий не найдено'}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {totalEvents === 0
            ? 'Записи появятся по мере работы с системой'
            : 'Попробуйте изменить фильтры или поисковый запрос'}
        </p>
        {activeFilters > 0 && (
          <button
            onClick={resetFilters}
            className="mt-3 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            Сбросить фильтры
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedEvents.map(group => (
        <div key={group.label}>
          {/* Group header */}
          <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm pb-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground tabular-nums">
                {group.events.length}
              </span>
            </div>
          </div>

          {/* Events */}
          <div className="space-y-1">
            {group.events.map(event => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <Button
            variant="outline"
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="gap-2"
          >
            <Icon name="ChevronDown" size={15} />
            Показать ещё ({filteredCount - visibleCount} осталось)
          </Button>
        </div>
      )}
    </div>
  );
}
