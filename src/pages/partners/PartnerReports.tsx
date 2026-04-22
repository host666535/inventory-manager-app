import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, Operation } from '@/data/store';
import { NomenRow, inPeriod, aggregateByItem } from './utils';

// ───── Отчёт получателей с разбивкой по номенклатурам ─────
type RecipientGroupRow = {
  department: string;
  receiverName: string;
  receiverRank: string;
  items: NomenRow[];
  totalQty: number;
  orderCount: number;
  lastDate: string;
};

export function RecipientsReport({ state, periodFrom, periodTo }: {
  state: AppState;
  periodFrom: Date | null;
  periodTo: Date | null;
}) {
  const [deptFilter, setDeptFilter] = useState('');
  const [receiverFilter, setReceiverFilter] = useState('');

  const rows: RecipientGroupRow[] = useMemo(() => {
    const map = new Map<string, { dept: string; name: string; rank: string; ops: Operation[]; orders: Set<string>; lastDate: string }>();
    for (const o of state.workOrders || []) {
      const dept = (o.recipientName || '').trim();
      const rName = (o.receiverName || '').trim();
      const rRank = (o.receiverRank || '').trim();
      if (!dept && !rName) continue;
      const key = `${dept}||${rName}`;
      const ops = state.operations.filter(op => op.orderId === o.id && op.type === 'out' && inPeriod(op.date, periodFrom, periodTo));
      if (ops.length === 0) continue;
      const existing = map.get(key);
      if (existing) {
        existing.ops.push(...ops);
        existing.orders.add(o.id);
        if (!existing.rank && rRank) existing.rank = rRank;
        if (new Date(o.updatedAt).getTime() > new Date(existing.lastDate).getTime()) existing.lastDate = o.updatedAt;
      } else {
        map.set(key, { dept, name: rName, rank: rRank, ops: [...ops], orders: new Set([o.id]), lastDate: o.updatedAt });
      }
    }
    return Array.from(map.entries()).map(([, v]) => {
      const items = aggregateByItem(v.ops, state);
      return {
        department: v.dept,
        receiverName: v.name,
        receiverRank: v.rank,
        items,
        totalQty: items.reduce((s, i) => s + i.qty, 0),
        orderCount: v.orders.size,
        lastDate: v.lastDate,
      };
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }, [state.workOrders, state.operations, state.items, periodFrom, periodTo]);

  const departments = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.department && s.add(r.department));
    return Array.from(s).sort();
  }, [rows]);

  const receivers = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.receiverName && s.add(r.receiverName));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = rows.filter(r => {
    const matchDept = !deptFilter || r.department.toLowerCase().includes(deptFilter.toLowerCase());
    const matchRcv = !receiverFilter || r.receiverName.toLowerCase().includes(receiverFilter.toLowerCase());
    return matchDept && matchRcv;
  });

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="Filter" size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Кто и что получил (по номенклатурам)</span>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} записей</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Input
              list="dept-list"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              placeholder="Подразделение..."
              className="h-8 text-sm"
            />
            <datalist id="dept-list">
              {departments.map(d => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div>
            <Input
              list="rcv-list"
              value={receiverFilter}
              onChange={e => setReceiverFilter(e.target.value)}
              placeholder="ФИО получателя..."
              className="h-8 text-sm"
            />
            <datalist id="rcv-list">
              {receivers.map(r => <option key={r} value={r} />)}
            </datalist>
          </div>
        </div>
        {(deptFilter || receiverFilter) && (
          <button
            onClick={() => { setDeptFilter(''); setReceiverFilter(''); }}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Icon name="X" size={11} />Сбросить фильтры
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Icon name="Inbox" size={22} className="text-muted-foreground mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">Нет данных по выдачам за выбранный период</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {filtered.map((r, i) => {
            return (
              <div key={i}>
                <div className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
                  <div className="w-8 h-8 rounded-lg bg-success/12 text-success flex items-center justify-center shrink-0">
                    <Icon name="ChevronDown" size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.department && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/12 text-primary">
                          {r.department}
                        </span>
                      )}
                      <span className="font-medium text-sm">
                        {r.receiverRank && <span className="text-muted-foreground font-normal">{r.receiverRank} </span>}
                        {r.receiverName || <span className="text-muted-foreground italic">без ФИО</span>}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.items.length} позиций · {r.orderCount} заявок · последняя: {new Date(r.lastDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums">{r.totalQty} ед.</div>
                  </div>
                </div>
                <div className="bg-muted/30 px-4 py-2 space-y-1 border-t border-border/30">
                  {r.items.map(it => (
                    <div key={it.itemId} className="flex items-center gap-2 py-1 text-sm">
                      <Icon name="Box" size={11} className="text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{it.itemName}</span>
                      <span className="text-xs text-muted-foreground">{it.opCount} оп.</span>
                      <span className="font-bold tabular-nums">{it.qty} {it.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───── Отчёт поставщиков с разбивкой по номенклатурам ─────
type SupplierGroupRow = {
  supplierName: string;
  items: NomenRow[];
  totalQty: number;
  opCount: number;
  lastDate: string;
};

export function SuppliersReport({ state, periodFrom, periodTo }: {
  state: AppState;
  periodFrom: Date | null;
  periodTo: Date | null;
}) {
  const [supplierFilter, setSupplierFilter] = useState('');

  const rows: SupplierGroupRow[] = useMemo(() => {
    const map = new Map<string, { name: string; ops: Operation[]; lastDate: string }>();
    for (const op of state.operations) {
      if (op.type !== 'in') continue;
      if (!inPeriod(op.date, periodFrom, periodTo)) continue;
      const name = (op.from || '').trim();
      if (!name) continue;
      const existing = map.get(name);
      if (existing) {
        existing.ops.push(op);
        if (new Date(op.date).getTime() > new Date(existing.lastDate).getTime()) existing.lastDate = op.date;
      } else {
        map.set(name, { name, ops: [op], lastDate: op.date });
      }
    }
    return Array.from(map.values()).map(v => {
      const items = aggregateByItem(v.ops, state);
      return {
        supplierName: v.name,
        items,
        totalQty: items.reduce((s, i) => s + i.qty, 0),
        opCount: v.ops.length,
        lastDate: v.lastDate,
      };
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }, [state.operations, state.items, periodFrom, periodTo]);

  const suppliers = useMemo(() => rows.map(r => r.supplierName).sort(), [rows]);

  const filtered = rows.filter(r => !supplierFilter || r.supplierName.toLowerCase().includes(supplierFilter.toLowerCase()));

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="Filter" size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Кто и что поставил (по номенклатурам)</span>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} записей</span>
        </div>
        <div>
          <Input
            list="sup-list"
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
            placeholder="Поиск поставщика..."
            className="h-8 text-sm"
          />
          <datalist id="sup-list">
            {suppliers.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
        {supplierFilter && (
          <button onClick={() => setSupplierFilter('')} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Icon name="X" size={11} />Сбросить
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Icon name="Inbox" size={22} className="text-muted-foreground mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">Нет данных о поставках за выбранный период</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {filtered.map((r, i) => {
            return (
              <div key={i}>
                <div className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center shrink-0">
                    <Icon name="ChevronDown" size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{r.supplierName}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.items.length} позиций · {r.opCount} операций · последняя: {new Date(r.lastDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums">{r.totalQty} ед.</div>
                  </div>
                </div>
                <div className="bg-muted/30 px-4 py-2 space-y-1 border-t border-border/30">
                  {r.items.map(it => (
                    <div key={it.itemId} className="flex items-center gap-2 py-1 text-sm">
                      <Icon name="Box" size={11} className="text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{it.itemName}</span>
                      <span className="text-xs text-muted-foreground">{it.opCount} оп.</span>
                      <span className="font-bold tabular-nums">{it.qty} {it.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
