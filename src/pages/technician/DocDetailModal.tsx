import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState, DocEntry } from '@/data/store';
import { formatDate } from './technicianUtils';
import DocFormFields, { DocFormValues } from './DocFormFields';

export function DocDetailModal({
  doc, state, onSave, onDelete, onClose,
}: {
  doc: DocEntry;
  state: AppState;
  onSave: (updated: DocEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const item = state.items.find(i => i.id === doc.itemId);
  const cat  = item ? state.categories.find(c => c.id === item.categoryId) : null;

  const [edited, setEdited] = useState<DocEntry>({ ...doc, customFields: [...doc.customFields], attachments: [...doc.attachments] });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<DocEntry>) => setEdited(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    onSave({ ...edited, updatedAt: new Date().toISOString() });
    onClose();
  };

  const values: DocFormValues = {
    docType: edited.docType,
    docNumber: edited.docNumber,
    docDate: edited.docDate,
    supplier: edited.supplier,
    notes: edited.notes,
    customFields: edited.customFields,
    attachments: edited.attachments,
    coverUrl: edited.coverUrl,
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl xl:max-w-4xl w-full max-h-[94vh] overflow-y-auto animate-scale-in p-0">
        {/* Top bar with item info */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Номенклатура */}
              <div className="flex items-center gap-2 mb-1">
                {cat && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color + '18', color: cat.color }}>
                    {cat.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{item?.unit}</span>
              </div>
              <h2 className="font-bold text-lg text-foreground leading-tight">{item?.name || '—'}</h2>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Icon name="FileText" size={11} />{edited.docType}</span>
                {edited.docNumber && <span>№ {edited.docNumber}</span>}
                {edited.docDate && <span>{formatDate(edited.docDate)}</span>}
                <span className="flex items-center gap-1"><Icon name="Paperclip" size={11} />{edited.attachments.length} файл.</span>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <Icon name="X" size={15} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <DocFormFields values={values} onChange={set} withSectionHeadings={true} />

          {/* ─── Footer ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">Удалить запись?</span>
                <Button variant="destructive" size="sm" onClick={() => { onDelete(doc.id); onClose(); }}>
                  Да, удалить
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Отмена</Button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
                <Icon name="Trash2" size={13} />Удалить запись
              </button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Отмена</Button>
              <Button onClick={handleSave} className="font-semibold">
                <Icon name="Save" size={14} className="mr-1.5" />Сохранить
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DocDetailModal;
