import { useState, useMemo, useCallback, useEffect } from 'react';
import { AppState, Operation, generateId, crudAction } from '@/data/store';
import { InventoryEntry, ScanFlash, ScanToast, InventoryProgress, InventorySummary } from './types';

export function useInventory(state: AppState, onStateChange: (s: AppState) => void) {
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [started, setStarted] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanLocationFilter, setScanLocationFilter] = useState<string | null>(null);
  const [scanFlash, setScanFlash] = useState<ScanFlash>(null);
  const [scanToast, setScanToast] = useState<ScanToast>(null);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    if (!scanToast) return;
    const t = setTimeout(() => setScanToast(null), 2200);
    return () => clearTimeout(t);
  }, [scanToast]);

  useEffect(() => {
    if (!scanFlash) return;
    const t = setTimeout(() => setScanFlash(null), 900);
    return () => clearTimeout(t);
  }, [scanFlash]);

  // ── Lookup maps ──────────────────────────────────────────────────────────

  const categoryMap = useMemo(
    () => new Map(state.categories.map(c => [c.id, c])),
    [state.categories],
  );

  const locationMap = useMemo(
    () => new Map(state.locations.map(l => [l.id, l])),
    [state.locations],
  );

  // ── Derived data ─────────────────────────────────────────────────────────

  const warehouseName = useMemo(() => {
    if (warehouseFilter === 'all') return 'Все склады';
    return state.warehouses.find(w => w.id === warehouseFilter)?.name ?? 'Склад';
  }, [warehouseFilter, state.warehouses]);

  const scanLocationName = useMemo(() => {
    if (!scanLocationFilter) return null;
    return locationMap.get(scanLocationFilter)?.name ?? null;
  }, [scanLocationFilter, locationMap]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (scanLocationFilter) {
      const childIds = new Set(
        state.locations.filter(l => l.parentId === scanLocationFilter).map(l => l.id),
      );
      list = list.filter(e => e.locationId === scanLocationFilter || childIds.has(e.locationId));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        e => e.itemName.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
      );
    }
    if (showOnlyDiff) {
      list = list.filter(e => e.actualQty !== null && e.actualQty !== e.systemQty);
    }
    return list;
  }, [entries, search, showOnlyDiff, scanLocationFilter, state.locations]);

  const progress: InventoryProgress = useMemo(() => {
    const total = entries.length;
    const counted = entries.filter(e => e.actualQty !== null).length;
    return { total, counted };
  }, [entries]);

  const summary: InventorySummary = useMemo(() => {
    const counted = entries.filter(e => e.actualQty !== null);
    const matches = counted.filter(e => e.actualQty === e.systemQty);
    const surpluses = counted.filter(e => e.actualQty !== null && e.actualQty > e.systemQty);
    const shortages = counted.filter(e => e.actualQty !== null && e.actualQty < e.systemQty);
    const discrepancies = counted.filter(e => e.actualQty !== e.systemQty);
    return {
      total: entries.length,
      counted: counted.length,
      matches: matches.length,
      surpluses: surpluses.length,
      shortages: shortages.length,
      discrepancies,
    };
  }, [entries]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const startInventory = useCallback(() => {
    // Determine which items belong to selected warehouse
    let itemIds: Set<string>;
    if (warehouseFilter === 'all') {
      itemIds = new Set(state.items.map(i => i.id));
    } else {
      const whStocks = (state.warehouseStocks || []).filter(
        ws => ws.warehouseId === warehouseFilter && ws.quantity > 0,
      );
      itemIds = new Set(whStocks.map(ws => ws.itemId));
    }

    const filtered = state.items.filter(i => itemIds.has(i.id));

    setEntries(
      filtered.map(item => {
        const cat = categoryMap.get(item.categoryId);
        const loc = locationMap.get(item.locationId);
        return {
          itemId: item.id,
          itemName: item.name,
          systemQty: item.quantity,
          actualQty: null,
          unit: item.unit,
          category: cat?.name ?? 'Без категории',
          categoryColor: cat?.color ?? '#94a3b8',
          locationName: loc?.name ?? '',
          locationId: item.locationId,
        };
      }),
    );
    setStarted(true);
    setSearch('');
    setShowOnlyDiff(false);
  }, [warehouseFilter, state.items, state.warehouseStocks, categoryMap, locationMap]);

  const resetInventory = useCallback(() => {
    setStarted(false);
    setEntries([]);
    setSearch('');
    setShowOnlyDiff(false);
    setConfirmApply(false);
  }, []);

  const updateActualQty = useCallback((itemId: string, value: string) => {
    setEntries(prev =>
      prev.map(e =>
        e.itemId === itemId
          ? { ...e, actualQty: value === '' ? null : Math.max(0, parseInt(value) || 0) }
          : e,
      ),
    );
  }, []);

  const handleScanResult = useCallback((result: { type: string; id: string; raw: string }) => {
    if (result.type === 'item') {
      const entry = entries.find(e => e.itemId === result.id);
      if (!entry) {
        setScanToast({ kind: 'warn', text: 'Товар не входит в инвентаризацию текущего склада' });
        return;
      }
      const next = (entry.actualQty ?? 0) + 1;
      setEntries(prev => prev.map(e => e.itemId === result.id ? { ...e, actualQty: next } : e));
      setScanFlash({ itemId: result.id, ts: Date.now() });
      setScanCount(c => c + 1);
      setScanToast({ kind: 'ok', text: `${entry.itemName}: +1 (теперь ${next} ${entry.unit})` });
      return;
    }
    if (result.type === 'location') {
      const loc = locationMap.get(result.id);
      if (!loc) {
        setScanToast({ kind: 'warn', text: 'Локация не найдена в базе' });
        return;
      }
      setScanLocationFilter(result.id);
      setScanToast({ kind: 'ok', text: `Фильтр по локации: ${loc.name}` });
      return;
    }
    if (result.type === 'unknown') {
      const matchByName = entries.find(e => e.itemName.toLowerCase() === result.id.toLowerCase());
      if (matchByName) {
        const next = (matchByName.actualQty ?? 0) + 1;
        setEntries(prev => prev.map(e => e.itemId === matchByName.itemId ? { ...e, actualQty: next } : e));
        setScanFlash({ itemId: matchByName.itemId, ts: Date.now() });
        setScanCount(c => c + 1);
        setScanToast({ kind: 'ok', text: `${matchByName.itemName}: +1` });
        return;
      }
      setScanToast({ kind: 'error', text: `Код «${result.id.slice(0, 30)}» не распознан` });
      return;
    }
    setScanToast({ kind: 'warn', text: 'Этот QR-код не относится к товару или локации' });
  }, [entries, locationMap]);

  const applyCorrections = useCallback(() => {
    let nextState = { ...state };
    const newOperations: Operation[] = [];
    const now = new Date().toISOString();

    for (const entry of entries) {
      if (entry.actualQty === null || entry.actualQty === entry.systemQty) continue;

      const diff = entry.actualQty - entry.systemQty;
      const op: Operation = {
        id: generateId(),
        itemId: entry.itemId,
        type: diff > 0 ? 'in' : 'out',
        quantity: Math.abs(diff),
        comment: diff > 0 ? '[Инвентаризация] Излишек' : '[Инвентаризация] Недостача',
        from: diff > 0 ? '' : 'Склад',
        to: diff > 0 ? 'Склад' : '',
        performedBy: state.currentUser,
        date: now,
        warehouseId: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      };
      newOperations.push(op);

      // Update item quantity
      nextState = {
        ...nextState,
        items: nextState.items.map(item =>
          item.id === entry.itemId ? { ...item, quantity: entry.actualQty! } : item,
        ),
      };

      // Update warehouse stocks if specific warehouse selected
      if (warehouseFilter !== 'all') {
        const stocks = nextState.warehouseStocks || [];
        const existing = stocks.find(
          ws => ws.itemId === entry.itemId && ws.warehouseId === warehouseFilter,
        );
        if (existing) {
          nextState = {
            ...nextState,
            warehouseStocks: stocks.map(ws =>
              ws.itemId === entry.itemId && ws.warehouseId === warehouseFilter
                ? { ...ws, quantity: Math.max(0, ws.quantity + diff) }
                : ws,
            ),
          };
        }
      }
    }

    // Add all operations
    nextState = {
      ...nextState,
      operations: [...(nextState.operations || []), ...newOperations],
    };

    onStateChange(nextState);

    // Fire-and-forget crud calls
    for (const op of newOperations) {
      crudAction('add_operation', { operation: op });
    }
    for (const entry of entries) {
      if (entry.actualQty !== null && entry.actualQty !== entry.systemQty) {
        const updatedItem = nextState.items.find(i => i.id === entry.itemId);
        if (updatedItem) crudAction('upsert_item', { item: updatedItem });
      }
    }

    setConfirmApply(false);
    setStarted(false);
    setEntries([]);
  }, [entries, state, onStateChange, warehouseFilter]);

  return {
    // state
    warehouseFilter, setWarehouseFilter,
    started,
    search, setSearch,
    showOnlyDiff, setShowOnlyDiff,
    confirmApply, setConfirmApply,
    showScanner, setShowScanner,
    scanLocationFilter, setScanLocationFilter,
    scanFlash,
    scanToast,
    scanCount,
    // derived
    warehouseName,
    scanLocationName,
    filteredEntries,
    progress,
    summary,
    // handlers
    startInventory,
    resetInventory,
    updateActualQty,
    handleScanResult,
    applyCorrections,
  };
}
