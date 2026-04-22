import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';
import QRScanner from '@/components/QRScanner';
import InventoryStartScreen from './inventory/InventoryStartScreen';
import InventoryProgressHeader from './inventory/InventoryProgressHeader';
import InventoryEntriesList from './inventory/InventoryEntriesList';
import ConfirmApplyDialog from './inventory/ConfirmApplyDialog';
import { useInventory } from './inventory/useInventory';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

export default function InventoryPage({ state, onStateChange }: Props) {
  const inv = useInventory(state, onStateChange);

  // ── Render: Before Start ─────────────────────────────────────────────────

  if (!inv.started) {
    return (
      <InventoryStartScreen
        state={state}
        warehouseFilter={inv.warehouseFilter}
        setWarehouseFilter={inv.setWarehouseFilter}
        startInventory={inv.startInventory}
      />
    );
  }

  // ── Render: Inventory In Progress ────────────────────────────────────────

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <InventoryProgressHeader
        warehouseName={inv.warehouseName}
        progress={inv.progress}
        summary={inv.summary}
        scanCount={inv.scanCount}
        scanLocationFilter={inv.scanLocationFilter}
        scanLocationName={inv.scanLocationName}
        search={inv.search}
        showOnlyDiff={inv.showOnlyDiff}
        setSearch={inv.setSearch}
        setShowOnlyDiff={inv.setShowOnlyDiff}
        setShowScanner={inv.setShowScanner}
        setScanLocationFilter={inv.setScanLocationFilter}
        setConfirmApply={inv.setConfirmApply}
        resetInventory={inv.resetInventory}
      />

      <InventoryEntriesList
        filteredEntries={inv.filteredEntries}
        showOnlyDiff={inv.showOnlyDiff}
        scanFlash={inv.scanFlash}
        updateActualQty={inv.updateActualQty}
      />

      <ConfirmApplyDialog
        open={inv.confirmApply}
        onOpenChange={inv.setConfirmApply}
        summary={inv.summary}
        applyCorrections={inv.applyCorrections}
      />

      <QRScanner
        open={inv.showScanner}
        onClose={() => inv.setShowScanner(false)}
        onResult={inv.handleScanResult}
      />

      {inv.scanToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50 animate-slide-up">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium
            ${inv.scanToast.kind === 'ok' ? 'bg-success text-success-foreground' :
              inv.scanToast.kind === 'warn' ? 'bg-warning text-warning-foreground' :
              'bg-destructive text-destructive-foreground'}`}>
            <Icon name={inv.scanToast.kind === 'ok' ? 'CheckCircle' : inv.scanToast.kind === 'warn' ? 'AlertTriangle' : 'XCircle'} size={15} />
            {inv.scanToast.text}
          </div>
        </div>
      )}
    </div>
  );
}
