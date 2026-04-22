import { useState, useMemo, useCallback } from 'react';
import { AppState } from '@/data/store';
import { AuditEvent, AuditEventType, PAGE_SIZE, safeParse, getDateGroup } from './utils';

export function useAuditEvents(state: AppState) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AuditEventType>('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ── Build item map for O(1) lookups ──────────────────────────────────────

  const itemMap = useMemo(
    () => new Map(state.items.map(i => [i.id, i])),
    [state.items],
  );

  // ── Build all audit events ───────────────────────────────────────────────

  const allEvents = useMemo<AuditEvent[]>(() => {
    const events: AuditEvent[] = [];

    // 1. Operations
    for (const op of state.operations || []) {
      const item = itemMap.get(op.itemId);
      const itemName = item?.name ?? 'Неизвестный товар';
      const isIn = op.type === 'in';

      events.push({
        id: `op-${op.id}`,
        date: op.date,
        type: isIn ? 'operation_in' : 'operation_out',
        user: op.performedBy || 'Система',
        description: `${isIn ? 'Приход' : 'Расход'}: ${itemName} \u00d7 ${op.quantity}`,
        details: op.comment || undefined,
        icon: isIn ? 'ArrowDownLeft' : 'ArrowUpRight',
        color: isIn ? 'text-success' : 'text-destructive',
      });
    }

    // 2. Work Orders
    for (const order of state.workOrders || []) {
      // Created event
      events.push({
        id: `ord-c-${order.id}`,
        date: order.createdAt,
        type: 'order_created',
        user: order.createdBy || 'Система',
        description: `Заявка создана: ${order.title}`,
        details: order.number ? `${order.number}` : undefined,
        icon: 'PackageCheck',
        color: 'text-blue-500',
      });

      // Completed event (assembled or closed)
      if (order.status === 'assembled' || order.status === 'closed') {
        events.push({
          id: `ord-d-${order.id}`,
          date: order.updatedAt,
          type: 'order_completed',
          user: order.createdBy || 'Система',
          description: `Заявка ${order.status === 'assembled' ? 'собрана' : 'закрыта'}: ${order.title}`,
          details: order.number ? `${order.number}` : undefined,
          icon: 'PackageCheck',
          color: 'text-blue-500',
        });
      }
    }

    // 3. Receipts
    for (const receipt of state.receipts || []) {
      // Created event
      events.push({
        id: `rcpt-c-${receipt.id}`,
        date: receipt.date,
        type: 'receipt_created',
        user: receipt.createdBy || 'Система',
        description: `Приёмка создана: \u2116${receipt.number} от ${receipt.supplierName}`,
        details: receipt.comment || undefined,
        icon: 'PackagePlus',
        color: 'text-amber-500',
      });

      // Posted event
      if (receipt.postedAt) {
        events.push({
          id: `rcpt-p-${receipt.id}`,
          date: receipt.postedAt,
          type: 'receipt_posted',
          user: receipt.createdBy || 'Система',
          description: `Приёмка проведена: \u2116${receipt.number}`,
          details: `${receipt.lines?.length ?? 0} позиций`,
          icon: 'PackagePlus',
          color: 'text-amber-500',
        });
      }
    }

    // 4. Tech Docs
    for (const doc of state.techDocs || []) {
      events.push({
        id: `doc-${doc.id}`,
        date: doc.createdAt,
        type: 'doc_created',
        user: doc.createdBy || 'Система',
        description: `Документ создан: ${doc.docType}${doc.docNumber ? ` ${doc.docNumber}` : ''}`,
        details: doc.notes || undefined,
        icon: 'FileText',
        color: 'text-violet-500',
      });
    }

    // Sort by date descending
    events.sort((a, b) => {
      const da = safeParse(a.date).getTime();
      const db = safeParse(b.date).getTime();
      return db - da;
    });

    return events;
  }, [state.operations, state.workOrders, state.receipts, state.techDocs, itemMap]);

  // ── Unique users for filter dropdown ─────────────────────────────────────

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    for (const e of allEvents) {
      if (e.user) users.add(e.user);
    }
    return Array.from(users).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [allEvents]);

  // ── Filtered events ──────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    let list = allEvents;

    if (typeFilter !== 'all') {
      list = list.filter(e => e.type === typeFilter);
    }

    if (userFilter !== 'all') {
      list = list.filter(e => e.user === userFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        e =>
          e.description.toLowerCase().includes(q) ||
          (e.details?.toLowerCase().includes(q) ?? false) ||
          e.user.toLowerCase().includes(q),
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter(e => safeParse(e.date) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59');
      list = list.filter(e => safeParse(e.date) <= to);
    }

    return list;
  }, [allEvents, typeFilter, userFilter, search, dateFrom, dateTo]);

  // ── Stats by type ────────────────────────────────────────────────────────

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<AuditEventType, number>> = {};
    for (const e of filteredEvents) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    return counts;
  }, [filteredEvents]);

  // ── Visible events (lazy load) ──────────────────────────────────────────

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount],
  );

  const hasMore = filteredEvents.length > visibleCount;

  // ── Grouped by date ──────────────────────────────────────────────────────

  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: AuditEvent[] }[] = [];
    let currentLabel = '';

    for (const event of visibleEvents) {
      const label = getDateGroup(event.date);
      if (label !== currentLabel) {
        groups.push({ label, events: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].events.push(event);
    }

    return groups;
  }, [visibleEvents]);

  // ── Active filters count ─────────────────────────────────────────────────

  const activeFilters = [
    typeFilter !== 'all',
    userFilter !== 'all',
    search !== '',
    dateFrom !== '',
    dateTo !== '',
  ].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setVisibleCount(PAGE_SIZE);
  }, []);

  return {
    // state
    search, setSearch,
    typeFilter, setTypeFilter,
    userFilter, setUserFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    visibleCount, setVisibleCount,
    // derived
    allEvents,
    uniqueUsers,
    filteredEvents,
    typeCounts,
    hasMore,
    groupedEvents,
    activeFilters,
    // actions
    resetFilters,
  };
}
