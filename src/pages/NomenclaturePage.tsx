import { useState, useMemo } from 'react';
import { AppState, Item } from '@/data/store';
import ItemDetailModal from '@/components/ItemDetailModal';
import NewItemModal from './nomenclature/NewItemModal';
import DeleteItemModal from './nomenclature/DeleteItemModal';
import NomenclatureHeader from './nomenclature/NomenclatureHeader';
import NomenclatureTable, { SortField, SortDir } from './nomenclature/NomenclatureTable';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

export default function NomenclaturePage({ state, onStateChange }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'zero' | 'ok'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let items = [...state.items];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') items = items.filter(i => i.categoryId === categoryFilter);
    if (locationFilter !== 'all') items = items.filter(i => i.locationId === locationFilter);
    if (stockFilter === 'low') items = items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold);
    if (stockFilter === 'zero') items = items.filter(i => i.quantity === 0);
    if (stockFilter === 'ok') items = items.filter(i => i.quantity > i.lowStockThreshold);

    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name, 'ru');
      else if (sortField === 'quantity') cmp = a.quantity - b.quantity;
      else if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'category') {
        const ca = state.categories.find(c => c.id === a.categoryId)?.name || '';
        const cb = state.categories.find(c => c.id === b.categoryId)?.name || '';
        cmp = ca.localeCompare(cb, 'ru');
      } else if (sortField === 'location') {
        const la = state.locations.find(l => l.id === a.locationId)?.name || '';
        const lb = state.locations.find(l => l.id === b.locationId)?.name || '';
        cmp = la.localeCompare(lb, 'ru');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [state.items, state.categories, state.locations, search, categoryFilter, locationFilter, stockFilter, sortField, sortDir]);

  const selectedItem = selectedItemId ? state.items.find(i => i.id === selectedItemId) || null : null;

  const zeroCount = state.items.filter(i => i.quantity === 0).length;
  const lowCount = state.items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const okCount = state.items.filter(i => i.quantity > i.lowStockThreshold).length;
  const activeFilters = [categoryFilter !== 'all', locationFilter !== 'all', stockFilter !== 'all', search !== ''].filter(Boolean).length;

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <NomenclatureHeader
        state={state}
        search={search}
        setSearch={setSearch}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        locationFilter={locationFilter}
        setLocationFilter={setLocationFilter}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        onAddClick={() => setShowNewItem(true)}
        zeroCount={zeroCount}
        lowCount={lowCount}
        okCount={okCount}
        activeFilters={activeFilters}
      />

      <NomenclatureTable
        state={state}
        filtered={filtered}
        sortField={sortField}
        sortDir={sortDir}
        handleSort={handleSort}
        onSelectItem={id => setSelectedItemId(id)}
        onDeleteItem={item => setDeleteItem(item)}
        onAddClick={() => setShowNewItem(true)}
      />

      <ItemDetailModal item={selectedItem} state={state} onStateChange={onStateChange} onClose={() => setSelectedItemId(null)} />
      {showNewItem && <NewItemModal state={state} onStateChange={onStateChange} onClose={() => setShowNewItem(false)} />}
      {deleteItem && <DeleteItemModal item={deleteItem} state={state} onStateChange={onStateChange} onClose={() => setDeleteItem(null)} />}
    </div>
  );
}
