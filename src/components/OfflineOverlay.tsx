import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { isMobileApp, getSavedServerUrl, resolveBaseUrl } from '@/data/serverConfig';

/**
 * Оверлей «Нет подключения».
 *
 * variant="full" — полноэкранный блокирующий экран (при первой загрузке,
 *                   когда данных ещё нет и работать нельзя).
 * variant="banner" — баннер поверх интерфейса, блокирующий клики,
 *                   но не заменяющий содержимое (при обрыве WS в процессе работы).
 */
export default function OfflineOverlay({
  variant,
  onRetry,
  onChangeServer,
}: {
  variant: 'full' | 'banner';
  onRetry: () => void | Promise<void>;
  onChangeServer?: () => void;
}) {
  // В мобильном APK ВСЕГДА даём сменить адрес сервера — это единственный способ
  // выйти из ситуации, когда введён неправильный IP/порт.
  const showChangeServer = isMobileApp() && !!onChangeServer;
  const currentServerUrl = getSavedServerUrl() || resolveBaseUrl();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  if (variant === 'full') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <div className="max-w-sm w-full mx-4 p-6 rounded-2xl border border-border bg-card shadow-lg text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-destructive/12 text-destructive flex items-center justify-center">
            <Icon name="WifiOff" size={26} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">Нет подключения к серверу</h2>
            <p className="text-sm text-muted-foreground">
              Приложение работает только онлайн. Проверьте интернет и состояние сервера.
            </p>
          </div>
          {currentServerUrl && (
            <div className="rounded-lg bg-muted/60 border border-border px-3 py-2 text-left">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                Текущий адрес сервера
              </div>
              <div className="text-xs font-mono text-foreground break-all">
                {currentServerUrl}
              </div>
            </div>
          )}
          <div className="text-left text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">Проверь:</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>сервер StockBase запущен на компьютере</li>
              <li>телефон и компьютер в одной Wi-Fi сети</li>
              <li>IP-адрес и порт указаны верно</li>
              <li>брандмауэр не блокирует порт 3000</li>
            </ul>
          </div>
          <Button onClick={handleRetry} disabled={retrying} className="w-full">
            <Icon
              name={retrying ? 'Loader2' : 'RefreshCw'}
              size={15}
              className={`mr-1.5 ${retrying ? 'animate-spin' : ''}`}
            />
            {retrying ? 'Подключение…' : 'Попробовать снова'}
          </Button>
          {showChangeServer && (
            <Button onClick={onChangeServer} variant="outline" className="w-full">
              <Icon name="Server" size={15} className="mr-1.5" />
              Сменить адрес сервера
            </Button>
          )}
        </div>
      </div>
    );
  }

  // banner: блокируем клики по всему UI, но не прячем его — чтобы можно было видеть
  // что произойдёт после восстановления соединения.
  return (
    <div
      className="fixed inset-0 z-[90] bg-background/40 backdrop-blur-[2px] flex items-start justify-center p-4 pt-20 pointer-events-auto"
      aria-label="Нет подключения"
    >
      <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-card shadow-lg p-4 flex items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 shrink-0 rounded-full bg-destructive/12 text-destructive flex items-center justify-center">
          <Icon name="WifiOff" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">Потеряно соединение</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Действия временно недоступны. Ждём восстановление связи…
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying}>
          <Icon
            name={retrying ? 'Loader2' : 'RefreshCw'}
            size={13}
            className={`mr-1 ${retrying ? 'animate-spin' : ''}`}
          />
          {retrying ? '…' : 'Повторить'}
        </Button>
      </div>
    </div>
  );
}