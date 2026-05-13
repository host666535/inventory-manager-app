import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { saveServerUrl, pingServer, getSavedServerUrl, normalizeServerUrl } from '@/data/serverConfig';

export default function ServerUrlDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [url, setUrl] = useState(getSavedServerUrl() || '');
  const [checking, setChecking] = useState(false);
  const [lastError, setLastError] = useState<{ msg: string; hint?: string } | null>(null);

  const handleConnect = async () => {
    if (!url.trim()) {
      toast.error('Введи адрес сервера');
      return;
    }
    setLastError(null);
    const normalized = normalizeServerUrl(url);
    if (normalized !== url) setUrl(normalized);
    setChecking(true);
    const result = await pingServer(normalized);
    setChecking(false);
    if (!result.ok) {
      const msg = result.error || 'Сервер не отвечает';
      setLastError({ msg, hint: result.hint });
      toast.error(msg);
      return;
    }
    saveServerUrl(normalized);
    toast.success('Подключение установлено');
    onOpenChange(false);
    onSaved?.();
    setTimeout(() => window.location.reload(), 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(96vw,500px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Server" size={18} className="text-primary" />
            Адрес сервера
          </DialogTitle>
          <DialogDescription>
            Укажи адрес сервера StockBase в локальной сети.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="server-url-dialog">URL сервера</Label>
            <Input
              id="server-url-dialog"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.1.100:3000"
              autoComplete="off"
              autoCapitalize="off"
              onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
            />
            <p className="text-[11px] text-muted-foreground">
              Можно ввести только IP — порт <code>:3000</code> и <code>http://</code> подставятся сами.
            </p>
          </div>

          {lastError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive space-y-1">
              <div className="flex items-start gap-1.5">
                <Icon name="AlertCircle" size={13} className="mt-0.5 shrink-0" />
                <p className="font-medium">{lastError.msg}</p>
              </div>
              {lastError.hint && <p className="pl-5 text-destructive/80">{lastError.hint}</p>}
            </div>
          )}

          <Button onClick={handleConnect} disabled={checking} className="w-full">
            {checking ? (
              <><Icon name="Loader2" size={15} className="mr-1.5 animate-spin" /> Проверка…</>
            ) : (
              <><Icon name="Plug" size={15} className="mr-1.5" /> Сохранить и подключиться</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}