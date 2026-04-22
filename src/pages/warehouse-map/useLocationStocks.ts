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
      const q = search.toLowerCase();
      return rows.filter(ls => {
        if (categoryFilter !== 'all' && ls.item.categoryId !== categoryFilter) return false;
        if (q && !ls.item.name.toLowerCase().includes(q)) return false;
        return true;
      });
    }
    return rows;
  }, [state.locationStocks, state.items, locationId, search, categoryFilter]);
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
