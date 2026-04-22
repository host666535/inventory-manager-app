import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, AssetType, Item, crudAction, generateId, updateLocationStock, updateWarehouseStock } from '@/data/store';
import { UNITS } from '@/constants/units';
import { findDuplicateItem } from '@/data/validation';
import { itemFormSchema, firstError } from '@/data/schemas';
import { toast } from 'sonner';

export default function NewItemModal({ state, onStateChange, onClose }: {
  state: AppState; onStateChange: (s: AppState) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('шт');
  const [assetType, setAssetType] = useState<AssetType>('МЗ');
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState((state.warehouses || [])[0]?.id || '');
  const [locationId, setLocationId] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('0');
  const [threshold, setThreshold] = useState('5');
  const [error, setError] = useState('');

  const filteredLocations = (warehouseId
    ? state.locations.filter(l => l.warehouseId === warehouseId)
    : state.locations
  ).filter(l => !state.locations.some(ch => ch.parentId === l.id));

  const [confirmDuplicate, setConfirmDuplicate] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  const doCreate = async () => {
    if (saving) return;
    setSaving(true);
    const fallbackLeaf = state.locations.find(l => !state.locations.some(ch => ch.parentId === l.id));
    const newItem: Item = {
      id: generateId(),
      name: name.trim(),
      unit,
      assetType,
      categoryId,
      locationId: locationId || (fallbackLeaf?.id || ''),
      description: description.trim() || undefined,
      quantity: parseInt(qty) || 0,
      lowStockThreshold: parseInt(threshold) || 5,
      createdAt: new Date().toISOString(),
    };
    let next = { ...state, items: [...state.items, newItem] };
    const initQty = parseInt(qty) || 0;
    const locId = newItem.locationId;
    if (initQty > 0 && locId) {
      next = updateLocationStock(next, newItem.id, locId, initQty);
    }
    const whId = warehouseId || state.locations.find(l => l.id === locId)?.warehouseId || '';
    if (initQty > 0 && whId) {
      next = updateWarehouseStock(next, newItem.id, whId, initQty);
    }
    onStateChange(next);
    const lsArr = (next.locationStocks || []).filter(ls => ls.itemId === newItem.id);
    const wsArr = (next.warehouseStocks || []).filter(ws => ws.itemId === newItem.id);
    const ok = await crudAction('upsert_item', { item: newItem, locationStocks: lsArr, warehouseStocks: wsArr });
    setSaving(false);
    if (!ok) return;
    toast.success(`Товар «${newItem.name}» создан`);
    onClose();
  };

  const handleSave = () => {
    const parsed = itemFormSchema.safeParse({
      name, unit, categoryId, quantity: qty, lowStockThreshold: threshold, description,
    });
    const errMsg = firstError(parsed);
    if (errMsg) { setError(errMsg); return; }
    const dup = findDuplicateItem(state, name, categoryId);
    if (dup) {
      setConfirmDuplicate(dup);
      return;
    }
    doCreate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="Plus" size={16} />
            </div>
            Новая номенклатура
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Название <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="Например: Болт М8×40..." autoFocus />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ед. измерения</Label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Тип (МЗ/ОС)</Label>
              <select value={assetType} onChange={e => setAssetType(e.target.value as AssetType)}
                className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="МЗ">МЗ — материальные запасы</option>
                <option value="ОС">ОС — основные средства</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Нач. количество</Label>
              <Input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Порог минимума</Label>
              <Input type="number" min="0" value={threshold} onChange={e => setThreshold(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Категория</Label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {(state.warehouses || []).length > 0 && (
            <div className="space-y-1.5">
              <Label>Склад</Label>
              <select value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setLocationId(''); }}
                className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {(state.warehouses || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Локация</Label>
            <select value={locationId} onChange={e => setLocationId(e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— Не указана —</option>
              {filteredLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Описание</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание..." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Отмена</Button>
            <Button onClick={handleSave} className="flex-1 font-semibold" disabled={saving}>
              <Icon name={saving ? 'Loader2' : 'Plus'} size={14} className={`mr-1.5 ${saving ? 'animate-spin' : ''}`} />
              {saving ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </div>
      </DialogContent>
      {confirmDuplicate && (
        <Dialog open onOpenChange={() => setConfirmDuplicate(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                  <Icon name="AlertTriangle" size={16} />
                </div>
                Товар с таким названием уже есть
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="font-medium text-foreground">{confirmDuplicate.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  В категории «{state.categories.find(c => c.id === confirmDuplicate.categoryId)?.name || '—'}» · остаток: {confirmDuplicate.quantity} {confirmDuplicate.unit}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Обычно это ошибка — лучше добавить приход к существующему товару, а не создавать дубликат.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirmDuplicate(null)} className="flex-1">
                  Изменить название
                </Button>
                <Button
                  onClick={() => { setConfirmDuplicate(null); doCreate(); }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                >
                  Всё равно создать
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
