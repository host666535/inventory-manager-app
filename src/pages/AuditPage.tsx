import { AppState } from '@/data/store';
import { useAuditEvents } from './audit/useAuditEvents';
import AuditFilters from './audit/AuditFilters';
import AuditTimeline from './audit/AuditTimeline';

type Props = {
  state: AppState;
};

export default function AuditPage({ state }: Props) {
  const a = useAuditEvents(state);

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <AuditFilters
        totalEvents={a.allEvents.length}
        filteredCount={a.filteredEvents.length}
        typeCounts={a.typeCounts}
        typeFilter={a.typeFilter}
        setTypeFilter={a.setTypeFilter}
        userFilter={a.userFilter}
        setUserFilter={a.setUserFilter}
        search={a.search}
        setSearch={a.setSearch}
        dateFrom={a.dateFrom}
        setDateFrom={a.setDateFrom}
        dateTo={a.dateTo}
        setDateTo={a.setDateTo}
        uniqueUsers={a.uniqueUsers}
        activeFilters={a.activeFilters}
        resetFilters={a.resetFilters}
        setVisibleCount={a.setVisibleCount}
      />

      <AuditTimeline
        filteredCount={a.filteredEvents.length}
        totalEvents={a.allEvents.length}
        groupedEvents={a.groupedEvents}
        hasMore={a.hasMore}
        visibleCount={a.visibleCount}
        activeFilters={a.activeFilters}
        resetFilters={a.resetFilters}
        setVisibleCount={a.setVisibleCount}
      />
    </div>
  );
}
