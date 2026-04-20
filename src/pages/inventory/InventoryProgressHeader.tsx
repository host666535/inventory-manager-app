import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { InventoryProgress, InventorySummary } from './types';

type Props = {
  warehouseName: string;
  progress: InventoryProgress;
  summary: InventorySummary;
  scanCount: number;
  scanLocationFilter: string | null;
  scanLocationName: string | null;
  search: string;
  showOnlyDiff: boolean;
  setSearch: (v: string) => void;
  setShowOnlyDiff: (v: boolean) => void;
  setShowScanner: (v: boolean) => void;
  setScanLocationFilter: (v: string | null) => void;
  setConfirmApply: (v: boolean) => void;
  resetInventory: () => void;
};

export default function InventoryProgressHeader({
  warehouseName,
  progress,
  summary,
  scanCount,
  scanLocationFilter,
  scanLocationName,
  search,
  showOnlyDiff,
  setSearch,
  setShowOnlyDiff,
  setShowScanner,
  setScanLocationFilter,
  setConfirmApply,
  resetInventory,
}: Props) {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Инвентаризация</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {warehouseName} &middot; Проверено {progress.counted} из {progress.total}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowScanner(true)}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Icon name="ScanLine" size={14} />
            Сканировать
            {scanCount > 0 && (
              <span className="ml-0.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full tabular-nums">
                {scanCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetInventory}
            className="gap-1.5"
          >
            <Icon name="RotateCcw" size={14} />
            Сбросить
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => setConfirmApply(true)}
            disabled={summary.discrepancies.length === 0 && summary.counted === 0}
            className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
          >
            <Icon name="CheckCircle" size={14} />
            Завершить
          </Button>
        </div>
      </div>

      {scanLocationFilter && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-xl text-sm">
          <Icon name="MapPin" size={14} className="text-primary" />
          <span className="font-medium text-foreground">Фильтр по локации:</span>
          <span className="text-primary font-semibold">{scanLocationName ?? '—'}</span>
          <button
            onClick={() => setScanLocationFilter(null)}
            className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Icon name="X" size={12} />Сбросить
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-card rounded-xl border border-border shadow-card p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Прогресс</span>
          <span className="font-semibold text-foreground tabular-nums">
            {progress.counted}/{progress.total}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{
              width: progress.total > 0 ? `${(progress.counted / progress.total) * 100}%` : '0%',
            }}
          />
        </div>
        {/* Mini stats */}
        <div className="flex gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
            Не проверено: {progress.total - progress.counted}
          </span>
          <span className="flex items-center gap-1 text-success">
            <span className="w-2 h-2 rounded-full bg-success" />
            Совпадает: {summary.matches}
          </span>
          <span className="flex items-center gap-1 text-primary">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Излишек: {summary.surpluses}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            Недостача: {summary.shortages}
          </span>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Icon
            name="Search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            placeholder="Поиск товаров..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <Button
          variant={showOnlyDiff ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOnlyDiff(!showOnlyDiff)}
          className="gap-1.5 h-10 shrink-0"
        >
          <Icon name="AlertTriangle" size={14} />
          Только расхождения
          {summary.discrepancies.length > 0 && (
            <span className="ml-1 text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
              {summary.discrepancies.length}
            </span>
          )}
        </Button>
      </div>
    </>
  );
}
