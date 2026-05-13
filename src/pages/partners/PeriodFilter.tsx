import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Partner, PartnerType } from '@/data/store';
import { PeriodPreset, inPeriod, aggregateByItem } from './utils';

export function PeriodFilter({ preset, onPresetChange, customFrom, customTo, onCustomChange }: {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  const presets: { id: PeriodPreset; label: string }[] = [
    { id: 'all', label: 'Всё время' },
    { id: 'today', label: 'Сегодня' },
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
    { id: 'quarter', label: '3 месяца' },
    { id: 'year', label: 'Год' },
    { id: 'custom', label: 'Период' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon name="Calendar" size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Период:</span>
        {presets.map(p => (
          <button
            key={p.id}
            onClick={() => onPresetChange(p.id)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all
              ${preset === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >{p.label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px]">С</Label>
            <Input
              type="date"
              value={customFrom}
              onChange={e => onCustomChange(e.target.value, customTo)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-[11px]">По</Label>
            <Input
              type="date"
              value={customTo}
              onChange={e => onCustomChange(customFrom, e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function PartnerHistory({ partner, state, periodFrom, periodTo, onClose }: {
  partner: Partner; state: AppState;
  periodFrom: Date | null; periodTo: Date | null;
  onClose: () => void;
}) {
  const { history, byItem } = useMemo(() => {
    const ops = state.operations.filter(op => {
      if (!inPeriod(op.date, periodFrom, periodTo)) return false;
      if (partner.type === 'supplier') return op.type === 'in' && op.from === partner.name;
      return op.type === 'out' && op.to === partner.name;
    });
    const orderOps = partner.type === 'recipient'
      ? state.operations.filter(op => {
          if (!inPeriod(op.date, periodFrom, periodTo)) return false;
          const order = state.workOrders?.find(o => o.id === op.orderId && o.recipientName === partner.name);
          return !!order;
        })
      : [];
    const combined = [...ops, ...orderOps].filter((op, i, arr) => arr.findIndex(x => x.id === op.id) === i);
    const sorted = combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { history: sorted, byItem: aggregateByItem(combined, state) };
  }, [partner, state, periodFrom, periodTo]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[min(96vw,1200px)] max-h-[85vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
              ${partner.type === 'supplier' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300' : 'bg-success/15 text-success'}`}>
              <Icon name={partner.type === 'supplier' ? 'Truck' : 'UserCheck'} size={15} />
            </div>
            <span>{partner.name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {partner.contact && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Phone" size={13} />{partner.contact}
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Package" size={13} />
              <span className="text-sm font-semibold">
                {partner.type === 'supplier' ? 'Что поставлено' : 'Что получено'}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{byItem.length} позиций</span>
            </div>
            {byItem.length === 0 ? (
              <div className="text-center py-3 text-xs text-muted-foreground">За выбранный период нет операций</div>
            ) : (
              <div className="space-y-1">
                {byItem.map(r => (
                  <div key={r.itemId} className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-card text-sm">
                    <Icon name="Box" size={12} className="text-muted-foreground shrink-0" />
                    <span className="flex-1 break-words min-w-0">{r.itemName}</span>
                    <span className="text-xs text-muted-foreground">{r.opCount} оп.</span>
                    <span className="font-bold tabular-nums">{r.qty} {r.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-semibold">История операций</h3>
            {history.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Icon name="Clock" size={20} className="mx-auto mb-2 opacity-40" />
                Операций пока нет
              </div>
            ) : (
              <div className="space-y-1.5">
                {history.map(op => {
                  const item = state.items.find(i => i.id === op.itemId);
                  const order = op.orderId ? state.workOrders?.find(o => o.id === op.orderId) : null;
                  return (
                    <div key={op.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 text-sm">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0
                        ${op.type === 'in' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'}`}>
                        <Icon name={op.type === 'in' ? 'ArrowDownToLine' : 'ArrowUpFromLine'} size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {order ? `Заявка ${order.number}` : op.comment || '—'}
                          {order?.receiverName && <span> · {order.receiverRank ? `${order.receiverRank} ` : ''}{order.receiverName}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold tabular-nums">{op.quantity} {item?.unit}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddPartnerModal({ type, partner, onSave, onClose }: {
  type: PartnerType; partner?: Partner; onSave: (p: Omit<Partner, 'id' | 'createdAt'>) => void; onClose: () => void;
}) {
  const isRecipient = type === 'recipient';
  const isEdit = !!partner;

  // Для поставщика работаем с "name". Для получателя — три отдельных поля.
  const [supplierName, setSupplierName] = useState(partner?.name || '');
  const [department, setDepartment] = useState(
    partner?.department || (isRecipient ? partner?.name || '' : '')
  );
  const [rank, setRank] = useState(partner?.rank || '');
  const [fullName, setFullName] = useState(partner?.fullName || '');
  const [contact, setContact] = useState(partner?.contact || '');
  const [note, setNote] = useState(partner?.note || '');

  const canSave = isRecipient ? department.trim().length > 0 : supplierName.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (isRecipient) {
      const dept = department.trim();
      const rk = rank.trim();
      const fn = fullName.trim();
      // Название = подразделение + ФИО (для удобного поиска и печати)
      const composedName = [dept, fn].filter(Boolean).join(' — ') || dept;
      onSave({
        name: composedName,
        department: dept || undefined,
        rank: rk || undefined,
        fullName: fn || undefined,
        contact: contact.trim() || undefined,
        note: note.trim() || undefined,
        type,
      });
    } else {
      onSave({
        name: supplierName.trim(),
        contact: contact.trim() || undefined,
        note: note.trim() || undefined,
        type,
      });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[min(96vw,700px)] animate-scale-in">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать' : 'Добавить'} {type === 'supplier' ? 'поставщика' : 'получателя'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {isRecipient ? (
            <>
              <div className="space-y-1.5">
                <Label>Структурное подразделение *</Label>
                <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Напр.: 8-я рота" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Должность / звание</Label>
                <Input value={rank} onChange={e => setRank(e.target.value)} placeholder="Напр.: кладовщик, ст. сержант" />
              </div>
              <div className="space-y-1.5">
                <Label>ФИО получателя</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иванов И.И." />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Название *</Label>
              <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="ООО Поставщик" autoFocus />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Контакт</Label>
            <Input value={contact} onChange={e => setContact(e.target.value)} placeholder="Телефон, email..." />
          </div>
          <div className="space-y-1.5">
            <Label>Примечание</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Доп. информация..." />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button disabled={!canSave} onClick={handleSave} className="flex-1">
              {isEdit ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}