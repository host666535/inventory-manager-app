import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState, Location } from '@/data/store';
import LocationCard from './LocationCard';

type Props = {
  state: AppState;
  activeWarehouseId: string;
  topLocations: Location[];
  childLocations: (parentId: string) => Location[];
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  dragOverLocationId: string | null;
  locationColors: Record<string, string>;
  search: string;
  categoryFilter: string;
  rackDirs: Record<string, 'horizontal' | 'vertical'>;
  toggleRackDir: (rackId: string) => void;
  setEditLocation: (l: Location | undefined) => void;
  setShowAddLocation: (v: boolean) => void;
  handleDeleteLocation: (id: string) => void;
  handleDragOver: (e: React.DragEvent, id: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, id: string) => void;
  handleItemDragStart: (e: React.DragEvent, itemId: string, fromLocationId: string) => void;
};

export default function WarehouseMapGrid({
  state, activeWarehouseId,
  topLocations, childLocations,
  selectedLocationId, setSelectedLocationId,
  dragOverLocationId, locationColors, search, categoryFilter,
  rackDirs, toggleRackDir,
  setEditLocation, setShowAddLocation, handleDeleteLocation,
  handleDragOver, handleDragLeave, handleDrop, handleItemDragStart,
}: Props) {
  // Стабильный toggle — не пересоздаётся, только читает актуальный selectedLocationId.
  const handleCardSelect = useCallback((locationId: string) => {
    setSelectedLocationId(selectedLocationId === locationId ? null : locationId);
  }, [selectedLocationId, setSelectedLocationId]);

  if (state.locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-2xl">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon name="Map" size={28} className="text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">Карта склада пуста</h3>
        <p className="text-sm text-muted-foreground mb-4">Добавьте первую локацию для начала работы</p>
        <Button onClick={() => setShowAddLocation(true)}>
          <Icon name="Plus" size={14} className="mr-1.5" />
          Добавить локацию
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {topLocations.map(topLoc => {
        const children = childLocations(topLoc.id);
        const isParent = children.length > 0;
        const parentStockUnits = isParent
          ? (state.locationStocks || [])
              .filter(ls => ls.locationId === topLoc.id && ls.quantity > 0)
              .reduce((s, ls) => s + ls.quantity, 0)
          : 0;
        const isSelected = selectedLocationId === topLoc.id;

        return (
          <div key={topLoc.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLocationId(isSelected ? null : topLoc.id)}
                className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-muted/60 ${isSelected ? 'bg-primary/10' : ''}`}
                title={isParent ? 'Открыть панель стеллажа (контейнер для полок)' : 'Открыть локацию'}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: locationColors[topLoc.id] }} />
                <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{topLoc.name}</span>
                {isParent && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                    <Icon name="Layers" size={10} />
                    {children.length} полк{children.length === 1 ? 'а' : children.length < 5 ? 'и' : ''}
                  </span>
                )}
                {parentStockUnits > 0 && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning flex items-center gap-1"
                    title="На этом стеллаже лежат товары — перенесите их на полки"
                  >
                    <Icon name="AlertTriangle" size={10} />
                    {parentStockUnits} не на полке
                  </span>
                )}
              </button>
              {topLoc.description && <span className="text-xs text-muted-foreground">· {topLoc.description}</span>}
              <div className="flex-1 h-px bg-border" />
              <button
                onClick={() => toggleRackDir(topLoc.id)}
                title={rackDirs[topLoc.id] === 'vertical' ? 'Вертикально → Горизонтально' : 'Горизонтально → Вертикально'}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Icon name={rackDirs[topLoc.id] === 'vertical' ? 'ArrowDown' : 'ArrowRight'} size={11} />
              </button>
              <button
                onClick={() => { setEditLocation(topLoc); setShowAddLocation(true); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Icon name="Pencil" size={11} />
              </button>
              <button
                onClick={() => handleDeleteLocation(topLoc.id)}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <Icon name="Trash2" size={11} />
              </button>
            </div>

            <div className={rackDirs[topLoc.id] === 'vertical' ? 'flex flex-col gap-2' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2'}>
              {(children.length > 0 ? children : [topLoc]).map(loc => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  state={state}
                  isSelected={selectedLocationId === loc.id}
                  isDragOver={dragOverLocationId === loc.id}
                  onSelect={handleCardSelect}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onItemDragStart={handleItemDragStart}
                  color={locationColors[loc.id]}
                  search={search}
                  categoryFilter={categoryFilter}
                />
              ))}
              <button
                onClick={() => {
                  setEditLocation({ id: '', name: '', parentId: topLoc.id, warehouseId: activeWarehouseId });
                  setShowAddLocation(true);
                }}
                className="rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground hover:text-foreground"
                style={{ minHeight: '120px' }}
              >
                <Icon name="Plus" size={18} />
                <span className="text-[11px] font-medium">Добавить полку</span>
              </button>
            </div>
          </div>
        );
      })}

      <button
        onClick={() => { setEditLocation(undefined); setShowAddLocation(true); }}
        className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex items-center justify-center gap-2 py-6 text-muted-foreground hover:text-foreground"
      >
        <Icon name="Plus" size={16} />
        <span className="text-sm font-medium">Добавить зону / стеллаж</span>
      </button>
    </div>
  );
}