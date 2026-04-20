import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { RealtimeStatus } from '@/data/realtime';

/**
 * Маленький индикатор статуса realtime-соединения в правом нижнем углу.
 * Зелёный — WebSocket подключён, изменения приходят мгновенно.
 * Жёлтый — переподключение.
 * Серый — оффлайн, работаем через polling-fallback.
 */
export default function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  const [expanded, setExpanded] = useState(false);
  const [hideUntilChange, setHideUntilChange] = useState(true);

  // При первой загрузке индикатор "сам показывается" на 3 секунды, потом сворачивается в точку
  useEffect(() => {
    const t = setTimeout(() => setHideUntilChange(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const color =
    status === 'online' ? 'bg-success' :
    status === 'connecting' ? 'bg-warning animate-pulse' :
    'bg-muted-foreground';

  const label =
    status === 'online' ? 'Подключено' :
    status === 'connecting' ? 'Подключение...' :
    'Офлайн (опрос раз в 5 сек)';

  const iconName =
    status === 'online' ? 'Wifi' :
    status === 'connecting' ? 'Loader' :
    'WifiOff';

  const showLabel = expanded || hideUntilChange;

  return (
    <button
      type="button"
      onClick={() => setExpanded(v => !v)}
      title={label}
      className={`fixed bottom-3 right-3 z-[60] flex items-center gap-1.5 rounded-full border border-border bg-card/95 backdrop-blur shadow-md transition-all
        ${showLabel ? 'px-2.5 py-1' : 'px-1.5 py-1.5'}
      `}
    >
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {showLabel && (
        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground/80">
          <Icon name={iconName} size={11} />
          {label}
        </span>
      )}
    </button>
  );
}
