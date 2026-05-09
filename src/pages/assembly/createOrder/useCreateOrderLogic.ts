import { useState, useMemo } from 'react';
import { AutocompleteOption } from '@/components/Autocomplete';
import {
  AppState, crudAction, generateId,
  WorkOrder, OrderItem, OrderStatus, Partner,
  getReservedQty, getFreeQty,
} from '@/data/store';
import { ConflictInfo } from '../ConflictModal';

export type OrderLine = { id: string; itemId: string; itemLabel: string; qty: string };

export function useCreateOrderLogic({
  state, onStateChange, onClose, editOrder,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  editOrder?: WorkOrder;
}) {
  const isEdit = !!editOrder;
  const [number, setNumber] = useState(editOrder?.number || `ЗС-${String(state.orderCounter).padStart(3, '0')}`);
  const [comment, setComment] = useState(editOrder?.comment || '');
  const [recipientLabel, setRecipientLabel] = useState(editOrder?.recipientName || '');
  const [recipientId, setRecipientId] = useState(editOrder?.recipientId || '');
  const [receiverRank, setReceiverRank] = useState(editOrder?.receiverRank || '');
  const [receiverName, setReceiverName] = useState(editOrder?.receiverName || '');
  const [requesterRank, setRequesterRank] = useState(editOrder?.requesterRank || '');
  const [requesterName, setRequesterName] = useState(editOrder?.requesterName || '');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    editOrder?.warehouseId || (state.warehouses?.length === 1 ? state.warehouses[0].id : '')
  );
  const [lines, setLines] = useState<OrderLine[]>(
    editOrder && editOrder.items.length > 0
      ? editOrder.items.map(oi => {
          const it = state.items.find(i => i.id === oi.itemId);
          return { id: oi.id, itemId: oi.itemId, itemLabel: it?.name || '', qty: String(oi.requiredQty) };
        })
      : [{ id: generateId(), itemId: '', itemLabel: '', qty: '1' }]
  );
  const [showConflict, setShowConflict] = useState(false);

  const recipientOptions: AutocompleteOption[] = useMemo(() =>
    state.partners.filter(p => p.type === 'recipient').map(p => ({
      id: p.id,
      label: p.name,
      sublabel: [p.rank, p.fullName].filter(Boolean).join(' · ') || p.contact || p.note || undefined,
    })), [state.partners]);

  const itemOptions: AutocompleteOption[] = useMemo(() => {
    // Показываем ВСЕ товары, но складской остаток считаем по выбранному складу (если он есть).
    // Так товары с нулём тоже видны — на случай, если склад "сбился" и нужно выбрать позицию.
    return state.items.map(item => {
      const cat = state.categories.find(c => c.id === item.categoryId);
      const whStock = selectedWarehouseId
        ? (state.warehouseStocks || []).find(ws => ws.warehouseId === selectedWarehouseId && ws.itemId === item.id)?.quantity ?? 0
        : getFreeQty(state, item.id);
      return {
        id: item.id,
        label: item.name,
        sublabel: cat?.name,
        badge: `${whStock} ${item.unit}`,
        badgeColor: whStock === 0 ? '#ef4444' : whStock <= item.lowStockThreshold ? '#f59e0b' : '#10b981',
      };
    });
  }, [state, selectedWarehouseId]);

  const addLine = () => setLines(l => [...l, { id: generateId(), itemId: '', itemLabel: '', qty: '1' }]);
  const removeLine = (id: string) => setLines(l => l.filter(ln => ln.id !== id));
  const updateLine = (id: string, patch: Partial<OrderLine>) =>
    setLines(l => l.map(ln => ln.id === id ? { ...ln, ...patch } : ln));

  const validLines = lines.filter(l => l.itemId && parseInt(l.qty) > 0);

  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const ln of validLines) {
      if (seen.has(ln.itemId)) dups.add(ln.itemId);
      seen.add(ln.itemId);
    }
    return dups;
  }, [validLines]);

  const lineWarnings = useMemo(() =>
    lines.map(ln => {
      if (!ln.itemId) return null;
      const item = state.items.find(i => i.id === ln.itemId);
      if (!item) return null;
      const qty = parseInt(ln.qty) || 0;
      // Если выбран склад — считаем по остатку на нём, иначе по всему товару.
      const stockQty = selectedWarehouseId
        ? (state.warehouseStocks || []).find(ws => ws.warehouseId === selectedWarehouseId && ws.itemId === item.id)?.quantity ?? 0
        : item.quantity;
      // При редактировании текущая заявка не должна резервировать сама у себя.
      const freeQty = getFreeQty(state, ln.itemId, editOrder?.id);
      if (stockQty === 0) return { type: 'error' as const, msg: selectedWarehouseId ? 'Нет на этом складе' : 'Нет в наличии' };
      if (qty > stockQty) return { type: 'error' as const, msg: `${selectedWarehouseId ? 'На этом складе' : 'На складе'} только ${stockQty} ${item.unit}` };
      if (qty > freeQty) return { type: 'warn' as const, msg: `Свободно ${freeQty} ${item.unit} (остальное зарезервировано)` };
      if (item.quantity <= item.lowStockThreshold) return { type: 'info' as const, msg: `Низкий остаток (${item.quantity} ${item.unit})` };
      return null;
    }), [lines, state, selectedWarehouseId, editOrder?.id]);

  const conflicts = useMemo((): ConflictInfo[] => {
    const result: ConflictInfo[] = [];
    const seenItems = new Set<string>();
    for (const ln of validLines) {
      if (!ln.itemId || seenItems.has(ln.itemId)) continue;
      seenItems.add(ln.itemId);
      const item = state.items.find(i => i.id === ln.itemId);
      if (!item) continue;
      const qty = parseInt(ln.qty) || 0;
      const reserved = getReservedQty(state, ln.itemId, editOrder?.id);
      const stockQty = selectedWarehouseId
        ? (state.warehouseStocks || []).find(ws => ws.warehouseId === selectedWarehouseId && ws.itemId === item.id)?.quantity ?? 0
        : item.quantity;
      if (qty + reserved > stockQty) {
        const conflictingOrders = state.workOrders
          .filter(o => ['active', 'draft', 'pending_stock'].includes(o.status) && o.id !== editOrder?.id)
          .flatMap(o => o.items.filter(oi => oi.itemId === ln.itemId && oi.status !== 'done').map(oi => ({
            number: o.number, title: o.title, qty: oi.requiredQty - oi.pickedQty,
          })));
        result.push({
          itemId: ln.itemId,
          itemName: item.name,
          unit: item.unit,
          available: stockQty,
          requested: qty,
          conflictingOrders,
        });
      }
    }
    return result;
  }, [validLines, state, selectedWarehouseId, editOrder?.id]);

  const canCreate = validLines.length > 0 && duplicates.size === 0;

  const doCreate = (status: OrderStatus = 'draft') => {
    const orderItems: OrderItem[] = validLines
      .filter(ln => !duplicates.has(ln.itemId))
      .map(ln => {
        const existing = isEdit ? editOrder!.items.find(oi => oi.id === ln.id) : null;
        return {
          id: existing?.id || generateId(),
          itemId: ln.itemId,
          requiredQty: parseInt(ln.qty),
          pickedQty: existing?.pickedQty || 0,
          status: existing?.status || 'pending',
        };
      });

    let finalRecipientId = recipientId;
    let newPartners = [...state.partners];
    let partnerToSync: Partner | null = null;
    const trimmedDept = recipientLabel.trim();
    const trimmedRank = receiverRank.trim();
    const trimmedFullName = receiverName.trim();
    if (trimmedDept && !recipientId) {
      // Создаём нового получателя
      const newPartner: Partner = {
        id: generateId(),
        name: trimmedDept,
        type: 'recipient',
        department: trimmedDept || undefined,
        rank: trimmedRank || undefined,
        fullName: trimmedFullName || undefined,
        createdAt: new Date().toISOString(),
      };
      newPartners = [...state.partners, newPartner];
      finalRecipientId = newPartner.id;
      partnerToSync = newPartner;
    } else if (recipientId) {
      // Обновляем существующего получателя если поля изменились
      const existing = state.partners.find(p => p.id === recipientId);
      if (existing) {
        const needsUpdate =
          (trimmedDept && existing.department !== trimmedDept) ||
          (trimmedRank && existing.rank !== trimmedRank) ||
          (trimmedFullName && existing.fullName !== trimmedFullName);
        if (needsUpdate) {
          const updated: Partner = {
            ...existing,
            name: trimmedDept || existing.name,
            department: trimmedDept || existing.department,
            rank: trimmedRank || existing.rank,
            fullName: trimmedFullName || existing.fullName,
          };
          newPartners = state.partners.map(p => p.id === recipientId ? updated : p);
          partnerToSync = updated;
        }
      }
    }

    if (isEdit && editOrder) {
      const updated: WorkOrder = {
        ...editOrder,
        number: number.trim() || editOrder.number,
        title: editOrder.title || '',
        status,
        warehouseId: selectedWarehouseId || undefined,
        recipientId: finalRecipientId || undefined,
        recipientName: recipientLabel.trim() || undefined,
        receiverRank: receiverRank.trim() || undefined,
        receiverName: receiverName.trim() || undefined,
        issuerRank: undefined,
        issuerName: undefined,
        requesterRank: requesterRank.trim() || undefined,
        requesterName: requesterName.trim() || undefined,
        comment: comment.trim() || undefined,
        updatedAt: new Date().toISOString(),
        items: orderItems,
      };
      const next = {
        ...state,
        partners: newPartners,
        workOrders: state.workOrders.map(o => o.id === updated.id ? updated : o),
      };
      onStateChange(next);
      crudAction('upsert_work_order', { workOrder: updated, orderItems: updated.items });
      if (partnerToSync) {
        crudAction('upsert_partner', { partner: partnerToSync });
      }
      onClose();
      return;
    }

    const order: WorkOrder = {
      id: generateId(),
      number: number.trim() || `ЗС-${String(state.orderCounter).padStart(3, '0')}`,
      title: '',
      status,
      createdBy: state.currentUser,
      warehouseId: selectedWarehouseId || undefined,
      recipientId: finalRecipientId || undefined,
      recipientName: recipientLabel.trim() || undefined,
      receiverRank: receiverRank.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      requesterRank: requesterRank.trim() || undefined,
      requesterName: requesterName.trim() || undefined,
      comment: comment.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: orderItems,
    };
    const newCounter = state.orderCounter + 1;
    const next = {
      ...state,
      partners: newPartners,
      workOrders: [order, ...state.workOrders],
      orderCounter: newCounter,
    };
    onStateChange(next);
    crudAction('upsert_work_order', { workOrder: order, orderItems: order.items });
    crudAction('update_setting', { key: 'orderCounter', value: String(newCounter) });
    if (partnerToSync) {
      crudAction('upsert_partner', { partner: partnerToSync });
    }
    onClose();
  };

  const handleSubmit = () => {
    if (!canCreate) return;
    if (conflicts.length > 0) { setShowConflict(true); return; }
    doCreate(isEdit ? editOrder!.status : 'draft');
  };

  return {
    isEdit,
    number, setNumber,
    comment, setComment,
    recipientLabel, setRecipientLabel,
    recipientId, setRecipientId,
    receiverRank, setReceiverRank,
    receiverName, setReceiverName,
    requesterRank, setRequesterRank,
    requesterName, setRequesterName,
    selectedWarehouseId, setSelectedWarehouseId,
    lines,
    showConflict, setShowConflict,
    recipientOptions,
    itemOptions,
    addLine,
    removeLine,
    updateLine,
    validLines,
    duplicates,
    lineWarnings,
    conflicts,
    canCreate,
    doCreate,
    handleSubmit,
  };
}