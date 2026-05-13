import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import QRCode from 'qrcode';
import { toast } from 'sonner';

export default function ServerQRDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    const proto = window.location.protocol;
    const host = window.location.host;
    return `${proto}//${host}`;
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !canvasRef.current || !url.trim()) return;
    QRCode.toCanvas(canvasRef.current, url.trim(), {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(() => {});
  }, [open, url]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Адрес скопирован');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[min(96vw,700px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="QrCode" size={20} />
            QR-код для подключения мобильного приложения
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center bg-white rounded-lg p-4 border">
            <canvas ref={canvasRef} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-qr-url">Адрес сервера</Label>
            <div className="flex gap-2">
              <Input
                id="server-qr-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button variant="outline" size="icon" onClick={copyUrl} title="Скопировать">
                <Icon name="Copy" size={16} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              При необходимости поправь адрес — он должен быть доступен из локальной сети (Wi-Fi).
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Как использовать</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Открой мобильное приложение StockBase на телефоне</li>
              <li>На экране настройки нажми «Сканировать QR-код»</li>
              <li>Наведи камеру на этот QR — приложение подключится автоматически</li>
            </ol>
          </div>

          <Button onClick={onClose} variant="outline" className="w-full">Закрыть</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}