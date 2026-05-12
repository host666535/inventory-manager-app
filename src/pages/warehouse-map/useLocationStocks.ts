import { useMemo } from 'react';
import { AppState, Item, LocationStock } from '@/data/store';
import { getStockLevel } from './WarehouseMapHelpers';

export type LocationStockRow = LocationStock & { item: Item };

export type LocationStockFilters = {
  search?: string;
  categoryFilter?: string;
};

/** Возвращает товары в локации с уже развёрнутым item.
 *  Фильтрует по quantity > 0. При наличии filters — применяет поиск/фильтр по категории. */
export function useLocationStocks(
  state: AppState,
  locationId: string,
  filters?: LocationStockFilters,
): LocationStockRow[] {
  const search = filters?.search ?? '';
  const categoryFilter = filters?.categoryFilter ?? 'all';

  return useMemo(() => {
    const rows = (state.locationStocks || [])
      .filter(ls => ls.locationId === locationId && ls.quantity > 0)
      .map(ls => ({ ...ls, item: state.items.find(i => i.id === ls.itemId) }))
      .filter((ls): ls is LocationStockRow => !!ls.item);

    if (search || categoryFilter !== 'all') {
      const q = search.trim().toLowerCase();
      // Карта itemId → подходит по серийнику/штрих-коду — чтобы поиск согласовался с картой в целом
      const itemIdsBySerial = new Set<string>();
      if (q) {
        for (const bc of (state.barcodes || [])) {
          if (bc.code.toLowerCase().includes(q) || (bc.label && bc.label.toLowerCase().includes(q))) {
            itemIdsBySerial.add(bc.itemId);
          }
        }
        for (const wo of (state.workOrders || [])) {
          for (const oi of (wo.items || [])) {
            if (oi.serialNumber && oi.serialNumber.toLowerCase().includes(q)) {
              itemIdsBySerial.add(oi.itemId);
            }
          }
        }
      }
      return rows.filter(ls => {
        if (categoryFilter !== 'all' && ls.item.categoryId !== categoryFilter) return false;
        if (q) {
          const byName = ls.item.name.toLowerCase().includes(q);
          const bySerial = itemIdsBySerial.has(ls.item.id);
          if (!byName && !bySerial) return false;
        }
        return true;
      });
    }
    return rows;
  }, [state.locationStocks, state.items, state.barcodes, state.workOrders, locationId, search, categoryFilter]);
}

/** Вычисляет worst-level по массиву строк (для индикатора статуса локации). */
export function computeWorstLevel(rows: LocationStockRow[]): 'ok' | 'low' | 'critical' {
  return rows.reduce<'ok' | 'low' | 'critical'>((worst, ls) => {
    const lvl = getStockLevel(ls.quantity, ls.item.lowStockThreshold);
    if (lvl === 'critical') return 'critical';
    if (lvl === 'low' && worst !== 'critical') return 'low';
    return worst;
  }, 'ok');
}