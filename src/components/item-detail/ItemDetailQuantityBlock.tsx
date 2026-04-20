import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Item, AppState } from '@/data/store';

type WhStock = {
  itemId: string;
  warehouseId: string;
  quantity: number;
  warehouse: AppState['warehouses'][number] | undefined;
};

type Props = {
  liveItem: Item;
  state: AppState;
  whStocks: WhStock[];
  isLow: boolean;
  isCritical: boolean;
  setOpType: (t: 'in' | 'out' | null) => void;
};

export default function ItemDetailQuantityBlock({ liveItem, state, whStocks, isLow, isCritical, setOpType }: Props) {
  return (
    <div className={`p-4 rounded-xl border-2 space-y-3
      ${isCritical ? 'bg-destructive/8 border-destructive/30' : isLow ? 'bg-warning/8 border-warning/30' : 'bg-muted/50 border-transparent'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Текущий остаток</div>
          <div className={`text-4xl font-bold tabular-nums ${isCritical ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>
            {liveItem.quantity}
            <span className="text-base font-normal text-muted-foreground ml-1.5">{liveItem.unit}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">порог: {liveItem.lowStockThreshold} {liveItem.unit}</div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button onClick={() => setOpType('in')}
            className="bg-success hover:bg-success/90 text-success-foreground font-semibold h-9 px-3 text-sm">
            <Icon name="Plus" size={14} className="mr-1" />Приход
          </Button>
          <Button variant="outline" onClick={() => setOpType('out')} disabled={liveItem.quantity === 0}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 font-semibold h-9 px-3 text-sm">
            <Icon name="Minus" size={14} className="mr-1" />Расход
          </Button>
        </div>
      </div>

      {/* Warehouse + location stocks */}
      {whStocks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Icon name="Warehouse" size={11} />Остатки по складам:
          </div>
          <div className="space-y-1.5">
            {whStocks.map(ws => {
              const whLocStocks = (state.locationStocks || [])
                .filter(ls => ls.itemId === liveItem.id && ls.quantity > 0)
                .map(ls => ({ ...ls, loc: state.locations.find(l => l.id === ls.locationId) }))
                .filter(ls => ls.loc);
              return (
                <div key={ws.warehouseId} className="rounded-lg border border-border bg-background/70 overflow-hidden">
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/30">
                    <div className="flex items-center gap-1.5">
                      <Icon name="Warehouse" size={11} className="text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground">{ws.warehouse?.name}</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${ws.quantity === 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {ws.quantity} <span className="text-xs font-normal text-muted-foreground">{liveItem.unit}</span>
                    </span>
                  </div>
                  {whLocStocks.length > 0 && (
                    <div className="divide-y divide-border/50">
                      {whLocStocks.map(ls => (
                        <div key={ls.locationId} className="flex items-center justify-between px-3 py-1 text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Icon name="MapPin" size={9} />
                            <span>{ls.loc?.name}</span>
                            {ls.loc?.description && <span className="opacity-60">· {ls.loc.description}</span>}
                          </div>
                          <span className="font-semibold text-foreground">{ls.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


    </div>
  );
}
