import { AppState } from '@/data/store';
import ItemDetailModal from '@/components/ItemDetailModal';
import { AddLocationModal, MoveItemModal, TransferWarehouseModal } from './warehouse-map/WarehouseMapModals';
import LocationDetailPanel from './warehouse-map/LocationDetailPanel';
import { useWarehouseMap } from './warehouse-map/useWarehouseMap';
import WarehouseMapHeader from './warehouse-map/WarehouseMapHeader';
import WarehouseMapGrid from './warehouse-map/WarehouseMapGrid';
import WarehouseMapList from './warehouse-map/WarehouseMapList';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  initialLocationId?: string | null;
};

export default function WarehouseMapPage({ state, onStateChange, initialLocationId }: Props) {
  const m = useWarehouseMap(state, onStateChange, initialLocationId);

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <WarehouseMapHeader
        state={state}
        warehouses={m.warehouses}
        activeWarehouse={m.activeWarehouse}
        activeWarehouseId={m.activeWarehouseId}
        setActiveWarehouseId={m.setActiveWarehouseId}
        setSelectedLocationId={m.setSelectedLocationId}
        totalLocations={m.totalLocations}
        occupiedLocations={m.occupiedLocations}
        lowItems={m.lowItems}
        criticalItems={m.criticalItems}
        search={m.search}
        setSearch={m.setSearch}
        categoryFilter={m.categoryFilter}
        setCategoryFilter={m.setCategoryFilter}
        viewMode={m.viewMode}
        setViewMode={m.setViewMode}
        setShowTransferModal={m.setShowTransferModal}
        onOpenAdd={() => { m.setEditLocation(undefined); m.setShowAddLocation(true); }}
      />

      <div className={`flex gap-4 ${m.selectedLocation ? 'items-start' : ''}`}>
        <div className={`flex-1 min-w-0 transition-all ${m.selectedLocation ? 'hidden lg:block' : ''}`}>
          {m.viewMode === 'grid' ? (
            <WarehouseMapGrid
              state={state}
              activeWarehouseId={m.activeWarehouseId}
              topLocations={m.topLocations}
              childLocations={m.childLocations}
              selectedLocationId={m.selectedLocationId}
              setSelectedLocationId={m.setSelectedLocationId}
              dragOverLocationId={m.dragOverLocationId}
              locationColors={m.locationColors}
              search={m.search}
              categoryFilter={m.categoryFilter}
              rackDirs={m.rackDirs}
              toggleRackDir={m.toggleRackDir}
              setEditLocation={m.setEditLocation}
              setShowAddLocation={m.setShowAddLocation}
              handleDeleteLocation={m.handleDeleteLocation}
              handleDragOver={m.handleDragOver}
              handleDragLeave={m.handleDragLeave}
              handleDrop={m.handleDrop}
              handleItemDragStart={m.handleItemDragStart}
            />
          ) : (
            <WarehouseMapList
              state={state}
              selectedLocationId={m.selectedLocationId}
              setSelectedLocationId={m.setSelectedLocationId}
              locationColors={m.locationColors}
              locationsWithMatches={m.locationsWithMatches}
              search={m.search}
              categoryFilter={m.categoryFilter}
              setEditLocation={m.setEditLocation}
              setShowAddLocation={m.setShowAddLocation}
              handleDeleteLocation={m.handleDeleteLocation}
            />
          )}
        </div>

        {m.selectedLocation && (
          <div className="w-full lg:w-80 xl:w-96 shrink-0 bg-card border border-border rounded-2xl shadow-card p-4 animate-slide-up lg:animate-fade-in sticky top-20 max-h-[calc(100vh-100px)] flex flex-col">
            <LocationDetailPanel
              location={m.selectedLocation}
              state={state}
              onStateChange={onStateChange}
              onClose={() => m.setSelectedLocationId(null)}
              onItemSelect={id => m.setSelectedItemId(id)}
              onItemDragStart={m.handleItemDragStart}
              onSelectLocation={id => m.setSelectedLocationId(id)}
            />
          </div>
        )}
      </div>

      {m.showAddLocation && (
        <AddLocationModal
          state={state}
          onStateChange={onStateChange}
          onClose={() => { m.setShowAddLocation(false); m.setEditLocation(undefined); }}
          editLocation={m.editLocation?.id ? m.editLocation : undefined}
          activeWarehouseId={m.activeWarehouseId}
        />
      )}

      {m.moveModal && (
        <MoveItemModal
          itemId={m.moveModal.itemId}
          fromLocationId={m.moveModal.fromLocationId}
          toLocationId={m.moveModal.toLocationId}
          state={state}
          onStateChange={onStateChange}
          onClose={() => m.setMoveModal(null)}
        />
      )}

      {m.selectedItem && (
        <ItemDetailModal
          item={m.selectedItem}
          state={state}
          onStateChange={onStateChange}
          onClose={() => m.setSelectedItemId(null)}
        />
      )}

      {m.showTransferModal && (
        <TransferWarehouseModal
          state={state}
          onStateChange={onStateChange}
          onClose={() => m.setShowTransferModal(false)}
          defaultFromId={m.activeWarehouseId}
        />
      )}
    </div>
  );
}
