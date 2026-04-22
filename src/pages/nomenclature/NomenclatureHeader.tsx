import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';

type StockFilter = 'all' | 'low' | 'zero' | 'ok';

type Props = {
  state: AppState;
  search: string;
  setSearch: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  locationFilter: string;
  setLocationFilter: (v: string) => void;
  stockFilter: StockFilter;
  setStockFilter: (v: StockFilter) => void;
  onAddClick: () => void;
  zeroCount: number;
  lowCount: number;
  okCount: number;
  activeFilters: number;
};

export default function NomenclatureHeader({
  state, search, setSearch,
  categoryFilter, setCategoryFilter,
  locationFilter, setLocationFilter,
  stockFilter, setStockFilter,
  onAddClick, zeroCount, lowCount, okCount, activeFilters,
}: Props) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Номенклатура</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {state.items.length} позиций · {state.categories.length} категорий
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted transition-all shadow-sm active:scale-95 print:hidden"
          >
            <Icon name="FileDown" size={16} />
            Экспорт PDF
          </button>
          <button
            onClick={onAddClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            <Icon name="Plus" size={16} />
            Добавить номенклатуру
          </button>

          {zeroCount > 0 && (
            <button onClick={() => setStockFilter(stockFilter === 'zero' ? 'all' : 'zero')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                ${stockFilter === 'zero' ? 'bg-destructive text-destructive-foreground border-destructive' : 'border-destructive/30 text-destructive bg-destructive/8 hover:bg-destructive/15'}`}>
              <span className="w-2 h-2 rounded-full bg-current" />Нет: {zeroCount}
            </button>
          )}
          {lowCount > 0 && (
            <button onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                ${stockFilter === 'low' ? 'bg-warning text-warning-foreground border-warning' : 'border-warning/40 text-warning bg-warning/8 hover:bg-warning/15'}`}>
              <span className="w-2 h-2 rounded-full bg-current" />Мало: {lowCount}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Поиск по названию, описанию..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Icon name="X" size={13} /></button>}
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer">
          <option value="all">Все категории</option>
          {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
          className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer">
          <option value="all">Все локации</option>
          {state.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {activeFilters > 0 && (
          <button onClick={() => { setSearch(''); setCategoryFilter('all'); setLocationFilter('all'); setStockFilter('all'); }}
            className="h-9 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors">
            <Icon name="X" size={13} />Сбросить ({activeFilters})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Всего', value: state.items.length, icon: 'Package', color: 'text-foreground' },
          { label: 'В норме', value: okCount, icon: 'CheckCircle2', color: 'text-success' },
          { label: 'Мало', value: lowCount, icon: 'AlertTriangle', color: 'text-warning' },
          { label: 'Нет', value: zeroCount, icon: 'XCircle', color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={16} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tip */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-accent/50 border border-primary/20 rounded-lg text-sm">
        <Icon name="Paperclip" size={14} className="text-primary shrink-0" />
        <span className="text-muted-foreground">Нажмите на позицию — откроется карточка с <b className="text-foreground">вложениями</b> (Word, PDF, фото), историей и операциями</span>
      </div>
    </>
  );
}
