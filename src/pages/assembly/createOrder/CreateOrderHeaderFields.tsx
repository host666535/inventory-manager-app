import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import { AppState } from '@/data/store';

type Props = {
  state: AppState;
  number: string;
  setNumber: (v: string) => void;
  selectedWarehouseId: string;
  setSelectedWarehouseId: (v: string) => void;
  recipientLabel: string;
  setRecipientLabel: (v: string) => void;
  setRecipientId: (v: string) => void;
  recipientOptions: AutocompleteOption[];
  receiverRank: string;
  setReceiverRank: (v: string) => void;
  receiverName: string;
  setReceiverName: (v: string) => void;
  requesterRank: string;
  setRequesterRank: (v: string) => void;
  requesterName: string;
  setRequesterName: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
};

export function CreateOrderHeaderFields({
  state,
  number, setNumber,
  selectedWarehouseId, setSelectedWarehouseId,
  recipientLabel, setRecipientLabel, setRecipientId,
  recipientOptions,
  receiverRank, setReceiverRank,
  receiverName, setReceiverName,
  // requesterRank/Name больше не редактируются вручную —
  // они автоматически дублируются из receiver* в логике сохранения.
  requesterRank: _requesterRank,
  setRequesterRank: _setRequesterRank,
  requesterName: _requesterName,
  setRequesterName: _setRequesterName,
  comment, setComment,
}: Props) {
  void _requesterRank; void _setRequesterRank; void _requesterName; void _setRequesterName;
  return (
    <>
      {/* Number */}
      <div className="space-y-1.5 max-w-[200px]">
        <Label>Номер</Label>
        <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="ЗС-001" />
      </div>

      {/* Warehouse selector */}
      {(state.warehouses || []).length > 0 && (
        <div className="space-y-1.5">
          <Label>Склад-отправитель</Label>
          <div className="flex flex-wrap gap-2">
            {(state.warehouses || []).map(wh => (
              <button
                key={wh.id}
                type="button"
                onClick={() => setSelectedWarehouseId(wh.id === selectedWarehouseId ? '' : wh.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
                  ${selectedWarehouseId === wh.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                  }`}
              >
                <Icon name="Warehouse" size={14} />
                {wh.name}
              </button>
            ))}
          </div>
          {!selectedWarehouseId && (
            <p className="text-xs text-warning">Выберите склад — список товаров будет ограничен его остатками</p>
          )}
          {selectedWarehouseId && (
            <p className="text-xs text-muted-foreground">Показаны только товары с остатком на выбранном складе</p>
          )}
        </div>
      )}

      {/* Recipient — каскадный выбор Объединение → Соединение */}
      <RecipientHierarchyPicker
        state={state}
        recipientLabel={recipientLabel}
        setRecipientLabel={setRecipientLabel}
        setRecipientId={setRecipientId}
        recipientOptions={recipientOptions}
        receiverRank={receiverRank}
        setReceiverRank={setReceiverRank}
        receiverName={receiverName}
        setReceiverName={setReceiverName}
      />

      {/* Затребовал = Получил — отдельный блок убран по требованию.
          В заявку всё равно записываются оба поля (requesterRank/Name
          дублируются из receiverRank/Name в logic.handleSubmit). */}

      {/* Receiver for invoice */}
      <div className="rounded-xl border-2 border-success/30 bg-success/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-success uppercase tracking-wide">
          <Icon name="UserCheck" size={12} />
          Получил — кто фактически забирает ТМЦ
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Подразделение укажи выше в «Кому выдаём». Здесь — должность и ФИО того, кто расписывается.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Должность / звание</Label>
            <Input value={receiverRank} onChange={e => setReceiverRank(e.target.value)} placeholder="Напр.: кладовщик" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ФИО (расшифровка подписи)</Label>
            <Input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="Иванов И.И." />
          </div>
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-1.5">
        <Label>Комментарий</Label>
        <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Примечание, приоритет..." />
      </div>
    </>
  );
}

// ─── Каскадный выбор получателя: Объединение → Соединение ────────────────────
type RecipientPickerProps = {
  state: AppState;
  recipientLabel: string;
  setRecipientLabel: (v: string) => void;
  setRecipientId: (v: string) => void;
  recipientOptions: AutocompleteOption[];
  receiverRank: string;
  setReceiverRank: (v: string) => void;
  receiverName: string;
  setReceiverName: (v: string) => void;
};

function RecipientHierarchyPicker({
  state,
  recipientLabel, setRecipientLabel, setRecipientId,
  recipientOptions,
  receiverRank, setReceiverRank,
  receiverName, setReceiverName,
}: RecipientPickerProps) {
  // Восстанавливаем начальные значения из recipientLabel при первой отрисовке
  // (формат: "Объединение / Соединение [— ФИО]")
  const initial = useMemo(() => {
    const lbl = (recipientLabel || '').trim();
    if (!lbl) return { group: '', formation: '' };
    // Пробуем найти партнёра по name — у него уже сохранены unitGroup/unitFormation
    const p = state.partners.find(pp => pp.type === 'recipient' && pp.name === lbl);
    if (p?.unitGroup || p?.unitFormation) {
      return { group: p.unitGroup || '', formation: p.unitFormation || '' };
    }
    // Парсим из department: "ГМП / 61 обрмп"
    const dept = p?.department || lbl.split(' — ')[0] || '';
    const parts = dept.split(' / ').map(s => s.trim()).filter(Boolean);
    return { group: parts[0] || '', formation: parts[1] || '' };
  }, [recipientLabel, state.partners]);

  const [unitGroup, setUnitGroup] = useState(initial.group);
  const [unitFormation, setUnitFormation] = useState(initial.formation);

  // Все Объединения из справочника получателей
  const groups = useMemo(() => {
    const set = new Set<string>();
    state.partners
      .filter(p => p.type === 'recipient' && p.unitGroup)
      .forEach(p => set.add((p.unitGroup as string).trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [state.partners]);

  // Соединения, относящиеся к выбранному Объединению
  const formations = useMemo(() => {
    if (!unitGroup) return [] as string[];
    const set = new Set<string>();
    state.partners
      .filter(p => p.type === 'recipient' && p.unitGroup === unitGroup && p.unitFormation)
      .forEach(p => set.add((p.unitFormation as string).trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [state.partners, unitGroup]);

  const applyHierarchy = (group: string, formation: string) => {
    setUnitGroup(group);
    setUnitFormation(formation);
    const dept = [group, formation].filter(Boolean).join(' / ');
    setRecipientLabel(dept);
    // Найдём партнёра по совпадению иерархии
    const p = state.partners.find(pp =>
      pp.type === 'recipient' &&
      (pp.unitGroup || '') === group &&
      (pp.unitFormation || '') === formation
    );
    if (p) {
      setRecipientId(p.id);
      if (p.rank && !receiverRank.trim()) setReceiverRank(p.rank);
      if (p.fullName && !receiverName.trim()) setReceiverName(p.fullName);
    } else {
      setRecipientId('');
    }
  };

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
        <Icon name="Network" size={12} />
        Структурное подразделение — получатель
      </div>

      {/* Объединения */}
      <div className="space-y-1.5">
        <Label className="text-xs">Объединение</Label>
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {groups.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => applyHierarchy(g, '')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${unitGroup === g ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground border border-border'}`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
        <Input
          value={unitGroup}
          onChange={e => applyHierarchy(e.target.value, '')}
          placeholder="Напр.: ГМП, ЧНП"
          className="h-9"
        />
      </div>

      {/* Соединения, привязанные к Объединению */}
      <div className="space-y-1.5">
        <Label className="text-xs">Соединение</Label>
        {formations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {formations.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => applyHierarchy(unitGroup, f)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${unitFormation === f ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground border border-border'}`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <Input
          value={unitFormation}
          onChange={e => applyHierarchy(unitGroup, e.target.value)}
          placeholder={unitGroup ? 'Напр.: 61 обрмп' : 'Сначала выберите Объединение'}
          className="h-9"
          disabled={!unitGroup}
        />
      </div>

      {/* Свободный режим: вписать без иерархии (для совместимости со старыми получателями) */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
          Указать получателя из справочника напрямую
        </summary>
        <div className="mt-2">
          <Autocomplete
            value={recipientLabel}
            onChange={v => { setRecipientLabel(v); setRecipientId(''); }}
            onSelect={opt => {
              setRecipientLabel(opt.label);
              const pid = opt.id === '__new__' ? '' : opt.id;
              setRecipientId(pid);
              if (pid) {
                const partner = state.partners.find(p => p.id === pid);
                if (partner) {
                  setUnitGroup(partner.unitGroup || '');
                  setUnitFormation(partner.unitFormation || '');
                  if (partner.rank && !receiverRank.trim()) setReceiverRank(partner.rank);
                  if (partner.fullName && !receiverName.trim()) setReceiverName(partner.fullName);
                }
              }
            }}
            options={recipientOptions}
            placeholder="Любое наименование..."
            allowCustom
          />
        </div>
      </details>

      {(unitGroup || unitFormation || recipientLabel) && (
        <div className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">
          В накладной: <span className="font-semibold text-foreground">{recipientLabel || '—'}</span>
        </div>
      )}
    </div>
  );
}