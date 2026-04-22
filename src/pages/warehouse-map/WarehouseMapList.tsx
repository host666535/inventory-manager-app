import Icon from '@/components/ui/icon';
import { AppState, Location } from '@/data/store';
import { getStockLevel } from './WarehouseMapHelpers';

type Props = {
  state: AppState;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  locationColors: Record<string, string>;
  locationsWithMatches: Set<string>;
  search: string;
  categoryFilter: string;
  setEditLocation: (l: Location | undefined) => void;
  setShowAddLocation: (v: boolean) => void;
  handleDeleteLocation: (id: string) => void;
};

export default function WarehouseMapList({
  state, selectedLocationId, setSelectedLocationId,
  locationColors, locationsWithMatches, search, categoryFilter,
  setEditLocation, setShowAddLocation, handleDeleteLocation,
}: Props) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Локация</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Позиций</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Единиц</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Статус</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {state.locations.map(loc => {
            const stocks = (state.locationStocks || []).filter(ls => ls.locationId === loc.id && ls.quantity > 0);
            const items = stocks.map(ls => ({ ...ls, item: state.items.find(i => i.id === ls.itemId) })).filter(x => x.item);
            const units = stocks.reduce((s, ls) => s + ls.quantity, 0);
            const worstLevel = items.reduce<'ok' | 'low' | 'critical'>((w, ls) => {
              const lvl = getStockLevel(ls.quantity, ls.item!.lowStockThreshold);
              return lvl === 'critical' ? 'critical' : lvl === 'low' && w !== 'critical' ? 'low' : w;
            }, 'ok');
            const hasItems = items.length > 0;
            const highlight = locationsWithMatches.has(loc.id);

            return (
              <tr key={loc.id}
                className={`border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors ${!highlight && (search || categoryFilter !== 'all') ? 'opacity-40' : ''}`}
                onClick={() => setSelectedLocationId(selectedLocationId === loc.id ? null : loc.id)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: locationColors[loc.id] }} />
                    <div>
                      <div className="font-medium">{loc.name}</div>
                      {loc.description && <div className="text-xs text-muted-foreground">{loc.description}</div>}
                      {loc.parentId && <div className="text-xs text-muted-foreground">↳ {state.locations.find(l => l.id === loc.parentId)?.name}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{items.length}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{units}</td>
                <td className="px-4 py-3 text-center">
                  {!hasItems ? (
                    <span className="text-xs text-muted-foreground">пусто</span>
                  ) : worstLevel === 'critical' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/12 text-destructive"><span className="w-1.5 h-1.5 rounded-full bg-current" />Критично</span>
                  ) : worstLevel === 'low' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/12 text-warning"><span className="w-1.5 h-1.5 rounded-full bg-current" />Мало</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/12 text-success"><span className="w-1.5 h-1.5 rounded-full bg-current" />Норма</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={e => { e.stopPropagation(); setEditLocation(loc); setShowAddLocation(true); }}
                      className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <Icon name="Pencil" size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteLocation(loc.id); }}
                      className="w-7 h-7 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                      <Icon name="Trash2" size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
