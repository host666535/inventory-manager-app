import { AppState, Item, Location } from './store';

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findDuplicateItem(
  state: AppState,
  name: string,
  categoryId: string,
  excludeId?: string,
): Item | null {
  const needle = normalizeName(name);
  if (!needle) return null;
  return state.items.find(i =>
    i.id !== excludeId
    && i.categoryId === categoryId
    && normalizeName(i.name) === needle,
  ) || null;
}

export function findDuplicateLocation(
  state: AppState,
  name: string,
  warehouseId: string | undefined,
  parentId: string | undefined,
  excludeId?: string,
): Location | null {
  const needle = normalizeName(name);
  if (!needle) return null;
  return state.locations.find(l =>
    l.id !== excludeId
    && (l.warehouseId || '') === (warehouseId || '')
    && (l.parentId || '') === (parentId || '')
    && normalizeName(l.name) === needle,
  ) || null;
}

export function findDuplicateCategory(
  state: AppState,
  name: string,
  excludeId?: string,
): { id: string; name: string } | null {
  const needle = normalizeName(name);
  if (!needle) return null;
  return state.categories.find(c =>
    c.id !== excludeId && normalizeName(c.name) === needle,
  ) || null;
}

export function findDuplicateWarehouse(
  state: AppState,
  name: string,
  excludeId?: string,
): { id: string; name: string } | null {
  const needle = normalizeName(name);
  if (!needle) return null;
  const whs = state.warehouses || [];
  return whs.find(w =>
    w.id !== excludeId && normalizeName(w.name) === needle,
  ) || null;
}
