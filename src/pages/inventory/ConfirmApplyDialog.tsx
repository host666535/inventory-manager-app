import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { InventorySummary } from './types';

// ─── Summary Mini Card ───────────────────────────────────────────────────────

function SummaryMini({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <Icon name={icon} size={15} className={`mx-auto mb-1 ${color ?? 'text-muted-foreground'}`} />
      <div className={`text-lg font-bold tabular-nums ${color ?? 'text-foreground'}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  summary: InventorySummary;
  applyCorrections: () => void;
};

export default function ConfirmApplyDialog({ open, onOpenChange, summary, applyCorrections }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,900px)] animate-scale-in max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="ClipboardCheck" size={16} />
            </div>
            Результаты инвентаризации
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryMini label="Всего" value={summary.total} icon="Package" />
            <SummaryMini label="Проверено" value={summary.counted} icon="CheckSquare" />
            <SummaryMini
              label="Излишки"
              value={summary.surpluses}
              icon="TrendingUp"
              color="text-success"
            />
            <SummaryMini
              label="Недостачи"
              value={summary.shortages}
              icon="TrendingDown"
              color="text-destructive"
            />
          </div>

          {/* Совпадения */}
          {summary.counted > 0 && summary.discrepancies.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success text-sm font-medium">
              <Icon name="CheckCircle" size={16} />
              Все проверенные позиции совпадают с системными данными.
            </div>
          )}

          {/* Discrepancies table */}
          {summary.discrepancies.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Расхождения ({summary.discrepancies.length})
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                        Товар
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                        Система
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                        Факт
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                        Разница
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.discrepancies.map(entry => {
                      const diff = entry.actualQty! - entry.systemQty;
                      return (
                        <tr
                          key={entry.itemId}
                          className="border-t border-border hover:bg-muted/30"
                        >
                          <td className="px-3 py-2 font-medium text-foreground break-words align-top max-w-[180px] md:max-w-[280px] lg:max-w-none">
                            {entry.itemName}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {entry.systemQty}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                            {entry.actualQty}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-bold ${
                              diff > 0 ? 'text-success' : 'text-destructive'
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Назад
            </Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={applyCorrections}
              disabled={summary.discrepancies.length === 0}
            >
              <Icon name="Check" size={15} />
              Применить корректировку
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}