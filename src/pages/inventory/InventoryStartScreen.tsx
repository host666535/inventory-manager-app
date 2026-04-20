import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';

type Props = {
  state: AppState;
  warehouseFilter: string;
  setWarehouseFilter: (v: string) => void;
  startInventory: () => void;
};

export default function InventoryStartScreen({
  state,
  warehouseFilter,
  setWarehouseFilter,
  startInventory,
}: Props) {
  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Инвентаризация</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Сверка фактических остатков с системными данными
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-5">
        {/* Info */}
        <div className="flex gap-3 items-start p-4 rounded-lg bg-primary/5 border border-primary/15">
          <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Icon name="ClipboardCheck" size={18} />
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Как проходит инвентаризация</p>
            <p className="text-muted-foreground leading-relaxed">
              Выберите склад и нажмите «Начать». Вводите фактическое количество вручную
              или сканируйте QR-коды товаров — каждый скан добавит +1 к остатку.
              Можно отсканировать QR полки, чтобы отфильтровать список её товаров.
              По завершении система создаст операции прихода (излишки) и расхода (недостачи).
            </p>
          </div>
        </div>

        {/* Warehouse selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Склад</Label>
          <select
            value={warehouseFilter}
            onChange={e => setWarehouseFilter(e.target.value)}
            className="w-full h-10 px-3 pr-8 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="all">Все склады</option>
            {state.warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        {/* Items count preview */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="Package" size={14} />
          <span>
            Товаров для проверки:{' '}
            <span className="font-semibold text-foreground">
              {warehouseFilter === 'all'
                ? state.items.length
                : new Set(
                    (state.warehouseStocks || [])
                      .filter(ws => ws.warehouseId === warehouseFilter && ws.quantity > 0)
                      .map(ws => ws.itemId),
                  ).size}
            </span>
          </span>
        </div>

        {/* Start button */}
        <Button
          onClick={startInventory}
          className="w-full h-11 text-base gap-2"
          disabled={state.items.length === 0}
        >
          <Icon name="ClipboardCheck" size={18} />
          Начать инвентаризацию
        </Button>
      </div>
    </div>
  );
}
