import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Item, AppState, AssetType, Category } from '@/data/store';
import { loadBoard, BoardNode } from '@/pages/technician/BoardView';

type EditedState = {
  name: string;
  unit: string;
  assetType: AssetType;
  description: string;
  categoryId: string;
  lowStockThreshold: number;
};

type Props = {
  liveItem: Item;
  state: AppState;
  category: Category | undefined;
  editing: boolean;
  edited: EditedState;
  setEdited: (v: EditedState) => void;
  setEditing: (v: boolean) => void;
  handleSaveEdit: () => void;
  savingEdit?: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  handleDelete: () => void;
};

export default function ItemDetailInfoTab({
  liveItem,
  state,
  category,
  editing,
  edited,
  setEdited,
  setEditing,
  handleSaveEdit,
  savingEdit,
  showDeleteConfirm,
  setShowDeleteConfirm,
  handleDelete,
}: Props) {
  return (
    <div className="space-y-4">
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium">Единица измерения</label>
            <input value={edited.unit} onChange={e => setEdited({...edited, unit: e.target.value})}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Тип (МЗ/ОС)</label>
            <select value={edited.assetType} onChange={e => setEdited({...edited, assetType: e.target.value as AssetType})}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="МЗ">МЗ — материальные запасы</option>
              <option value="ОС">ОС — основные средства</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Категория</label>
            <select value={edited.categoryId} onChange={e => setEdited({...edited, categoryId: e.target.value})}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Без категории</option>
              {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Порог низкого остатка</label>
            <input type="number" min={0} value={edited.lowStockThreshold} onChange={e => setEdited({...edited, lowStockThreshold: Number(e.target.value)})}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Описание</label>
            <textarea value={edited.description} onChange={e => setEdited({...edited, description: e.target.value})} rows={3}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="flex-1" disabled={savingEdit}>Отмена</Button>
            <Button size="sm" onClick={handleSaveEdit} className="flex-1 gap-1.5" disabled={savingEdit}>
              <Icon name={savingEdit ? 'Loader2' : 'Check'} size={14} className={savingEdit ? 'animate-spin' : ''} />
              {savingEdit ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-0 divide-y divide-border text-sm">
          {[
            { label: 'Единица измерения', value: liveItem.unit },
            { label: 'Тип', value: liveItem.assetType || 'МЗ' },
            { label: 'Добавлен', value: new Date(liveItem.createdAt).toLocaleDateString('ru-RU') },
            { label: 'Категория', value: category?.name || '—' },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-2.5">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Board connections */}
      {(() => {
        const bd = loadBoard();
        const myNode = bd.nodes.find(n => n.type === 'item' && n.refId === liveItem.id);
        if (!myNode) return null;
        const linked = bd.connections
          .filter(c => c.fromId === myNode.id || c.toId === myNode.id)
          .map(c => {
            const otherId = c.fromId === myNode.id ? c.toId : c.fromId;
            const other = bd.nodes.find(n => n.id === otherId);
            return { conn: c, other };
          })
          .filter(l => l.other);
        if (linked.length === 0) return null;

        const resolveNode = (node: BoardNode) => {
          if (node.type === 'item') {
            const it = state.items.find(i => i.id === node.refId);
            return { title: it?.name || 'Удалено', icon: 'Package', color: state.categories.find(c => c.id === it?.categoryId)?.color || '#6366f1' };
          }
          if (node.type === 'doc') {
            const doc = (state.techDocs || []).find(d => d.id === node.refId);
            return { title: doc ? `${doc.docType} ${doc.docNumber || ''}`.trim() : 'Удалено', icon: 'FileText', color: '#f59e0b' };
          }
          if (node.type === 'file') return { title: node.fileName || 'Файл', icon: 'File', color: '#0ea5e9' };
          return { title: 'Заметка', icon: 'StickyNote', color: '#ec4899' };
        };

        return (
          <div className="pt-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Icon name="Cable" size={12} />Связи на доске ({linked.length})
            </div>
            <div className="space-y-1">
              {linked.map(({ conn, other }) => {
                if (!other) return null;
                const nd = resolveNode(other);
                return (
                  <div key={conn.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40 border border-border/50">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: conn.color || '#6366f1' }} />
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: nd.color + '20', color: nd.color }}>
                      <Icon name={nd.icon} size={11} />
                    </div>
                    <span className="text-xs font-medium truncate flex-1">{nd.title}</span>
                    {conn.label && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{conn.label}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {!editing && (
        <div className="pt-4 border-t border-border">
          {!showDeleteConfirm ? (
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 gap-2">
              <Icon name="Trash2" size={14} />Удалить номенклатуру
            </Button>
          ) : (
            <div className="p-3 bg-destructive/8 border border-destructive/20 rounded-xl space-y-3">
              <p className="text-sm text-muted-foreground">
                <b className="text-foreground">«{liveItem.name}»</b> будет удалён вместе с историей, остатками и документами. Это необратимо.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} className="flex-1">Отмена</Button>
                <Button size="sm" onClick={handleDelete}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold gap-1.5">
                  <Icon name="Trash2" size={13} />Удалить
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}