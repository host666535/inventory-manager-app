import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { saveServerUrl, pingServer, getSavedServerUrl } from '@/data/serverConfig';

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]>;
}

export default function ServerSetupScreen({ onConnected }: { onConnected: () => void }) {
  const [url, setUrl] = useState(getSavedServerUrl() || 'http://192.168.1.100:3000');
  const [checking, setChecking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startScanner = useCallback(async () => {
    setCameraError('');
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (typeof BarcodeDetector === 'undefined') {
        setCameraError('Браузер не поддерживает сканирование. Введи адрес вручную.');
        return;
      }
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const raw = codes[0].rawValue.trim();
            const cleaned = raw.startsWith('stockbase://') ? raw.slice('stockbase://'.length) : raw;
            stopCamera();
            setScannerOpen(false);
            setUrl(cleaned);
            toast.success('QR-код считан');
            return;
          }
        } catch { /* ignore */ }
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось получить доступ к камере';
      setCameraError(msg);
    }
  }, [stopCamera]);

  const closeScanner = useCallback(() => {
    stopCamera();
    setScannerOpen(false);
  }, [stopCamera]);

  const handleConnect = useCallback(async () => {
    if (!url.trim()) {
      toast.error('Введи адрес сервера');
      return;
    }
    setChecking(true);
    const result = await pingServer(url);
    setChecking(false);
    if (!result.ok) {
      toast.error(result.error || 'Сервер не отвечает');
      return;
    }
    saveServerUrl(url);
    toast.success('Подключение установлено');
    onConnected();
  }, [url, onConnected]);

  if (scannerOpen) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 bg-black/70 text-white">
          <span className="font-medium">Сканирование QR-кода сервера</span>
          <Button variant="ghost" size="sm" onClick={closeScanner} className="text-white hover:bg-white/10">
            <Icon name="X" size={20} />
          </Button>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-4 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
          {cameraError && (
            <div className="absolute bottom-6 left-4 right-4 bg-destructive text-destructive-foreground p-3 rounded-lg text-sm">
              {cameraError}
            </div>
          )}
        </div>
        <div className="p-4 bg-black/70 text-white text-center text-sm">
          Наведи камеру на QR-код, показанный на сервере
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="Server" size={24} className="text-primary" />
            </div>
            <div>
              <CardTitle>Подключение к серверу</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">StockBase · первая настройка</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Укажи адрес сервера StockBase в локальной сети. Адрес можно получить у администратора или отсканировать QR-код в настройках на компьютере.
          </div>

          <Button onClick={startScanner} className="w-full" size="lg">
            <Icon name="QrCode" size={18} className="mr-2" />
            Сканировать QR-код
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">или вручную</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-url">Адрес сервера</Label>
            <Input
              id="server-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.1.100:3000"
              autoComplete="off"
              autoCapitalize="off"
            />
            <p className="text-xs text-muted-foreground">
              Например: <code className="text-foreground">http://192.168.1.100:3000</code>
            </p>
          </div>

          <Button onClick={handleConnect} disabled={checking} className="w-full" size="lg" variant="default">
            {checking ? (
              <><Icon name="Loader2" size={18} className="mr-2 animate-spin" /> Проверка...</>
            ) : (
              <><Icon name="Plug" size={18} className="mr-2" /> Подключиться</>
            )}
          </Button>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Подсказка</p>
            <p>Сервер и устройство должны быть в одной Wi-Fi сети. Адрес показывает администратор после запуска сервера.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
