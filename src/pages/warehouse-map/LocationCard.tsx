import { memo } from 'react';
import Icon from '@/components/ui/icon';
import { AppState, Location } from '@/data/store';
import { getStockLevel, stockDotColor } from './WarehouseMapHelpers';
import { useLocationStocks, computeWorstLevel } from './useLocationStocks';

type Props = {
  location: Location;
  state: AppState;
  isSelected: boolean;
  isDragOver: boolean;
  /** Стабильные колбэки из useCallback — location.id передаётся параметром.
   *  Так React.memo осмысленно ловит повторные рендеры родителя. */
  onSelect: (locationId: string) => void;
  onDragOver: (e: React.DragEvent, locationId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, locationId: string) => void;
  onItemDragStart: (e: React.DragEvent, itemId: string, fromLocationId: string) => void;
  color: string;
  search: string;
  categoryFilter: string;
};

function LocationCardImpl({
  location, state, isSelected, isDragOver,
  onSelect, onDragOver, onDragLeave, onDrop, onItemDragStart,
  color, search, categoryFilter,
}: Props) {
  const locId = location.id;
  const handleSelect = () => onSelect(locId);
  const handleDragOver = (e: React.DragEvent) => onDragOver(e, locId);
  const handleDrop = (e: React.DragEvent) => onDrop(e, locId);
  const itemsHere = useLocationStocks(state, location.id, { search, categoryFilter });
  const worstLevel = computeWorstLevel(itemsHere);

  const hasHighlight = search || categoryFilter !== 'all';
  const dimmed = hasHighlight && itemsHere.length === 0;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onClick={handleSelect}
      className={`relative rounded-xl border-2 cursor-pointer transition-all duration-150 select-none overflow-hidden
        ${isSelected ? 'border-primary shadow-card-hover' : isDragOver ? 'border-primary/60 bg-accent/30' : 'border-border hover:border-primary/40 hover:shadow-card'}
        ${dimmed ? 'opacity-35' : ''}
        bg-card shadow-card`}
      style={{ minHeight: '120px' }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: color }} />

      <div className="p-3">
        <div className="flex items-start justify-between gap-1 mb-2">
          <div>
            <div className="font-semibold text-xs text-foreground leading-tight">{location.name}</div>
            {location.description && (
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{location.description}</div>
            )}
          </div>
          {itemsHere.length > 0 && (
            <div className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${stockDotColor(worstLevel)}`} />
          )}
        </div>

        {isDragOver ? (
          <div className="flex flex-col items-center justify-center py-2 gap-1 text-primary">
            <Icon name="PackagePlus" size={18} />
            <span className="text-[10px] font-medium">Переместить сюда</span>
          </div>
        ) : itemsHere.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/50 italic text-center py-2">пусто</div>
        ) : (
          <div className="space-y-1">
            {itemsHere.slice(0, 4).map(ls => {
              const level = getStockLevel(ls.quantity, ls.item.lowStockThreshold);
              return (
                <div
                  key={ls.itemId}
                  draggable
                  onDragStart={e => { e.stopPropagation(); onItemDragStart(e, ls.itemId, location.id); }}
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing group/item"
                  title={`${ls.item.name} — перетащите для перемещения`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${stockDotColor(level)}`} />
                  <span className="text-[10px] text-foreground flex-1 truncate leading-tight">{ls.item.name}</span>
                  <span className={`text-[10px] font-bold tabular-nums shrink-0
                    ${level === 'critical' ? 'text-destructive' : level === 'low' ? 'text-warning' : 'text-muted-foreground'}`}>
                    {ls.quantity}
                    <span className="font-normal ml-0.5">{ls.item.unit}</span>
                  </span>
                </div>
              );
            })}
            {itemsHere.length > 4 && (
              <div className="text-[10px] text-muted-foreground text-center">+{itemsHere.length - 4} ещё...</div>
            )}
          </div>
        )}
      </div>

      {isDragOver && (
        <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-xl pointer-events-none" />
      )}
    </div>
  );
}

/** Мемоизация карточки локации.
 *  Самая «дорогая» операция здесь — useLocationStocks внутри. Без memo карточка
 *  перерендеривается на любой чих в родителе (drag-hover, выбор другой локации).
 *  Сравниваем по ссылкам на слайсы state, от которых реально зависит вывод:
 *  locationStocks, items, locations (для parent-check). Всё остальное —
 *  примитивы и стабильные колбэки. */
const LocationCard = memo(LocationCardImpl, (prev, next) => {
  if (prev.location !== next.location) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isDragOver !== next.isDragOver) return false;
  if (prev.color !== next.color) return false;
  if (prev.search !== next.search) return false;
  if (prev.categoryFilter !== next.categoryFilter) return false;
  // Эти 2 слайса — реальные источники содержимого карточки.
  if (prev.state.locationStocks !== next.state.locationStocks) return false;
  if (prev.state.items !== next.state.items) return false;
  // Колбэки ожидаются стабильными из родителя (обычно useCallback).
  if (prev.onSelect !== next.onSelect) return false;
  if (prev.onDragOver !== next.onDragOver) return false;
  if (prev.onDragLeave !== next.onDragLeave) return false;
  if (prev.onDrop !== next.onDrop) return false;
  if (prev.onItemDragStart !== next.onItemDragStart) return false;
  return true;
});

export default LocationCard;