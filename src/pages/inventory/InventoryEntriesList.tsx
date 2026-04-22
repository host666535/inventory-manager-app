import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { InventoryEntry, ScanFlash } from './types';

type Props = {
  filteredEntries: InventoryEntry[];
  showOnlyDiff: boolean;
  scanFlash: ScanFlash;
  updateActualQty: (itemId: string, value: string) => void;
};

export default function InventoryEntriesList({
  filteredEntries, showOnlyDiff, scanFlash, updateActualQty,
}: Props) {
  return (
    <div className="space-y-2">
      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Icon name="PackageSearch" size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-0.5">Ничего не найдено</p>
          <p className="text-xs text-muted-foreground">
            {showOnlyDiff ? 'Расхождений пока нет' : 'Попробуйте другой поисковый запрос'}
          </p>
        </div>
      ) : (
        filteredEntries.map(entry => {
          const diff =
            entry.actualQty !== null ? entry.actualQty - entry.systemQty : null;
          const isCounted = entry.actualQty !== null;
          const isMatch = isCounted && diff === 0;
          const isSurplus = isCounted && diff !== null && diff > 0;
          const isShortage = isCounted && diff !== null && diff < 0;

          let rowBg = 'bg-card';
          if (isShortage) rowBg = 'bg-destructive/5';
          if (isSurplus) rowBg = 'bg-success/5';
          const isFlash = scanFlash?.itemId === entry.itemId;

          return (
            <div
              key={entry.itemId}
              className={`${rowBg} rounded-xl border ${isFlash ? 'border-primary ring-2 ring-primary/40' : 'border-border'} shadow-card p-4 transition-all`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground break-words min-w-0">
                      {entry.itemName}
                    </span>
                    <span
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: entry.categoryColor }}
                    >
                      {entry.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {entry.locationName && (
                      <span className="flex items-center gap-1">
                        <Icon name="MapPin" size={11} />
                        {entry.locationName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Icon name="Package" size={11} />
                      Системный: {entry.systemQty} {entry.unit}
                    </span>
                  </div>
                </div>

                {/* Input + diff */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap sr-only sm:not-sr-only">
                      Факт:
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={entry.actualQty !== null ? entry.actualQty : ''}
                      onChange={e => updateActualQty(entry.itemId, e.target.value)}
                      className="w-24 h-9 text-center tabular-nums text-sm font-medium"
                    />
                    <span className="text-xs text-muted-foreground w-8">{entry.unit}</span>
                  </div>

                  {/* Difference indicator */}
                  <div className="w-16 text-center">
                    {!isCounted && (
                      <span className="text-xs text-muted-foreground/50">--</span>
                    )}
                    {isMatch && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                        <Icon name="Check" size={13} />
                        OK
                      </span>
                    )}
                    {isSurplus && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-success tabular-nums">
                        +{diff}
                      </span>
                    )}
                    {isShortage && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-destructive tabular-nums">
                        {diff}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
