import { useState, useMemo, useEffect, useRef } from 'react';
import { AutocompleteOption } from '@/components/Autocomplete';
import {
  AppState, crudAction, generateId,
  WorkOrder, OrderItem, OrderStatus, Partner,
  getReservedQty, getFreeQty,
} from '@/data/store';
import { ConflictInfo } from '../ConflictModal';

export type OrderLine = { id: string; itemId: string; itemLabel: string; qty: string };

const DRAFT_KEY = 'inventory.draftCreateOrder.v1';

type Draft = {
  number: string;
  selectedWarehouseId: string;
  recipientLabel: string;
  recipientId: string;
  receiverRank: string;
  receiverName: string;
  comment: string;
  lines: OrderLine[];
};

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Draft;
    if (!obj || !Array.isArray(obj.lines)) return null;
    return obj;
  } catch {
    return null;
  }
}

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

  // ─── Черновик заявки (только для НОВОЙ, не для редактирования) ─────────────
  // При маунте — если есть незавершённый черновик, спрашиваем восстановить.
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (isEdit) return;            // в режиме редактирования черновик не применяем
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    const draft = loadDraft();
    if (!draft) return;
    const hasContent = draft.recipientLabel || draft.receiverName ||
      draft.comment || (draft.lines && draft.lines.some(l => l.itemId));
    if (!hasContent) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    if (typeof window !== 'undefined' && window.confirm('Найден незавершённый черновик заявки. Продолжить заполнение?')) {
      if (draft.number) setNumber(draft.number);
      if (draft.selectedWarehouseId) setSelectedWarehouseId(draft.selectedWarehouseId);
      if (draft.recipientLabel) setRecipientLabel(draft.recipientLabel);
      if (draft.recipientId) setRecipientId(draft.recipientId);
      if (draft.receiverRank) setReceiverRank(draft.receiverRank);
      if (draft.receiverName) setReceiverName(draft.receiverName);
      if (draft.comment) setComment(draft.comment);
      if (Array.isArray(draft.lines) && draft.lines.length > 0) setLines(draft.lines);
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Сохранение черновика с debounce 300мс.
  useEffect(() => {
    if (isEdit) return;
    const t = setTimeout(() => {
      const draft: Draft = {
        number, selectedWarehouseId, recipientLabel, recipientId,
        receiverRank, receiverName, comment, lines,
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch { /* localStorage может быть переполнен — игнорируем */ }
    }, 300);
    return () => clearTimeout(t);
  }, [isEdit, number, selectedWarehouseId, recipientLabel, recipientId, receiverRank, receiverName, comment, lines]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
  };

  const resetForm = () => {
    setNumber(`ЗС-${String(state.orderCounter).padStart(3, '0')}`);
    setComment('');
    setRecipientLabel('');
    setRecipientId('');
    setReceiverRank('');
    setReceiverName('');
    setRequesterRank('');
    setRequesterName('');
    setSelectedWarehouseId(state.warehouses?.length === 1 ? state.warehouses[0].id : '');
    setLines([{ id: generateId(), itemId: '', itemLabel: '', qty: '1' }]);
    clearDraft();
  };

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
  const updateLine = (id: string, patch: Partial<OrderLine>) => {
    setLines(prev => {
      const next = prev.map(ln => ln.id === id ? { ...ln, ...patch } : ln);

      // ─── Авто-подтягивание зависимостей (комплекты) ──────────────────────
      // Когда в строку только что выбрали itemId — добавляем зависимые позиции.
      // НЕ пересчитываем при изменении только qty: пользователь правит сам.
      const justSelectedItemId = patch.itemId && patch.itemId !== prev.find(ln => ln.id === id)?.itemId
        ? patch.itemId
        : null;
      if (!justSelectedItemId) return next;

      const item = state.items.find(i => i.id === justSelectedItemId);
      const deps = item?.dependencies;
      if (!deps || deps.length === 0) return next;

      const baseQty = parseInt(patch.qty || next.find(ln => ln.id === id)?.qty || '1') || 1;
      const existingItemIds = new Set(next.filter(ln => ln.itemId).map(ln => ln.itemId));
      const toAdd: OrderLine[] = [];
      for (const dep of deps) {
        if (!dep.itemId || dep.itemId === justSelectedItemId) continue;
        if (existingItemIds.has(dep.itemId)) continue;
        const depItem = state.items.find(i => i.id === dep.itemId);
        if (!depItem) continue;
        const depQty = Math.max(1, Math.ceil(baseQty * (dep.ratio || 1)));
        toAdd.push({
          id: generateId(),
          itemId: dep.itemId,
          itemLabel: depItem.name,
          qty: String(depQty),
        });
        existingItemIds.add(dep.itemId);
      }
      return toAdd.length > 0 ? [...next, ...toAdd] : next;
    });
  };

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
    // Парсим иерархию из recipientLabel: "Объединение / Соединение"
    const hierParts = trimmedDept.split(' / ').map(s => s.trim()).filter(Boolean);
    const orderUnitGroup = hierParts[0] || undefined;
    const orderUnitFormation = hierParts[1] || undefined;
    if (trimmedDept && !recipientId) {
      // Создаём нового получателя
      const newPartner: Partner = {
        id: generateId(),
        name: trimmedDept,
        type: 'recipient',
        department: trimmedDept || undefined,
        unitGroup: orderUnitGroup,
        unitFormation: orderUnitFormation,
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
          (orderUnitGroup && existing.unitGroup !== orderUnitGroup) ||
          (orderUnitFormation && existing.unitFormation !== orderUnitFormation) ||
          (trimmedRank && existing.rank !== trimmedRank) ||
          (trimmedFullName && existing.fullName !== trimmedFullName);
        if (needsUpdate) {
          const updated: Partner = {
            ...existing,
            name: trimmedDept || existing.name,
            department: trimmedDept || existing.department,
            unitGroup: orderUnitGroup || existing.unitGroup,
            unitFormation: orderUnitFormation || existing.unitFormation,
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
        unitGroup: orderUnitGroup,
        unitFormation: orderUnitFormation,
        receiverRank: receiverRank.trim() || undefined,
        receiverName: receiverName.trim() || undefined,
        issuerRank: undefined,
        issuerName: undefined,
        // «Затребовал» = «Получил»: дублируем поля чтобы не сломать
        // схемы выгрузки/импорта, использующие requester*.
        requesterRank: receiverRank.trim() || undefined,
        requesterName: receiverName.trim() || undefined,
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
      clearDraft();
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
      unitGroup: orderUnitGroup,
      unitFormation: orderUnitFormation,
      receiverRank: receiverRank.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      // «Затребовал» = «Получил»: дублируем поля чтобы старые
      // схемы выгрузки (которые ожидают requester*) не ломались.
      requesterRank: receiverRank.trim() || undefined,
      requesterName: receiverName.trim() || undefined,
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
    clearDraft();
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
    resetForm,
    clearDraft,
  };
}