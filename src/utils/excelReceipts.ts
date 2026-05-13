import * as XLSX from 'xlsx';
import {
  AppState, Receipt, ReceiptLine, ReceiptCustomField,
  Item, Partner, Operation, generateId,
  updateWarehouseStock, getFloorLocationId,
} from '@/data/store';

// Фиксированный порядок колонок (как в макете пользователя).
// Все остальные кастомные поля идут ПРАВЕЕ — отдельными столбцами.
export const FIXED_HEADERS = [
  'Дата прихода',
  'Тип имущества',
  'Количество',
  'Дата документа',
  'Основание:№',
  'от кого',
] as const;

type FixedHeader = typeof FIXED_HEADERS[number];

// Маппинг ключей кастомных полей, которые сохраняются как customFields у Receipt:
// «Дата документа» и «Основание:№» — это служебные поля документа.
const DOC_DATE_KEY = 'Дата документа';
const BASIS_KEY = 'Основание:№';

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

// Парсит "01.04.2026" / "2026-04-01" / Excel-serial number → ISO
function parseDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;

  // Excel serial date number
  if (typeof raw === 'number') {
    // Excel epoch — 1899-12-30
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = epoch.getTime() + raw * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const s = String(raw).trim();
  // dd.mm.yyyy или dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yyRaw] = m;
    const yy = yyRaw.length === 2 ? '20' + yyRaw : yyRaw;
    const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // ISO
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

// ─── ЭКСПОРТ ──────────────────────────────────────────────────────────────────

/**
 * Разворачивает приходы в плоские строки: каждая строка = одна позиция (ReceiptLine).
 * Колонки слева — фиксированные, справа — все кастомные поля приходов.
 */
export function exportReceiptsToExcel(
  receipts: Receipt[],
  state: AppState,
  filename?: string,
): void {
  // Собираем все уникальные ключи кастомных полей (исключая те, что мы уже маппим)
  const customKeys = new Set<string>();
  for (const r of receipts) {
    for (const f of r.customFields || []) {
      if (f.key === DOC_DATE_KEY || f.key === BASIS_KEY) continue;
      customKeys.add(f.key);
    }
  }
  const extraHeaders = Array.from(customKeys);

  const headers = [...FIXED_HEADERS, ...extraHeaders];

  const rows: Record<string, string | number>[] = [];

  for (const r of receipts) {
    const docDate = (r.customFields || []).find(f => f.key === DOC_DATE_KEY)?.value
      || formatDate(r.date);
    const basis = (r.customFields || []).find(f => f.key === BASIS_KEY)?.value || r.number;
    const arrivalDate = formatDate(r.date);
    const supplier = r.supplierName || '';

    for (const line of r.lines) {
      const item = state.items.find(i => i.id === line.itemId);
      const row: Record<string, string | number> = {
        'Дата прихода': arrivalDate,
        'Тип имущества': line.itemName || item?.name || '',
        'Количество': line.qty || 0,
        'Дата документа': docDate,
        'Основание:№': basis,
        'от кого': supplier,
      };
      for (const key of extraHeaders) {
        const f = (r.customFields || []).find(cf => cf.key === key);
        row[key] = f?.value || '';
      }
      rows.push(row);
    }

    // Если у приходов нет позиций — всё равно одна строка
    if (r.lines.length === 0) {
      const row: Record<string, string | number> = {
        'Дата прихода': arrivalDate,
        'Тип имущества': '',
        'Количество': 0,
        'Дата документа': docDate,
        'Основание:№': basis,
        'от кого': supplier,
      };
      for (const key of extraHeaders) {
        const f = (r.customFields || []).find(cf => cf.key === key);
        row[key] = f?.value || '';
      }
      rows.push(row);
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Авто-ширина колонок
  ws['!cols'] = headers.map(h => {
    const headerLen = h.length;
    const maxDataLen = rows.reduce((m, row) => {
      const v = row[h];
      const len = v != null ? String(v).length : 0;
      return Math.max(m, len);
    }, 0);
    return { wch: Math.max(headerLen, maxDataLen) + 2 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Приходы');

  const today = formatDate(new Date().toISOString()).replace(/\./g, '-');
  XLSX.writeFile(wb, filename ?? `Приходы_${today}.xlsx`);
}

/**
 * Шаблон пустого файла для импорта — чтобы пользователь видел, что заполнять.
 */
export function downloadReceiptTemplate(): void {
  const exampleRow: Record<string, string | number> = {
    'Дата прихода': formatDate(new Date().toISOString()),
    'Тип имущества': 'Бумага А4',
    'Количество': 4000,
    'Дата документа': formatDate(new Date().toISOString()),
    'Основание:№': 'Товарная накладная №220',
    'от кого': 'ООО "Бумажка"',
  };
  const ws = XLSX.utils.json_to_sheet([exampleRow], { header: [...FIXED_HEADERS] });
  ws['!cols'] = FIXED_HEADERS.map(h => ({ wch: Math.max(h.length, 18) + 2 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Приходы');
  XLSX.writeFile(wb, 'Шаблон_приходов.xlsx');
}

// ─── ИМПОРТ ───────────────────────────────────────────────────────────────────

export type ParsedReceiptRow = {
  rowNumber: number;
  arrivalDate: string;     // ISO
  itemName: string;
  qty: number;
  docDate: string;         // ISO или ''
  basis: string;
  supplier: string;
  extraFields: Record<string, string>;
  errors: string[];
};

export type ImportResult = {
  rows: ParsedReceiptRow[];
  validCount: number;
  errorCount: number;
};

/**
 * Парсит Excel-файл в массив строк прихода.
 */
export async function parseReceiptsExcel(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const rows: ParsedReceiptRow[] = [];

  json.forEach((raw, idx) => {
    const errors: string[] = [];
    const rowNumber = idx + 2; // +1 за заголовок, +1 за 1-based нумерацию

    // Сопоставляем колонки регистронезависимо
    const get = (header: FixedHeader): unknown => {
      const target = header.toLowerCase().trim();
      for (const key of Object.keys(raw)) {
        if (key.toLowerCase().trim() === target) return raw[key];
      }
      return '';
    };

    const arrivalIso = parseDate(get('Дата прихода'));
    if (!arrivalIso) errors.push('некорректная «Дата прихода»');

    const itemName = String(get('Тип имущества') ?? '').trim();
    if (!itemName) errors.push('пустое «Тип имущества»');

    const qtyRaw = get('Количество');
    const qty = typeof qtyRaw === 'number' ? qtyRaw : parseFloat(String(qtyRaw).replace(',', '.'));
    if (!qty || qty <= 0 || isNaN(qty)) errors.push('некорректное «Количество»');

    const docIso = parseDate(get('Дата документа')) || '';
    const basis = String(get('Основание:№') ?? '').trim();
    const supplier = String(get('от кого') ?? '').trim();

    const extra: Record<string, string> = {};
    for (const key of Object.keys(raw)) {
      const norm = key.toLowerCase().trim();
      const isFixed = (FIXED_HEADERS as readonly string[]).some(h => h.toLowerCase().trim() === norm);
      if (isFixed) continue;
      const val = raw[key];
      if (val !== '' && val != null) extra[key] = String(val);
    }

    rows.push({
      rowNumber,
      arrivalDate: arrivalIso || '',
      itemName,
      qty: qty || 0,
      docDate: docIso,
      basis,
      supplier,
      extraFields: extra,
      errors,
    });
  });

  const validCount = rows.filter(r => r.errors.length === 0).length;
  return { rows, validCount, errorCount: rows.length - validCount };
}

/**
 * Конвертирует распарсенные строки в приходы (Receipt[]) для конкретного склада.
 * Группирует строки в один приход по комбинации (поставщик + Основание:№ + Дата документа).
 * Создаёт недостающие Item и Partner.
 */
export function buildReceiptsFromRows(
  state: AppState,
  rows: ParsedReceiptRow[],
  warehouseId: string,
  currentUser: string,
): {
  nextState: AppState;
  receipts: Receipt[];
  newItems: Item[];
  newPartners: Partner[];
  operations: Operation[];
} {
  let next = { ...state };
  const newItems: Item[] = [];
  const newPartners: Partner[] = [];
  const operations: Operation[] = [];

  let counter = next.receiptCounter ?? 1;

  // Группировка
  const groups = new Map<string, ParsedReceiptRow[]>();
  for (const r of rows) {
    if (r.errors.length > 0) continue;
    const key = `${r.supplier}::${r.basis}::${r.docDate}::${r.arrivalDate.slice(0, 10)}`;
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }

  const receipts: Receipt[] = [];

  for (const [, groupRows] of groups) {
    const first = groupRows[0];

    // Поставщик
    let supplierId: string | undefined;
    let supplierName = first.supplier;
    if (first.supplier) {
      const existing = (next.partners || []).find(
        p => p.type === 'supplier' && p.name.trim().toLowerCase() === first.supplier.toLowerCase(),
      );
      if (existing) {
        supplierId = existing.id;
        supplierName = existing.name;
      } else {
        const np: Partner = {
          id: generateId(),
          name: first.supplier,
          type: 'supplier',
          createdAt: new Date().toISOString(),
        };
        next = { ...next, partners: [...(next.partners || []), np] };
        newPartners.push(np);
        supplierId = np.id;
      }
    }

    // Позиции
    const lines: ReceiptLine[] = [];
    for (const row of groupRows) {
      // Ищем существующий товар по имени
      const existingItem = next.items.find(
        i => i.name.trim().toLowerCase() === row.itemName.toLowerCase(),
      );
      let itemId: string;
      let unit = 'шт';
      if (existingItem) {
        itemId = existingItem.id;
        unit = existingItem.unit;
      } else {
        const floorLocId = getFloorLocationId(next, warehouseId);
        const ni: Item = {
          id: generateId(),
          name: row.itemName,
          categoryId: next.categories[0]?.id || '',
          locationId: floorLocId,
          unit: 'шт',
          quantity: 0,
          lowStockThreshold: 5,
          createdAt: new Date().toISOString(),
        };
        next = { ...next, items: [...next.items, ni] };
        newItems.push(ni);
        itemId = ni.id;
      }

      const qty = Math.round(row.qty);
      lines.push({
        id: generateId(),
        itemId,
        itemName: row.itemName,
        qty,
        confirmedQty: qty,         // импорт = сразу подтверждено
        locationId: '',
        unit,
        isNew: !existingItem,
      });
    }

    // Кастомные поля документа
    const customFields: ReceiptCustomField[] = [];
    if (first.docDate) {
      customFields.push({ key: DOC_DATE_KEY, value: formatDate(first.docDate) });
    }
    if (first.basis) {
      customFields.push({ key: BASIS_KEY, value: first.basis });
    }
    // Доп. поля справа — берём с первой строки группы
    for (const [k, v] of Object.entries(first.extraFields)) {
      customFields.push({ key: k, value: v });
    }

    const nowIso = new Date().toISOString();
    const wh = (next.warehouses || []).find(w => w.id === warehouseId);
    const whName = wh?.name || 'Склад';

    // ─── Зачисляем остатки на склад сразу при импорте ──────────────────────
    for (const line of lines) {
      const qty = line.confirmedQty || 0;
      if (qty <= 0) continue;

      if (warehouseId) {
        next = updateWarehouseStock(next, line.itemId, warehouseId, qty);
      } else {
        next = {
          ...next,
          items: next.items.map(i => i.id === line.itemId
            ? { ...i, quantity: i.quantity + qty }
            : i),
        };
      }

      const op: Operation = {
        id: generateId(),
        itemId: line.itemId,
        type: 'in',
        quantity: qty,
        comment: `Импорт прихода ПРХ-${String(counter).padStart(4, '0')}`,
        from: supplierName || 'Поставщик',
        to: whName,
        performedBy: currentUser,
        date: nowIso,
        warehouseId: warehouseId || undefined,
      };
      operations.push(op);
    }

    const receipt: Receipt = {
      id: generateId(),
      number: `ПРХ-${String(counter).padStart(4, '0')}`,
      status: 'posted',                 // сразу оприходовано (без 2 этапов)
      supplierId,
      supplierName,
      warehouseId,
      date: first.arrivalDate || nowIso,
      createdBy: currentUser,
      lines,
      customFields,
      scanHistory: [],
      postedAt: nowIso,
    };
    counter += 1;
    receipts.push(receipt);
  }

  next = {
    ...next,
    receipts: [...receipts, ...(next.receipts || [])],
    operations: [...operations, ...(next.operations || [])],
    receiptCounter: counter,
  };

  return { nextState: next, receipts, newItems, newPartners, operations };
}