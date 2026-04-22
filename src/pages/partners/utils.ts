import { AppState, Operation } from '@/data/store';

export type PartnerTab = 'suppliers' | 'recipients';

export type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export type NomenRow = {
  itemId: string;
  itemName: string;
  unit: string;
  qty: number;
  opCount: number;
};

export function getPeriodDates(preset: PeriodPreset, customFrom?: string, customTo?: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (preset) {
    case 'today': return { from: todayStart, to: todayEnd };
    case 'week': {
      const d = new Date(todayStart); d.setDate(d.getDate() - 6);
      return { from: d, to: todayEnd };
    }
    case 'month': {
      const d = new Date(todayStart); d.setDate(d.getDate() - 29);
      return { from: d, to: todayEnd };
    }
    case 'quarter': {
      const d = new Date(todayStart); d.setDate(d.getDate() - 89);
      return { from: d, to: todayEnd };
    }
    case 'year': {
      const d = new Date(todayStart); d.setFullYear(d.getFullYear() - 1);
      return { from: d, to: todayEnd };
    }
    case 'custom': {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo + 'T23:59:59') : null;
      return { from, to };
    }
    default: return { from: null, to: null };
  }
}

export function inPeriod(dateStr: string, from: Date | null, to: Date | null): boolean {
  const t = new Date(dateStr).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export function aggregateByItem(ops: Operation[], state: AppState): NomenRow[] {
  const map = new Map<string, NomenRow>();
  for (const op of ops) {
    const it = state.items.find(i => i.id === op.itemId);
    const key = op.itemId;
    const existing = map.get(key);
    if (existing) {
      existing.qty += op.quantity;
      existing.opCount += 1;
    } else {
      map.set(key, {
        itemId: op.itemId,
        itemName: it?.name || '—',
        unit: it?.unit || '',
        qty: op.quantity,
        opCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
}
