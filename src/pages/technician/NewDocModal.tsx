import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, DocEntry, DocCustomField, Attachment, generateId } from '@/data/store';
import { DOC_TYPES } from './technicianUtils';
import DocFormFields, { DocFormValues } from './DocFormFields';

export function NewDocModal({
  state, onSave, onClose,
}: {
  state: AppState;
  onSave: (doc: DocEntry) => void;
  onClose: () => void;
}) {
  const [itemId, setItemId]         = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [docType, setDocType]       = useState(DOC_TYPES[0]);
  const [docNumber, setDocNumber]   = useState('');
  const [docDate, setDocDate]       = useState('');
  const [supplier, setSupplier]     = useState('');
  const [notes, setNotes]           = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [customFields, setCustomFields] = useState<DocCustomField[]>([]);
  const [error, setError]           = useState('');

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return state.items.slice(0, 30);
    const q = itemSearch.toLowerCase();
    return state.items.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)).slice(0, 20);
  }, [state.items, itemSearch]);

  const selectedItem = itemId ? state.items.find(i => i.id === itemId) : null;

  const handleCreate = () => {
    if (!itemId) { setError('Выберите позицию номенклатуры'); return; }
    const doc: DocEntry = {
      id: generateId(), itemId, docType, docNumber: docNumber || undefined,
      docDate: docDate || undefined, supplier: supplier || undefined,
      notes: notes || undefined, customFields, attachments,
      coverUrl: coverUrl || undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: state.currentUser,
    };
    onSave(doc); onClose();
  };

  const values: DocFormValues = {
    docType, docNumber, docDate, supplier, notes, customFields, attachments, coverUrl,
  };

  const handleFieldsChange = (patch: Partial<DocFormValues>) => {
    if (patch.docType !== undefined) setDocType(patch.docType);
    if (patch.docNumber !== undefined) setDocNumber(patch.docNumber || '');
    if (patch.docDate !== undefined) setDocDate(patch.docDate || '');
    if (patch.supplier !== undefined) setSupplier(patch.supplier || '');
    if (patch.notes !== undefined) setNotes(patch.notes || '');
    if (patch.customFields !== undefined) setCustomFields(patch.customFields);
    if (patch.attachments !== undefined) setAttachments(patch.attachments);
    if (patch.coverUrl !== undefined) setCoverUrl(patch.coverUrl);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[min(96vw,900px)] w-full max-h-[92vh] overflow-y-auto animate-scale-in p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="FilePlus" size={16} />
            </div>
            Новая запись документа
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Step 1: выбор позиции */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Позиция номенклатуры <span className="text-destructive">*</span>
            </h3>
            {selectedItem ? (
              <div className="flex items-center gap-3 p-3 bg-accent/50 border border-primary/20 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Icon name="Package" size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{selectedItem.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {state.categories.find(c => c.id === selectedItem.categoryId)?.name || '—'} · {selectedItem.quantity} {selectedItem.unit}
                  </div>
                </div>
                <button onClick={() => { setItemId(''); setItemSearch(''); }}
                  className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                  <Icon name="X" size={13} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)} autoFocus
                    placeholder="Поиск по названию..."
                    className="pl-9 h-9 text-sm" />
                </div>
                {error && <p className="text-xs text-destructive mt-1">{error}</p>}
                <div className="mt-2 border border-border rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  {filteredItems.length === 0
                    ? <p className="text-sm text-muted-foreground text-center py-6">Ничего не найдено</p>
                    : filteredItems.map(item => {
                      const cat = state.categories.find(c => c.id === item.categoryId);
                      return (
                        <button key={item.id} onClick={() => { setItemId(item.id); setError(''); }}
                          className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-muted border-b border-border/40 last:border-0 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                            {cat && <div className="text-xs" style={{ color: cat.color }}>{cat.name}</div>}
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0">{item.quantity} {item.unit}</div>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </section>

          <DocFormFields values={values} onChange={handleFieldsChange} withSectionHeadings={false} />

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleCreate} className="flex-1 font-semibold">
              <Icon name="FilePlus" size={14} className="mr-1.5" />Создать запись
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NewDocModal;