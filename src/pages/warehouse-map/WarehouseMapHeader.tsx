import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, Warehouse } from '@/data/store';

type Props = {
  state: AppState;
  warehouses: Warehouse[];
  activeWarehouse: Warehouse | undefined;
  activeWarehouseId: string;
  setActiveWarehouseId: (id: string) => void;
  setSelectedLocationId: (id: string | null) => void;
  totalLocations: number;
  occupiedLocations: number;
  lowItems: number;
  criticalItems: number;
  search: string;
  setSearch: (s: string) => void;
  categoryFilter: string;
  setCategoryFilter: (s: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (fn: (v: 'grid' | 'list') => 'grid' | 'list') => void;
  setShowTransferModal: (v: boolean) => void;
  onOpenAdd: () => void;
};

export default function WarehouseMapHeader({
  state, warehouses, activeWarehouse, activeWarehouseId, setActiveWarehouseId,
  setSelectedLocationId,
  totalLocations, occupiedLocations, lowItems, criticalItems,
  search, setSearch, categoryFilter, setCategoryFilter,
  viewMode, setViewMode, setShowTransferModal, onOpenAdd,
}: Props) {
  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Карта складов</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {warehouses.length} склад{warehouses.length !== 1 ? 'а' : ''} · {totalLocations} локаций на этом складе
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {warehouses.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => setShowTransferModal(true)} className="flex items-center gap-1.5">
              <Icon name="ArrowLeftRight" size={14} />
              Переместить
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')} className="flex items-center gap-1.5">
            <Icon name={viewMode === 'grid' ? 'List' : 'LayoutGrid'} size={14} />
            {viewMode === 'grid' ? 'Список' : 'Сетка'}
          </Button>
          <Button onClick={onOpenAdd} className="flex items-center gap-2">
            <Icon name="Plus" size={15} />
            Стеллаж
          </Button>
        </div>
      </div>

      {warehouses.length > 1 && (
        <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
          {warehouses.map(wh => {
            const whTotal = (state.warehouseStocks || [])
              .filter(ws => ws.warehouseId === wh.id)
              .reduce((s, ws) => s + ws.quantity, 0);
            const isActive = wh.id === activeWarehouseId;
            return (
              <button
                key={wh.id}
                onClick={() => { setActiveWarehouseId(wh.id); setSelectedLocationId(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0
                  ${isActive ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon name="Warehouse" size={14} />
                {wh.name}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
                  {whTotal}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeWarehouse && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <Icon name="Warehouse" size={18} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground text-sm">{activeWarehouse.name}</div>
            {activeWarehouse.address && <div className="text-xs text-muted-foreground">{activeWarehouse.address}</div>}
          </div>
          {warehouses.length > 1 && (
            <button onClick={() => setShowTransferModal(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
              <Icon name="ArrowLeftRight" size={12} />Переместить товар
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Локаций', value: totalLocations, icon: 'MapPin', color: 'text-primary' },
          { label: 'Занято', value: occupiedLocations, icon: 'Package', color: 'text-foreground' },
          { label: 'Мало', value: lowItems, icon: 'AlertTriangle', color: 'text-warning' },
          { label: 'Нет', value: criticalItems, icon: 'XCircle', color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={15} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-0 sm:min-w-44">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Найти товар, серийник или штрих-код..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Icon name="X" size={13} /></button>}
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer">
          <option value="all">Все категории</option>
          {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" />В норме</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" />Мало</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" />Нет</span>
        <span className="flex items-center gap-1.5 ml-auto"><Icon name="GripHorizontal" size={12} />Перетащите товар между локациями</span>
      </div>
    </>
  );
}