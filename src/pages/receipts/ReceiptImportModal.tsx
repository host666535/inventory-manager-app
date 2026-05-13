import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { AppState, crudAction, setCrudErrorHandler } from '@/data/store';
import {
  parseReceiptsExcel, buildReceiptsFromRows, downloadReceiptTemplate,
  ImportResult, FIXED_HEADERS,
} from '@/utils/excelReceipts';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
};

export function ReceiptImportModal({ state, onStateChange, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const warehouses = state.warehouses || [];
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [parsed, setParsed] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const result = await parseReceiptsExcel(file);
      setParsed(result);
      if (result.rows.length === 0) toast.warning('Файл пустой');
    } catch (err) {
      console.error(err);
      toast.error('Не удалось прочитать файл. Убедитесь, что это Excel-файл.');
      setParsed(null);
    }
  };

  const handleImport = async () => {
    if (!parsed || importing) return;
    if (!warehouseId) {
      toast.error('Выберите склад');
      return;
    }
    if (parsed.validCount === 0) {
      toast.error('Нет корректных строк для импорта');
      return;
    }

    setImporting(true);
    const { nextState, receipts, newItems, newPartners, operations } = buildReceiptsFromRows(
      state, parsed.rows, warehouseId, state.currentUser,
    );

    onStateChange(nextState);

    // Отключаем глобальный «откат» состояния на время импорта,
    // чтобы оптимистично добавленные приходы не пропадали при ошибках отдельных запросов.
    setCrudErrorHandler(null);
    let failed = 0;

    const run = async (p: Promise<boolean>) => {
      const ok = await p;
      if (!ok) failed += 1;
    };

    for (const it of newItems) await run(crudAction('upsert_item', { item: it }));
    for (const p of newPartners) await run(crudAction('upsert_partner', { partner: p }));
    for (const r of receipts) {
      await run(crudAction('upsert_receipt', { receipt: r, receiptLines: r.lines }));
    }
    for (const op of operations) {
      const item = nextState.items.find(i => i.id === op.itemId);
      const locationStocks = (nextState.locationStocks || []).filter(ls => ls.itemId === op.itemId);
      const warehouseStocks = (nextState.warehouseStocks || []).filter(ws => ws.itemId === op.itemId);
      await run(crudAction('upsert_operation', { operation: op, item, locationStocks, warehouseStocks }));
    }
    await run(crudAction('update_setting', { key: 'receiptCounter', value: String(nextState.receiptCounter) }));

    setImporting(false);

    if (failed > 0) {
      toast.error(`Импорт завершён с ошибками: ${failed} операций отклонено сервером. Обновите страницу для синхронизации.`);
    } else {
      toast.success(`Импортировано приходов: ${receipts.length} · позиций оприходовано: ${parsed.validCount}`);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[min(96vw,900px)] animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Upload" size={16} className="text-primary" />
            Импорт приходов из Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Склад назначения <span className="text-destructive">*</span></Label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {warehouses.length === 0 && <option value="">— Нет складов —</option>}
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Все строки из файла будут оприходованы на этот склад.
            </p>
          </div>

          <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1.5">
            <div className="font-semibold">Ожидаемые колонки (в этом порядке):</div>
            <div className="flex flex-wrap gap-1">
              {FIXED_HEADERS.map(h => (
                <span key={h} className="px-2 py-0.5 rounded bg-card border border-border text-[11px] font-medium">{h}</span>
              ))}
            </div>
            <div className="text-muted-foreground">
              Любые дополнительные колонки правее сохранятся как свойства документа.
            </div>
            <button
              onClick={downloadReceiptTemplate}
              className="text-primary hover:underline text-[11px] font-semibold flex items-center gap-1 mt-1"
            >
              <Icon name="Download" size={11} />Скачать шаблон
            </button>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-center"
            >
              <Icon name="FileSpreadsheet" size={28} className="mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-semibold">
                {fileName || 'Выбрать файл .xlsx'}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {parsed ? 'Можно выбрать другой файл' : 'Нажмите, чтобы загрузить'}
              </div>
            </button>
          </div>

          {parsed && (
            <div className="p-3 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Найдено строк:</span>
                <span className="tabular-nums">{parsed.rows.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-success font-semibold flex items-center gap-1">
                  <Icon name="CheckCircle2" size={13} />Корректных
                </span>
                <span className="tabular-nums text-success font-bold">{parsed.validCount}</span>
              </div>
              {parsed.errorCount > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-destructive font-semibold flex items-center gap-1">
                      <Icon name="AlertCircle" size={13} />С ошибками
                    </span>
                    <span className="tabular-nums text-destructive font-bold">{parsed.errorCount}</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto text-[11px] space-y-1 mt-2 pt-2 border-t border-border">
                    {parsed.rows.filter(r => r.errors.length > 0).slice(0, 10).map(r => (
                      <div key={r.rowNumber} className="text-destructive">
                        Строка {r.rowNumber}: {r.errors.join('; ')}
                      </div>
                    ))}
                    {parsed.errorCount > 10 && (
                      <div className="text-muted-foreground">…и ещё {parsed.errorCount - 10}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={importing}>
              Отмена
            </Button>
            <Button
              onClick={handleImport}
              disabled={!parsed || parsed.validCount === 0 || !warehouseId || importing}
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold"
            >
              <Icon name={importing ? 'Loader2' : 'Upload'} size={14} className={`mr-1.5 ${importing ? 'animate-spin' : ''}`} />
              {importing ? 'Загрузка...' : `Импортировать (${parsed?.validCount || 0})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReceiptImportModal;