import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { Item, AppState, AssetType, crudAction } from '@/data/store';
import { findDuplicateItem } from '@/data/validation';
import { toast } from 'sonner';
import { useItemPhoto } from '@/hooks/useItemPhoto';
import OperationModal from './OperationModal';
import { ItemHistoryTab } from './ItemHistoryTab';
import ItemDetailHeader from './item-detail/ItemDetailHeader';
import ItemDetailQuantityBlock from './item-detail/ItemDetailQuantityBlock';
import ItemDetailInfoTab from './item-detail/ItemDetailInfoTab';
import ItemDetailDocumentsTab from './item-detail/ItemDetailDocumentsTab';

import { loadBoard } from '@/pages/technician/BoardView';

type Tab = 'info' | 'history' | 'documents';

type Props = {
  item: Item | null;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
};

export default function ItemDetailModal({ item, state, onStateChange, onClose }: Props) {
  const [opType, setOpType] = useState<'in' | 'out' | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [edited, setEdited] = useState<{ name: string; unit: string; assetType: AssetType; description: string; categoryId: string; lowStockThreshold: number }>({ name: '', unit: '', assetType: 'МЗ', description: '', categoryId: '', lowStockThreshold: 5 });
  const liveItem = item ? (state.items.find(i => i.id === item.id) || item) : ({ id: '' } as Item);
  const photo = useItemPhoto(liveItem, state, onStateChange);

  if (!item) return null;
  const category = state.categories.find(c => c.id === liveItem.categoryId);
  const itemOps = state.operations
    .filter(o => o.itemId === liveItem.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isLow = liveItem.quantity <= liveItem.lowStockThreshold;
  const isCritical = liveItem.quantity === 0;

  const locStocks = (state.locationStocks || [])
    .filter(ls => ls.itemId === liveItem.id && ls.quantity > 0)
    .map(ls => ({ ...ls, location: state.locations.find(l => l.id === ls.locationId) }))
    .filter(ls => ls.location);

  const whStocks = (state.warehouseStocks || [])
    .filter(ws => ws.itemId === liveItem.id)
    .map(ws => ({ ...ws, warehouse: (state.warehouses || []).find(w => w.id === ws.warehouseId) }))
    .filter(ws => ws.warehouse);

  const handleOperation = (op: import('@/data/store').Operation, _newQty: number, updatedState?: AppState) => {
    const base = updatedState || state;
    const next: AppState = {
      ...base,
      operations: [op, ...base.operations],
    };
    onStateChange(next);
    crudAction('upsert_operation', { operation: op });
    setOpType(null);
  };

  const handleDelete = () => {
    const next: AppState = {
      ...state,
      items: state.items.filter(i => i.id !== liveItem.id),
      operations: state.operations.filter(op => op.itemId !== liveItem.id),
      locationStocks: state.locationStocks.filter(ls => ls.itemId !== liveItem.id),
      warehouseStocks: (state.warehouseStocks || []).filter(ws => ws.itemId !== liveItem.id),
      barcodes: (state.barcodes || []).filter(b => b.itemId !== liveItem.id),
      techDocs: (state.techDocs || []).filter(d => d.itemId !== liveItem.id),
      workOrders: state.workOrders.map(o => ({
        ...o,
        items: o.items.filter(oi => oi.itemId !== liveItem.id),
      })),
    };
    onStateChange(next);
    crudAction('delete_item', { itemId: liveItem.id });
    onClose();
  };

  const handleSaveEdit = async () => {
    if (savingEdit) return;
    const newName = edited.name.trim() || liveItem.name;
    const dup = findDuplicateItem(state, newName, edited.categoryId, liveItem.id);
    if (dup) {
      toast.error('Товар с таким названием уже существует в этой категории', {
        description: `Найден: «${dup.name}» (остаток ${dup.quantity} ${dup.unit}). Используй другое название или перенеси остатки.`,
      });
      return;
    }
    const updatedItem = {
      ...liveItem,
      name: newName,
      unit: edited.unit.trim() || liveItem.unit,
      assetType: edited.assetType,
      description: edited.description.trim(),
      categoryId: edited.categoryId,
      lowStockThreshold: edited.lowStockThreshold,
    };
    const next = { ...state, items: state.items.map(i => i.id === liveItem.id ? updatedItem : i) };
    onStateChange(next);
    setSavingEdit(true);
    const ok = await crudAction('upsert_item', { item: updatedItem, locationStocks: state.locationStocks.filter(ls => ls.itemId === liveItem.id), warehouseStocks: (state.warehouseStocks || []).filter(ws => ws.itemId === liveItem.id) });
    setSavingEdit(false);
    if (!ok) return;
    toast.success('Изменения сохранены');
    setEditing(false);
  };

  const itemDocs = (state.techDocs || []).filter(d => d.itemId === liveItem.id);
  const totalFilesCount = itemDocs.reduce((s, d) => s + d.attachments.length, 0);

  const boardLinkedFiles = (() => {
    const bd = loadBoard();
    const myNode = bd.nodes.find(n => n.type === 'item' && n.refId === liveItem.id);
    if (!myNode) return 0;
    return bd.connections
      .filter(c => c.fromId === myNode.id || c.toId === myNode.id)
      .filter(c => bd.nodes.find(n => n.id === (c.fromId === myNode.id ? c.toId : c.fromId))?.type === 'file')
      .length;
  })();

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'info',      label: 'Инфо',       icon: 'Info' },
    { id: 'history',   label: 'История',     icon: 'History',   badge: itemOps.length || undefined },
    { id: 'documents', label: 'Документы',   icon: 'Paperclip', badge: (totalFilesCount + boardLinkedFiles) || undefined },
  ];

  // reference locStocks to preserve derivations (kept for parity with original)
  void locStocks;

  return (
    <>
      <Dialog open={!!item} onOpenChange={onClose}>
        <DialogContent className="max-w-xl lg:max-w-2xl xl:max-w-3xl p-0 overflow-hidden animate-scale-in max-h-[95vh] flex flex-col">
          {/* Header image */}
          <ItemDetailHeader
            liveItem={liveItem}
            category={category}
            photo={photo}
            isLow={isLow}
            isCritical={isCritical}
            onClose={onClose}
          />

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Title */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold leading-tight flex-1 break-words min-w-0">
                  {editing ? (
                    <input value={edited.name} onChange={e => setEdited({...edited, name: e.target.value})}
                      className="w-full text-xl font-bold bg-transparent border-b border-border focus:border-primary focus:outline-none pb-1" />
                  ) : liveItem.name}
                </h2>
                {!editing && (
                  <button onClick={() => { setEditing(true); setEdited({ name: liveItem.name, unit: liveItem.unit, assetType: liveItem.assetType || 'МЗ', description: liveItem.description || '', categoryId: liveItem.categoryId || '', lowStockThreshold: liveItem.lowStockThreshold }); }}
                    className="w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center shrink-0 transition-colors">
                    <Icon name="Pencil" size={14} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {category && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: category.color + '20', color: category.color }}>
                    {category.name}
                  </span>
                )}
              </div>
              {liveItem.description && !editing && <p className="text-sm text-muted-foreground mt-1.5">{liveItem.description}</p>}
            </div>

            {/* Quantity block */}
            <ItemDetailQuantityBlock
              liveItem={liveItem}
              state={state}
              whStocks={whStocks}
              isLow={isLow}
              isCritical={isCritical}
              setOpType={setOpType}
            />

            {/* Tabs */}
            <div className="flex gap-0.5 p-1 bg-muted rounded-lg">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-md transition-all
                    ${activeTab === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon name={t.icon} size={13} />
                  {t.label}
                  {t.badge !== undefined && t.badge > 0 && (
                    <span className="bg-muted-foreground/20 text-[11px] px-1.5 rounded-full leading-4">{t.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'info' && (
              <ItemDetailInfoTab
                liveItem={liveItem}
                state={state}
                category={category}
                editing={editing}
                edited={edited}
                setEdited={setEdited}
                setEditing={setEditing}
                handleSaveEdit={handleSaveEdit}
                savingEdit={savingEdit}
                showDeleteConfirm={showDeleteConfirm}
                setShowDeleteConfirm={setShowDeleteConfirm}
                handleDelete={handleDelete}
              />
            )}

            {activeTab === 'history' && (
              <ItemHistoryTab liveItem={liveItem} itemOps={itemOps} state={state} />
            )}

            {activeTab === 'documents' && (
              <ItemDetailDocumentsTab
                liveItem={liveItem}
                state={state}
                itemDocs={itemDocs}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {opType && (
        <OperationModal
          open={!!opType}
          onClose={() => setOpType(null)}
          item={liveItem}
          type={opType}
          performedBy={state.currentUser}
          state={state}
          onSave={handleOperation}
        />
      )}
    </>
  );
}