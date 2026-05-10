import * as XLSX from 'xlsx';
import {
  AppState, WorkOrder, OrderItem, Item, Partner, Operation, generateId,
  updateLocationStock, updateWarehouseStock,
} from '@/data/store';

// Колонки в строгом порядке (по макету пользователя).
export const ORDER_HEADERS = [
  'Дата',
  'Объединение',
  'Соединение',
  'В/Ч',
  'звание',
  'ФИО согласно выписки из приказа',
  'Тип имущества',
  'Количество',
  'Склад',
  'Номер документа',
  'Серийный номер',
] as const;

type OrderHeader = typeof ORDER_HEADERS[number];

// ─── Утилиты ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function parseDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = epoch.getTime() + raw * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yyRaw] = m;
    const yy = yyRaw.length === 2 ? '20' + yyRaw : yyRaw;
    const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

// ─── ЭКСПОРТ ──────────────────────────────────────────────────────────────────

/**
 * Выгружает заявки в Excel: каждая строка = одна позиция (OrderItem).
 * Шапка повторяется для каждой строки заявки.
 */
export function exportOrdersToExcel(
  orders: WorkOrder[],
  state: AppState,
  filename?: string,
): void {
  const rows: Record<string, string | number>[] = [];

  for (const order of orders) {
    const dateStr = formatDate(order.createdAt);
    const wh = (state.warehouses || []).find(w => w.id === order.warehouseId);
    const whName = wh?.name || '';

    const baseFields = {
      'Дата': dateStr,
      'Объединение': order.unitGroup || '',
      'Соединение': order.unitFormation || order.recipientName || '',
      'В/Ч': order.unitNumber || '',
      'звание': order.receiverRank || order.requesterRank || '',
      'ФИО согласно выписки из приказа': order.receiverName || order.requesterName || '',
      'Склад': whName,
      'Номер документа': order.number,
    };

    if (order.items.length === 0) {
      rows.push({
        ...baseFields,
        'Тип имущества': '',
        'Количество': 0,
        'Серийный номер': '',
      });
      continue;
    }

    for (const oi of order.items) {
      const item = state.items.find(i => i.id === oi.itemId);
      rows.push({
        ...baseFields,
        'Тип имущества': item?.name || '',
        'Количество': oi.requiredQty || 0,
        'Серийный номер': oi.serialNumber || '',
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: [...ORDER_HEADERS] });

  ws['!cols'] = ORDER_HEADERS.map(h => {
    const headerLen = h.length;
    const maxDataLen = rows.reduce((m, row) => {
      const v = row[h];
      const len = v != null ? String(v).length : 0;
      return Math.max(m, len);
    }, 0);
    return { wch: Math.max(headerLen, maxDataLen) + 2 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Выдачи');

  const today = formatDate(new Date().toISOString()).replace(/\./g, '-');
  XLSX.writeFile(wb, filename ?? `Выдачи_${today}.xlsx`);
}

/**
 * Шаблон пустого файла для импорта выдач.
 */
export function downloadOrderTemplate(): void {
  const example: Record<string, string | number> = {
    'Дата': formatDate(new Date().toISOString()),
    'Объединение': 'ГМП',
    'Соединение': '61 обрмп (в/ч 38643)',
    'В/Ч': '38643',
    'звание': 'лейтенант',
    'ФИО согласно выписки из приказа': 'Иванов В. Д.',
    'Тип имущества': 'Бумага А4',
    'Количество': 1,
    'Склад': '1',
    'Номер документа': '400',
    'Серийный номер': '8400231123',
  };
  const ws = XLSX.utils.json_to_sheet([example], { header: [...ORDER_HEADERS] });
  ws['!cols'] = ORDER_HEADERS.map(h => ({ wch: Math.max(h.length, 18) + 2 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Выдачи');
  XLSX.writeFile(wb, 'Шаблон_выдач.xlsx');
}

// ─── ИМПОРТ ───────────────────────────────────────────────────────────────────

export type ParsedOrderRow = {
  rowNumber: number;
  date: string;             // ISO
  unitGroup: string;
  unitFormation: string;
  unitNumber: string;
  rank: string;
  fullName: string;
  itemName: string;
  qty: number;
  warehouseHint: string;    // Что было в колонке "Склад" (имя или индекс/id)
  docNumber: string;
  serialNumber: string;
  errors: string[];
};

export type OrderImportResult = {
  rows: ParsedOrderRow[];
  validCount: number;
  errorCount: number;
};

export async function parseOrdersExcel(file: File): Promise<OrderImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const rows: ParsedOrderRow[] = [];

  json.forEach((raw, idx) => {
    const errors: string[] = [];
    const rowNumber = idx + 2;

    const get = (header: OrderHeader): unknown => {
      const target = header.toLowerCase().trim();
      for (const key of Object.keys(raw)) {
        if (key.toLowerCase().trim() === target) return raw[key];
      }
      return '';
    };

    const dateIso = parseDate(get('Дата'));
    if (!dateIso) errors.push('некорректная «Дата»');

    const itemName = String(get('Тип имущества') ?? '').trim();
    if (!itemName) errors.push('пустое «Тип имущества»');

    const qtyRaw = get('Количество');
    const qty = typeof qtyRaw === 'number' ? qtyRaw : parseFloat(String(qtyRaw).replace(',', '.'));
    if (!qty || qty <= 0 || isNaN(qty)) errors.push('некорректное «Количество»');

    const docNumber = String(get('Номер документа') ?? '').trim();

    rows.push({
      rowNumber,
      date: dateIso || '',
      unitGroup: String(get('Объединение') ?? '').trim(),
      unitFormation: String(get('Соединение') ?? '').trim(),
      unitNumber: String(get('В/Ч') ?? '').trim(),
      rank: String(get('звание') ?? '').trim(),
      fullName: String(get('ФИО согласно выписки из приказа') ?? '').trim(),
      itemName,
      qty: qty || 0,
      warehouseHint: String(get('Склад') ?? '').trim(),
      docNumber,
      serialNumber: String(get('Серийный номер') ?? '').trim(),
      errors,
    });
  });

  const validCount = rows.filter(r => r.errors.length === 0).length;
  return { rows, validCount, errorCount: rows.length - validCount };
}

/**
 * Резолвит склад: если в колонке стоит точное имя — берём его, если число (1, 2)
 * — пытаемся как индекс, иначе fallback на defaultWarehouseId.
 */
function resolveWarehouseId(state: AppState, hint: string, fallback: string): string {
  const list = state.warehouses || [];
  if (!hint) return fallback;
  const byName = list.find(w => w.name.trim().toLowerCase() === hint.toLowerCase());
  if (byName) return byName.id;
  // Иногда «Склад» = "1" — попробуем как индекс
  const idx = parseInt(hint, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= list.length) return list[idx - 1].id;
  // Может быть точный id
  const byId = list.find(w => w.id === hint);
  if (byId) return byId.id;
  return fallback;
}

/**
 * Группирует строки в заявки по комбинации (Номер документа + В/Ч + ФИО).
 * Создаёт недостающие Item и Partner.
 */
export function buildOrdersFromRows(
  state: AppState,
  rows: ParsedOrderRow[],
  defaultWarehouseId: string,
  currentUser: string,
): {
  nextState: AppState;
  orders: WorkOrder[];
  newItems: Item[];
  newPartners: Partner[];
  operations: Operation[];
} {
  let next = { ...state };
  const newItems: Item[] = [];
  const newPartners: Partner[] = [];
  const operations: Operation[] = [];

  // Группировка
  const groups = new Map<string, ParsedOrderRow[]>();
  for (const r of rows) {
    if (r.errors.length > 0) continue;
    const key = `${r.docNumber}::${r.unitNumber}::${r.fullName}::${r.date.slice(0, 10)}`;
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }

  const orders: WorkOrder[] = [];

  for (const [, groupRows] of groups) {
    const first = groupRows[0];
    const warehouseId = resolveWarehouseId(next, first.warehouseHint, defaultWarehouseId);

    // Получатель: ищем по подразделению или ФИО
    const recipientName = first.unitFormation || first.unitGroup || '';
    let recipientId: string | undefined;
    if (recipientName || first.fullName) {
      const existing = (next.partners || []).find(
        p => p.type === 'recipient'
          && (
            (p.department && p.department.trim().toLowerCase() === recipientName.toLowerCase())
            || (p.fullName && first.fullName && p.fullName.trim().toLowerCase() === first.fullName.toLowerCase())
          ),
      );
      if (existing) {
        recipientId = existing.id;
      } else if (recipientName || first.fullName) {
        const np: Partner = {
          id: generateId(),
          name: recipientName || first.fullName,
          type: 'recipient',
          department: recipientName || undefined,
          rank: first.rank || undefined,
          fullName: first.fullName || undefined,
          createdAt: new Date().toISOString(),
        };
        next = { ...next, partners: [...(next.partners || []), np] };
        newPartners.push(np);
        recipientId = np.id;
      }
    }

    // Позиции
    const items: OrderItem[] = [];
    for (const row of groupRows) {
      const existingItem = next.items.find(
        i => i.name.trim().toLowerCase() === row.itemName.toLowerCase(),
      );
      let itemId: string;
      if (existingItem) {
        itemId = existingItem.id;
      } else {
        const leafLoc = next.locations.find(
          l => !next.locations.some(ch => ch.parentId === l.id)
            && (!l.warehouseId || l.warehouseId === warehouseId),
        );
        const ni: Item = {
          id: generateId(),
          name: row.itemName,
          categoryId: next.categories[0]?.id || '',
          locationId: leafLoc?.id || '',
          unit: 'шт',
          quantity: 0,
          lowStockThreshold: 5,
          createdAt: new Date().toISOString(),
        };
        next = { ...next, items: [...next.items, ni] };
        newItems.push(ni);
        itemId = ni.id;
      }

      const requiredQty = Math.round(row.qty);
      items.push({
        id: generateId(),
        itemId,
        requiredQty,
        pickedQty: requiredQty,           // импорт = факт выдачи
        status: 'done',
        serialNumber: row.serialNumber || undefined,
      });
    }

    const orderNumber = first.docNumber || `ЗС-${String(orders.length + 1).padStart(3, '0')}`;
    const orderId = generateId();
    const nowIso = new Date().toISOString();

    // ─── Списываем товары со склада сразу при импорте ──────────────────────
    const wh = (next.warehouses || []).find(w => w.id === warehouseId);
    const whName = wh?.name || 'Склад';

    for (const oi of items) {
      const qty = oi.requiredQty;
      if (qty <= 0) continue;

      // Пытаемся найти локацию с этим товаром в выбранном складе
      const candidateLocations = (next.locationStocks || [])
        .filter(ls => ls.itemId === oi.itemId && ls.quantity > 0)
        .filter(ls => {
          const loc = next.locations.find(l => l.id === ls.locationId);
          return !loc?.warehouseId || loc.warehouseId === warehouseId;
        })
        .sort((a, b) => b.quantity - a.quantity);

      let remaining = qty;
      let firstLocationId: string | undefined;
      for (const ls of candidateLocations) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, ls.quantity);
        next = updateLocationStock(next, oi.itemId, ls.locationId, -take);
        if (!firstLocationId) firstLocationId = ls.locationId;
        remaining -= take;
      }

      // Снимаем остаток со склада
      next = updateWarehouseStock(next, oi.itemId, warehouseId, -qty);

      // Если нет привязки к складу — корректируем общий item.quantity
      if (!warehouseId) {
        next = {
          ...next,
          items: next.items.map(i => i.id === oi.itemId
            ? { ...i, quantity: Math.max(0, i.quantity - qty) }
            : i),
        };
      }

      const op: Operation = {
        id: generateId(),
        itemId: oi.itemId,
        type: 'out',
        quantity: qty,
        comment: `Импорт выдачи ${orderNumber}`,
        from: whName,
        to: recipientName || first.fullName || 'Получатель',
        performedBy: currentUser,
        date: nowIso,
        orderId,
        locationId: firstLocationId,
        warehouseId: warehouseId || undefined,
      };
      operations.push(op);
    }

    const order: WorkOrder = {
      id: orderId,
      number: orderNumber,
      title: `Выдача ${recipientName || first.fullName || ''}`.trim(),
      status: 'closed',                   // сразу закрыта (без 2 этапов)
      createdBy: currentUser,
      warehouseId,
      recipientId,
      recipientName: recipientName || undefined,
      receiverRank: first.rank || undefined,
      receiverName: first.fullName || undefined,
      // Дублируем ФИО/звание в «Затребовал», т.к. в таблице это одно поле
      requesterRank: first.rank || undefined,
      requesterName: first.fullName || undefined,
      unitGroup: first.unitGroup || undefined,
      unitFormation: first.unitFormation || undefined,
      unitNumber: first.unitNumber || undefined,
      createdAt: first.date || nowIso,
      updatedAt: nowIso,
      items,
    };
    orders.push(order);
  }

  next = {
    ...next,
    workOrders: [...orders, ...(next.workOrders || [])],
    operations: [...operations, ...(next.operations || [])],
  };

  return { nextState: next, orders, newItems, newPartners, operations };
}