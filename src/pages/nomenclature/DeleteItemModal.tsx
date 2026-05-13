import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState, Item, crudAction } from '@/data/store';

export default function DeleteItemModal({ item, state, onStateChange, onClose }: {
  item: Item; state: AppState; onStateChange: (s: AppState) => void; onClose: () => void;
}) {
  const usedInOrders = state.workOrders.filter(o =>
    ['active', 'draft', 'pending_stock'].includes(o.status) &&
    o.items.some(oi => oi.itemId === item.id)
  );

  const handleDelete = () => {
    const next: AppState = {
      ...state,
      items: state.items.filter(i => i.id !== item.id),
      operations: state.operations.filter(op => op.itemId !== item.id),
      locationStocks: state.locationStocks.filter(ls => ls.itemId !== item.id),
      warehouseStocks: (state.warehouseStocks || []).filter(ws => ws.itemId !== item.id),
      barcodes: (state.barcodes || []).filter(b => b.itemId !== item.id),
      techDocs: (state.techDocs || []).filter(d => d.itemId !== item.id),
      workOrders: state.workOrders.map(o => ({
        ...o,
        items: o.items.filter(oi => oi.itemId !== item.id),
      })),
    };
    onStateChange(next); crudAction('delete_item', { itemId: item.id }); onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[min(96vw,500px)] animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
              <Icon name="Trash2" size={16} />
            </div>
            Удалить номенклатуру?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground">«{item.name}»</b> будет удалён вместе с историей операций, остатками и вложениями. Это действие необратимо.
          </p>
          {usedInOrders.length > 0 && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm space-y-1">
              <div className="flex items-center gap-2 font-semibold text-warning">
                <Icon name="AlertTriangle" size={14} />
                Используется в активных заявках
              </div>
              {usedInOrders.map(o => (
                <div key={o.id} className="text-xs text-muted-foreground pl-5">{o.number} — {o.title}</div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleDelete} className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold">
              <Icon name="Trash2" size={14} className="mr-1.5" />Удалить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}