import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Attachment, DocCustomField } from '@/data/store';
import CoverPhotoPicker from './CoverPhotoPicker';
import { AttachmentZone } from './AttachmentZone';
import { DOC_TYPES } from './technicianUtils';

export type DocFormValues = {
  docType: string;
  docNumber?: string;
  docDate?: string;
  supplier?: string;
  notes?: string;
  customFields: DocCustomField[];
  attachments: Attachment[];
  coverUrl?: string;
};

type Props = {
  values: DocFormValues;
  onChange: (patch: Partial<DocFormValues>) => void;
  /** Если true — секции с заголовками (используется в DocDetailModal).
   *  Если false — плоский режим без заголовков (используется в NewDocModal). */
  withSectionHeadings?: boolean;
};

export default function DocFormFields({ values, onChange, withSectionHeadings = true }: Props) {
  const [cfKey, setCfKey] = useState('');
  const [cfVal, setCfVal] = useState('');

  const addCf = () => {
    if (!cfKey.trim()) return;
    onChange({ customFields: [...values.customFields, { key: cfKey.trim(), value: cfVal.trim() }] });
    setCfKey(''); setCfVal('');
  };

  const removeCf = (idx: number) =>
    onChange({ customFields: values.customFields.filter((_, i) => i !== idx) });

  const updateCf = (idx: number, patch: Partial<DocCustomField>) =>
    onChange({ customFields: values.customFields.map((cf, i) => i === idx ? { ...cf, ...patch } : cf) });

  return (
    <>
      {/* ─── Реквизиты документа ───────────────────────────── */}
      <section>
        {withSectionHeadings && (
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Реквизиты документа</h3>
        )}
        {!withSectionHeadings && (
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Реквизиты</h3>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Тип документа</Label>
            <select value={values.docType} onChange={e => onChange({ docType: e.target.value })}
              className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Номер документа</Label>
            <Input
              value={values.docNumber || ''}
              onChange={e => onChange({ docNumber: e.target.value })}
              placeholder={withSectionHeadings ? 'АКТ-0042 / ТН-001...' : '№ накладной / акта...'}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{withSectionHeadings ? 'Дата документа' : 'Дата'}</Label>
            <Input type="date" value={values.docDate || ''} onChange={e => onChange({ docDate: e.target.value })}
              className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Поставщик / Источник</Label>
            <Input
              value={values.supplier || ''}
              onChange={e => onChange({ supplier: e.target.value })}
              placeholder={withSectionHeadings ? 'ООО Поставщик...' : 'Компания...'}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label className="text-xs">Примечание</Label>
          <textarea
            value={values.notes || ''}
            onChange={e => onChange({ notes: e.target.value })}
            rows={2}
            placeholder={withSectionHeadings ? 'Комментарий, пометки...' : 'Дополнительная информация...'}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
          />
        </div>
      </section>

      {/* ─── Кастомные поля ─────────────────────────────────── */}
      {withSectionHeadings ? (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Дополнительные поля</h3>
          {values.customFields.length > 0 && (
            <div className="space-y-2 mb-3">
              {values.customFields.map((cf, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input value={cf.key} onChange={e => updateCf(idx, { key: e.target.value })}
                    placeholder="Поле" className="h-8 text-sm w-36 shrink-0" />
                  <Input value={cf.value} onChange={e => updateCf(idx, { value: e.target.value })}
                    placeholder="Значение" className="h-8 text-sm flex-1" />
                  <button onClick={() => removeCf(idx)}
                    className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0">
                    <Icon name="X" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input value={cfKey} onChange={e => setCfKey(e.target.value)} placeholder="Название поля"
              className="h-8 text-sm w-36 shrink-0" onKeyDown={e => e.key === 'Enter' && addCf()} />
            <Input value={cfVal} onChange={e => setCfVal(e.target.value)} placeholder="Значение"
              className="h-8 text-sm flex-1" onKeyDown={e => e.key === 'Enter' && addCf()} />
            <button onClick={addCf}
              className="w-8 h-8 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center text-muted-foreground hover:text-primary transition-all shrink-0">
              <Icon name="Plus" size={14} />
            </button>
          </div>
        </section>
      ) : (
        <>
          {values.customFields.length > 0 && (
            <div className="space-y-2">
              {values.customFields.map((cf, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground w-28 shrink-0 truncate">{cf.key}:</span>
                  <span className="flex-1">{cf.value}</span>
                  <button onClick={() => removeCf(idx)}
                    className="text-muted-foreground hover:text-destructive"><Icon name="X" size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input value={cfKey} onChange={e => setCfKey(e.target.value)} placeholder="+ доп. поле"
              className="h-8 text-xs w-32 shrink-0" onKeyDown={e => e.key === 'Enter' && addCf()} />
            <Input value={cfVal} onChange={e => setCfVal(e.target.value)} placeholder="значение"
              className="h-8 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && addCf()} />
            <button onClick={addCf}
              className="w-8 h-8 rounded-lg border border-dashed border-border hover:border-primary flex items-center justify-center text-muted-foreground hover:text-primary">
              <Icon name="Plus" size={13} />
            </button>
          </div>
        </>
      )}

      {/* ─── Главное фото карточки ─────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Главное фото карточки
        </h3>
        <CoverPhotoPicker
          coverUrl={values.coverUrl}
          attachments={values.attachments}
          onChange={(url, newAtt) => onChange({
            coverUrl: url,
            attachments: newAtt ? [...values.attachments, newAtt] : values.attachments,
          })}
        />
      </section>

      {/* ─── Вложения ─────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Вложения
          {withSectionHeadings && values.attachments.length > 0 && (
            <span className="ml-2 text-primary font-bold normal-case">{values.attachments.length}</span>
          )}
        </h3>
        <AttachmentZone
          attachments={values.attachments}
          onChange={atts => onChange({ attachments: atts })}
        />
      </section>
    </>
  );
}
