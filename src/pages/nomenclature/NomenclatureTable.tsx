import Icon from '@/components/ui/icon';
import { AppState, Item } from '@/data/store';

export type SortField = 'name' | 'quantity' | 'category' | 'location' | 'date';
export type SortDir = 'asc' | 'desc';

type Props = {
  state: AppState;
  filtered: Item[];
  sortField: SortField;
  sortDir: SortDir;
  handleSort: (field: SortField) => void;
  onSelectItem: (id: string) => void;
  onDeleteItem: (item: Item) => void;
  onAddClick: () => void;
};

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <Icon name="ChevronsUpDown" size={11} className="text-muted-foreground/40 ml-1 shrink-0" />;
  return <Icon name={sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={11} className="text-primary ml-1 shrink-0" />;
}

export default function NomenclatureTable({
  state, filtered, sortField, sortDir, handleSort,
  onSelectItem, onDeleteItem, onAddClick,
}: Props) {
  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon name="PackageSearch" size={28} className="text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">
          {state.items.length === 0 ? 'Номенклатура пуста' : 'Позиции не найдены'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {state.items.length === 0
            ? 'Добавьте первую позицию вручную или через Оприходование'
            : 'Попробуйте изменить фильтры'}
        </p>
        {state.items.length === 0 && (
          <button
            onClick={onAddClick}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm"
          >
            <Icon name="Plus" size={16} />
            Добавить первую позицию
          </button>
        )}
      </div>
    );
  }

  const warehouses = state.warehouses || [];

  return (
    <div className="print-area">
      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 w-8 text-xs text-muted-foreground/50">#</th>
              {([['name','Наименование'],['category','Категория']] as [SortField,string][]).map(([f,l]) => (
                <th key={f} onClick={() => handleSort(f)}
                  className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none text-left">
                  <span className="flex items-center">{l}<SortIcon field={f} sortField={sortField} sortDir={sortDir} /></span>
                </th>
              ))}
              {warehouses.map(wh => (
                <th key={wh.id} className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right whitespace-nowrap">
                  {wh.name}
                </th>
              ))}
              <th onClick={() => handleSort('quantity')}
                className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none text-right">
                <span className="flex items-center justify-end">Итого<SortIcon field="quantity" sortField={sortField} sortDir={sortDir} /></span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Порог</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Статус</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Icon name="Paperclip" size={12} className="mx-auto" />
              </th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => {
              const cat = state.categories.find(c => c.id === item.categoryId);
              const isLow = item.quantity > 0 && item.quantity <= item.lowStockThreshold;
              const isZero = item.quantity === 0;
              const attCount = item.attachments?.length || 0;
              const whStockMap = new Map(
                (state.warehouseStocks || [])
                  .filter(ws => ws.itemId === item.id)
                  .map(ws => [ws.warehouseId, ws.quantity])
              );

              return (
                <tr key={item.id} onClick={() => onSelectItem(item.id)}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer group transition-colors animate-fade-in"
                  style={{ animationDelay: `${idx * 12}ms` }}>
                  <td className="px-4 py-3 text-xs text-muted-foreground/30 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">{item.name}</div>
                    {item.description && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{item.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {cat ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.color + '18', color: cat.color }}>{cat.name}</span>
                    ) : '—'}
                  </td>
                  {warehouses.map(wh => {
                    const qty = whStockMap.get(wh.id) || 0;
                    return (
                      <td key={wh.id} className="px-3 py-3 text-right tabular-nums text-sm">
                        {qty > 0 ? (
                          <span className="font-semibold text-foreground">{qty}</span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold tabular-nums text-base ${isZero ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>{item.quantity}</span>
                    <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">{item.lowStockThreshold}</td>
                  <td className="px-4 py-3 text-center">
                    {isZero ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/12 text-destructive"><span className="w-1.5 h-1.5 rounded-full bg-current" />Нет</span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/12 text-warning"><span className="w-1.5 h-1.5 rounded-full bg-current" />Мало</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/12 text-success"><span className="w-1.5 h-1.5 rounded-full bg-current" />Норма</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {attCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                        <Icon name="Paperclip" size={12} />{attCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onDeleteItem(item)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Icon name="Trash2" size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          Показано {filtered.length} из {state.items.length} · Нажмите на строку для открытия карточки и вложений
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {filtered.map((item, idx) => {
          const cat = state.categories.find(c => c.id === item.categoryId);
          const isLow = item.quantity > 0 && item.quantity <= item.lowStockThreshold;
          const isZero = item.quantity === 0;
          const attCount = item.attachments?.length || 0;
          const whStocks = (state.warehouseStocks || [])
            .filter(ws => ws.itemId === item.id && ws.quantity > 0)
            .map(ws => ({ ...ws, wh: (state.warehouses || []).find(w => w.id === ws.warehouseId) }))
            .filter(ws => ws.wh);
          return (
            <div key={item.id}
              className="bg-card rounded-xl border border-border shadow-card hover:border-primary/30 transition-all animate-fade-in flex items-stretch"
              style={{ animationDelay: `${idx * 20}ms` }}>
              <button onClick={() => onSelectItem(item.id)} className="flex-1 text-left p-3.5 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground">{item.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {cat && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cat.color + '18', color: cat.color }}>{cat.name}</span>}
                      {attCount > 0 && <span className="text-xs text-primary flex items-center gap-0.5"><Icon name="Paperclip" size={10} />{attCount} файл.</span>}
                    </div>
                    {whStocks.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {whStocks.map(ws => (
                          <div key={ws.warehouseId} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Icon name="Warehouse" size={10} />{ws.wh!.name}
                            </span>
                            <span className="font-semibold text-foreground tabular-nums">{ws.quantity} {item.unit}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-xs pt-0.5 mt-0.5 border-t border-border">
                          <span className="text-muted-foreground uppercase tracking-wide" style={{ fontSize: '10px' }}>Итого</span>
                          <span className={`font-bold tabular-nums ${isZero ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {whStocks.length === 0 && (
                    <div className={`text-lg font-bold tabular-nums shrink-0 ${isZero ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>
                      {item.quantity} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                    </div>
                  )}
                </div>
              </button>
              <button
                onClick={() => onDeleteItem(item)}
                className="px-3 flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/8 border-l border-border/50 rounded-r-xl transition-colors shrink-0"
              >
                <Icon name="Trash2" size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
