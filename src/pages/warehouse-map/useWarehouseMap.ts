import { useState, useMemo } from 'react';
import { AppState, Location, Warehouse, crudAction } from '@/data/store';
import { ZONE_COLORS, DEFAULT_LAYOUT, WarehouseLayout } from './WarehouseMapHelpers';

export function useWarehouseMap(
  state: AppState,
  onStateChange: (s: AppState) => void,
  initialLocationId?: string | null,
) {
  const warehouses: Warehouse[] = state.warehouses || [];
  const [activeWarehouseId, setActiveWarehouseId] = useState<string>(() => warehouses[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialLocationId ?? null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | undefined>();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ itemId: string; fromLocationId: string } | null>(null);
  const [dragOverLocationId, setDragOverLocationId] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{ itemId: string; fromLocationId: string; toLocationId: string } | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [layout, setLayout] = useState<WarehouseLayout>(() => {
    try {
      const saved = localStorage.getItem('warehouse_layout_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return DEFAULT_LAYOUT;
  });
  const [rackDirs, setRackDirs] = useState<Record<string, 'horizontal' | 'vertical'>>(() => {
    try {
      const saved = localStorage.getItem('rack_directions_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return {};
  });
  const toggleRackDir = (rackId: string) => {
    const next = { ...rackDirs, [rackId]: rackDirs[rackId] === 'vertical' ? 'horizontal' : 'vertical' };
    setRackDirs(next);
    localStorage.setItem('rack_directions_v1', JSON.stringify(next));
  };

  const activeWarehouse = warehouses.find(w => w.id === activeWarehouseId) || warehouses[0];

  const saveLayout = (l: WarehouseLayout) => {
    setLayout(l);
    localStorage.setItem('warehouse_layout_v1', JSON.stringify(l));
  };

  const selectedLocation = selectedLocationId ? state.locations.find(l => l.id === selectedLocationId) : null;
  const selectedItem = selectedItemId ? state.items.find(i => i.id === selectedItemId) || null : null;

  const whLocations = state.locations.filter(l => !l.warehouseId || l.warehouseId === activeWarehouseId);
  const totalLocations = whLocations.length;
  const occupiedLocations = whLocations.filter(loc =>
    (state.locationStocks || []).some(ls => ls.locationId === loc.id && ls.quantity > 0)
  ).length;
  const whItemIds = new Set(
    (state.warehouseStocks || []).filter(ws => ws.warehouseId === activeWarehouseId && ws.quantity > 0).map(ws => ws.itemId)
  );
  const whItems = state.items.filter(i => whItemIds.has(i.id));
  const lowItems = whItems.filter(i => {
    const qty = (state.warehouseStocks || []).find(ws => ws.warehouseId === activeWarehouseId && ws.itemId === i.id)?.quantity ?? i.quantity;
    return qty > 0 && qty <= i.lowStockThreshold;
  }).length;
  const criticalItems = whItems.filter(i => {
    const qty = (state.warehouseStocks || []).find(ws => ws.warehouseId === activeWarehouseId && ws.itemId === i.id)?.quantity ?? i.quantity;
    return qty === 0;
  }).length;

  const locationColors = useMemo(() => {
    const map: Record<string, string> = {};
    layout.cells.forEach(cell => {
      if (cell.color) map[cell.locationId] = cell.color;
    });
    state.locations.forEach((loc, i) => {
      if (!map[loc.id]) map[loc.id] = ZONE_COLORS[i % ZONE_COLORS.length];
    });
    return map;
  }, [layout, state.locations]);

  const locationsWithMatches = useMemo(() => {
    if (!search && categoryFilter === 'all') return new Set(state.locations.map(l => l.id));
    return new Set(
      (state.locationStocks || [])
        .filter(ls => {
          const item = state.items.find(i => i.id === ls.itemId);
          if (!item) return false;
          if (categoryFilter !== 'all' && item.categoryId !== categoryFilter) return false;
          if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
          return ls.quantity > 0;
        })
        .map(ls => ls.locationId)
    );
  }, [search, categoryFilter, state]);

  const handleItemDragStart = (e: React.DragEvent, itemId: string, fromLocationId: string) => {
    setDragState({ itemId, fromLocationId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${itemId}::${fromLocationId}`);
  };

  const handleDragOver = (e: React.DragEvent, locationId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLocationId(locationId);
  };

  const handleDragLeave = () => setDragOverLocationId(null);

  const handleDrop = (e: React.DragEvent, toLocationId: string) => {
    e.preventDefault();
    setDragOverLocationId(null);
    if (!dragState || dragState.fromLocationId === toLocationId) { setDragState(null); return; }
    const hasChildren = state.locations.some(l => l.parentId === toLocationId);
    if (hasChildren) {
      alert('На этот стеллаж нельзя класть товар напрямую — у него есть полки. Перетащите на конкретную полку.');
      setDragState(null);
      return;
    }
    setMoveModal({ itemId: dragState.itemId, fromLocationId: dragState.fromLocationId, toLocationId });
    setDragState(null);
  };

  const handleDeleteLocation = (locId: string) => {
    const hasStock = (state.locationStocks || []).some(ls => ls.locationId === locId && ls.quantity > 0);
    if (hasStock) {
      alert('Нельзя удалить локацию, в которой есть товары. Сначала переместите или спишите все товары.');
      return;
    }
    const next = {
      ...state,
      locations: state.locations.filter(l => l.id !== locId),
      locationStocks: (state.locationStocks || []).filter(ls => ls.locationId !== locId),
    };
    onStateChange(next); crudAction('delete_location', { locationId: locId });
    if (selectedLocationId === locId) setSelectedLocationId(null);

    const newLayout = { ...layout, cells: layout.cells.filter(c => c.locationId !== locId) };
    saveLayout(newLayout);
  };

  const topLocations = state.locations.filter(l => !l.parentId && (!l.warehouseId || l.warehouseId === activeWarehouseId));
  const childLocations = (parentId: string) => state.locations.filter(l => l.parentId === parentId);

  return {
    // data
    warehouses, activeWarehouse, activeWarehouseId, setActiveWarehouseId,
    selectedLocationId, setSelectedLocationId,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    showAddLocation, setShowAddLocation,
    editLocation, setEditLocation,
    selectedItemId, setSelectedItemId,
    moveModal, setMoveModal,
    showTransferModal, setShowTransferModal,
    viewMode, setViewMode,
    rackDirs, toggleRackDir,
    selectedLocation, selectedItem,
    totalLocations, occupiedLocations, lowItems, criticalItems,
    locationColors, locationsWithMatches,
    topLocations, childLocations,
    dragOverLocationId,
    // handlers
    handleItemDragStart, handleDragOver, handleDragLeave, handleDrop, handleDeleteLocation,
  };
}
