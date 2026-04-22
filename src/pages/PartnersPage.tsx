import { useState, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';
import { PartnerTab, PeriodPreset, getPeriodDates, inPeriod } from './partners/utils';
import { PeriodFilter } from './partners/PeriodFilter';
import { PartnerTable } from './partners/PartnerTable';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

export default function PartnersPage({ state, onStateChange }: Props) {
  const [tab, setTab] = useState<PartnerTab>('suppliers');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from: periodFrom, to: periodTo } = useMemo(
    () => getPeriodDates(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );

  const suppliers = state.partners.filter(p => p.type === 'supplier');
  const recipients = state.partners.filter(p => p.type === 'recipient');

  const opsInPeriod = useMemo(
    () => state.operations.filter(op => inPeriod(op.date, periodFrom, periodTo)),
    [state.operations, periodFrom, periodTo]
  );
  const totalSupplied = opsInPeriod.filter(o => o.type === 'in').reduce((s, o) => s + o.quantity, 0);
  const totalIssued = opsInPeriod.filter(o => o.type === 'out').reduce((s, o) => s + o.quantity, 0);

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Поставщики и Получатели</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{suppliers.length} поставщиков · {recipients.length} получателей</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-3 shadow-card">
        <PeriodFilter
          preset={periodPreset}
          onPresetChange={setPeriodPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Поставщиков', value: suppliers.length, icon: 'Truck', color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Получателей', value: recipients.length, icon: 'Users', color: 'text-success' },
          { label: 'Принято за период', value: totalSupplied, icon: 'ArrowDownToLine', color: 'text-success' },
          { label: 'Выдано за период', value: totalIssued, icon: 'ArrowUpFromLine', color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={16} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button onClick={() => setTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${tab === 'suppliers' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Icon name="Truck" size={14} />
          Поставщики
          <span className={`text-xs px-1.5 rounded-full ${tab === 'suppliers' ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{suppliers.length}</span>
        </button>
        <button onClick={() => setTab('recipients')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${tab === 'recipients' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Icon name="Users" size={14} />
          Получатели
          <span className={`text-xs px-1.5 rounded-full ${tab === 'recipients' ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{recipients.length}</span>
        </button>
      </div>

      <div className="animate-fade-in">
        {tab === 'suppliers' ? (
          <PartnerTable partners={suppliers} type="supplier" state={state} onStateChange={onStateChange} periodFrom={periodFrom} periodTo={periodTo} />
        ) : (
          <PartnerTable partners={recipients} type="recipient" state={state} onStateChange={onStateChange} periodFrom={periodFrom} periodTo={periodTo} />
        )}
      </div>
    </div>
  );
}
