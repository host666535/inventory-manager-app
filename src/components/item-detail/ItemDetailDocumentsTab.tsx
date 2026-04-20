import Icon from '@/components/ui/icon';
import { Item, AppState } from '@/data/store';
import { TechDocsList } from '../ItemAttachmentsTab';
import { loadBoard, BoardNode } from '@/pages/technician/BoardView';

type Props = {
  liveItem: Item;
  state: AppState;
  itemDocs: NonNullable<AppState['techDocs']>;
};

export default function ItemDetailDocumentsTab({ liveItem, state, itemDocs }: Props) {
  return (
    <div className="space-y-4">
      <TechDocsList itemDocs={itemDocs} state={state} />

      {/* Files linked on board */}
      {(() => {
        const bd = loadBoard();
        const myNode = bd.nodes.find(n => n.type === 'item' && n.refId === liveItem.id);
        if (!myNode) return null;
        const linkedFiles = bd.connections
          .filter(c => c.fromId === myNode.id || c.toId === myNode.id)
          .map(c => bd.nodes.find(n => n.id === (c.fromId === myNode.id ? c.toId : c.fromId)))
          .filter((n): n is BoardNode => !!n && n.type === 'file');
        if (linkedFiles.length === 0) return null;

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Icon name="Cable" size={12} />Файлы с доски ({linkedFiles.length})
            </div>
            <div className="grid grid-cols-2 gap-2">
              {linkedFiles.map(file => {
                const isImage = file.fileMime?.startsWith('image/');
                return (
                  <a key={file.id} href={file.fileDataUrl} download={file.fileName}
                    className="flex flex-col rounded-xl border border-border bg-muted/30 overflow-hidden hover:border-primary/40 hover:shadow-md transition-all group">
                    {isImage && file.fileDataUrl ? (
                      <div className="h-24 bg-muted overflow-hidden">
                        <img src={file.fileDataUrl} alt={file.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                    ) : (
                      <div className="h-16 bg-muted flex items-center justify-center">
                        <Icon name="File" size={24} className="text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="px-2.5 py-2 flex items-center gap-1.5">
                      <Icon name="Download" size={11} className="text-primary shrink-0" />
                      <span className="text-[11px] font-medium truncate">{file.fileName || 'Файл'}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })()}

      {itemDocs.length === 0 && (() => {
        const bd = loadBoard();
        const myNode = bd.nodes.find(n => n.type === 'item' && n.refId === liveItem.id);
        const hasFiles = myNode && bd.connections
          .filter(c => c.fromId === myNode.id || c.toId === myNode.id)
          .some(c => bd.nodes.find(n => n.id === (c.fromId === myNode.id ? c.toId : c.fromId))?.type === 'file');
        if (hasFiles) return null;
        return (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
            <Icon name="FileText" size={28} className="mb-2 opacity-30" />
            <p>Документы добавляются через вкладку <b className="text-foreground">Техник</b></p>
          </div>
        );
      })()}
    </div>
  );
}
