import Icon from '@/components/ui/icon';
import { Item, Category } from '@/data/store';

type PhotoHook = {
  uploading: boolean;
  error: string | null;
  selectPhoto: (file?: File) => void;
  removePhoto: () => void;
};

type Props = {
  liveItem: Item;
  category: Category | undefined;
  photo: PhotoHook;
  isLow: boolean;
  isCritical: boolean;
  onClose: () => void;
};

export default function ItemDetailHeader({ liveItem, category, photo, isLow, isCritical, onClose }: Props) {
  return (
    <div className="relative h-40 bg-muted overflow-hidden shrink-0 group">
      {liveItem.imageUrl ? (
        <img src={liveItem.imageUrl} alt={liveItem.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: (category?.color || '#6366f1') + '14' }}>
          <Icon name="Package" size={44} style={{ color: (category?.color || '#6366f1') + '55' }} />
        </div>
      )}

      {/* Photo upload/replace overlay */}
      <label
        className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 hover:bg-black/40 text-white opacity-0 hover:opacity-100 cursor-pointer transition-all text-sm font-medium"
        title={liveItem.imageUrl ? 'Заменить фото' : 'Загрузить фото'}
      >
        {photo.uploading ? (
          <><Icon name="Loader2" size={18} className="animate-spin" />Загрузка...</>
        ) : (
          <>
            <Icon name={liveItem.imageUrl ? 'ImagePlus' : 'Upload'} size={18} />
            {liveItem.imageUrl ? 'Заменить фото' : 'Загрузить фото'}
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { photo.selectPhoto(e.target.files?.[0]); e.target.value = ''; }}
        />
      </label>

      <button onClick={onClose}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-colors z-10">
        <Icon name="X" size={16} />
      </button>
      {liveItem.imageUrl && (
        <button
          onClick={photo.removePhoto}
          title="Удалить фото"
          className="absolute top-3 right-12 w-8 h-8 rounded-lg bg-black/30 hover:bg-destructive/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors z-10"
        >
          <Icon name="Trash2" size={14} />
        </button>
      )}
      {isLow && (
        <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm z-10
          ${isCritical ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'}`}>
          <Icon name="AlertTriangle" size={12} />
          {isCritical ? 'Нет в наличии' : 'Низкий остаток'}
        </div>
      )}
      {photo.error && (
        <div className="absolute bottom-2 left-2 right-2 text-xs text-white bg-destructive/90 px-2 py-1 rounded text-center z-10">
          {photo.error}
        </div>
      )}
    </div>
  );
}
