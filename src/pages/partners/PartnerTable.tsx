import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, Partner, PartnerType, crudAction, generateId } from '@/data/store';
import { inPeriod } from './utils';
import { PartnerHistory, AddPartnerModal } from './PeriodFilter';
import { RecipientsReport, SuppliersReport } from './PartnerReports';

export function PartnerTable({ partners, type, state, onStateChange, periodFrom, periodTo }: {
  partners: Partner[]; type: PartnerType; state: AppState; onStateChange: (s: AppState) => void;
  periodFrom: Date | null; periodTo: Date | null;
}) {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [fullNameFilter, setFullNameFilter] = useState<string>('all');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Partner | null>(null);

  const isRecipient = type === 'recipient';

  const departments = useMemo(() => {
    if (!isRecipient) return [] as string[];
    const set = new Set<string>();
    partners.forEach(p => {
      const d = (p.department || p.name || '').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [partners, isRecipient]);

  const fullNamesForDept = useMemo(() => {
    if (!isRecipient) return [] as string[];
    const set = new Set<string>();
    partners
      .filter(p => departmentFilter === 'all' || (p.department || p.name) === departmentFilter)
      .forEach(p => { if (p.fullName) set.add(p.fullName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [partners, isRecipient, departmentFilter]);

  const filtered = partners.filter(p => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${p.name} ${p.department || ''} ${p.rank || ''} ${p.fullName || ''} ${p.contact || ''} ${p.note || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (isRecipient && departmentFilter !== 'all' && (p.department || p.name) !== departmentFilter) return false;
    if (isRecipient && fullNameFilter !== 'all' && (p.fullName || '') !== fullNameFilter) return false;
    return true;
  });

  const getPartnerStats = (p: Partner) => {
    const allOps = p.type === 'supplier'
      ? state.operations.filter(op => op.type === 'in' && op.from === p.name)
      : (() => {
          const direct = state.operations.filter(op => op.type === 'out' && op.to === p.name);
          const byOrder = state.operations.filter(op => {
            const order = state.workOrders?.find(o => o.id === op.orderId && o.recipientName === p.name);
            return !!order;
          });
          return [...direct, ...byOrder].filter((op, i, arr) => arr.findIndex(x => x.id === op.id) === i);
        })();
    const ops = allOps.filter(op => inPeriod(op.date, periodFrom, periodTo));
    return { opCount: ops.length, qty: ops.reduce((s, op) => s + op.quantity, 0) };
  };

  const handleDelete = (id: string) => {
    const next = { ...state, partners: state.partners.filter(p => p.id !== id) };
    onStateChange(next); crudAction('delete_partner', { partnerId: id });
  };

  const handleAdd = (data: Omit<Partner, 'id' | 'createdAt'>) => {
    const p: Partner = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    const next = { ...state, partners: [...state.partners, p] };
    onStateChange(next); crudAction('upsert_partner', { partner: p });
  };

  const handleEdit = (data: Omit<Partner, 'id' | 'createdAt'>) => {
    if (!editPartner) return;
    const updated: Partner = { ...editPartner, ...data };
    const next = { ...state, partners: state.partners.map(p => p.id === updated.id ? updated : p) };
    onStateChange(next);
    crudAction('upsert_partner', { partner: updated });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input placeholder={`Поиск ${type === 'supplier' ? 'поставщиков' : 'получателей'} (название, ФИО, звание)...`} value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="shrink-0">
            <Icon name="Plus" size={14} className="mr-1" />
            Добавить
          </Button>
        </div>

        {isRecipient && (departments.length > 0 || fullNamesForDept.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon name="Filter" size={12} />Фильтр:
            </div>
            <select
              value={departmentFilter}
              onChange={e => { setDepartmentFilter(e.target.value); setFullNameFilter('all'); }}
              className="h-8 text-xs rounded-md border border-border bg-background px-2 hover:border-primary/40 focus:border-primary focus:outline-none"
            >
              <option value="all">Все подразделения</option>
              {departments.map(d => (<option key={d} value={d}>{d}</option>))}
            </select>
            {fullNamesForDept.length > 0 && (
              <select
                value={fullNameFilter}
                onChange={e => setFullNameFilter(e.target.value)}
                className="h-8 text-xs rounded-md border border-border bg-background px-2 hover:border-primary/40 focus:border-primary focus:outline-none"
              >
                <option value="all">Все ФИО</option>
                {fullNamesForDept.map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            )}
            {(departmentFilter !== 'all' || fullNameFilter !== 'all') && (
              <button
                onClick={() => { setDepartmentFilter('all'); setFullNameFilter('all'); }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <Icon name="X" size={11} />Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Icon name={type === 'supplier' ? 'Truck' : 'Users'} size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold mb-0.5">{search ? 'Не найдено' : `${type === 'supplier' ? 'Поставщиков' : 'Получателей'} пока нет`}</p>
          {!search && <p className="text-xs text-muted-foreground">Добавьте первого</p>}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {filtered.map((p, idx) => {
            const stats = getPartnerStats(p);
            return (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${idx > 0 ? 'border-t border-border/50' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                  ${type === 'supplier' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300' : 'bg-success/15 text-success'}`}>
                  <Icon name={type === 'supplier' ? 'Truck' : 'UserCheck'} size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">{p.name}</div>
                  <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 flex-wrap text-xs text-muted-foreground">
                    {isRecipient && p.fullName && (
                      <span className="flex items-center gap-1 text-foreground/80">
                        <Icon name="UserCheck" size={10} />
                        {p.rank ? `${p.rank} · ` : ''}{p.fullName}
                      </span>
                    )}
                    {isRecipient && p.department && p.department !== p.name && (
                      <span className="flex items-center gap-0.5"><Icon name="Building2" size={10} />{p.department}</span>
                    )}
                    {p.contact && <span className="flex items-center gap-0.5"><Icon name="Phone" size={10} />{p.contact}</span>}
                    {p.note && <span className="truncate max-w-32">{p.note}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground tabular-nums">{stats.qty} ед.</div>
                  <div>{stats.opCount} операций</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setSelectedPartner(p)}
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                    title="Разбивка по номенклатурам">
                    <Icon name="Package" size={14} />
                  </button>
                  <button onClick={() => setEditPartner(p)}
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                    title="Редактировать">
                    <Icon name="Pencil" size={13} />
                  </button>
                  <button onClick={() => setDeleteConfirm(p)}
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                    <Icon name="Trash2" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {type === 'recipient' && <RecipientsReport state={state} periodFrom={periodFrom} periodTo={periodTo} />}
      {type === 'supplier' && <SuppliersReport state={state} periodFrom={periodFrom} periodTo={periodTo} />}

      {selectedPartner && (
        <PartnerHistory
          partner={selectedPartner}
          state={state}
          periodFrom={periodFrom}
          periodTo={periodTo}
          onClose={() => setSelectedPartner(null)}
        />
      )}
      {showAdd && <AddPartnerModal type={type} onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editPartner && <AddPartnerModal type={type} partner={editPartner} onSave={handleEdit} onClose={() => setEditPartner(null)} />}
      {deleteConfirm && (
        <Dialog open onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-[min(96vw,500px)] animate-scale-in">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                  <Icon name="Trash2" size={16} />
                </div>
                Удалить {type === 'supplier' ? 'поставщика' : 'получателя'}?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                <b className="text-foreground">«{deleteConfirm.name}»</b> будет удалён из справочника. История операций сохранится.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Отмена</Button>
                <Button onClick={() => { handleDelete(deleteConfirm.id); setDeleteConfirm(null); }}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold">
                  <Icon name="Trash2" size={14} className="mr-1.5" />Удалить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}