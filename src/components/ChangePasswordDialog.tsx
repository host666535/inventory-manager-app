import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { apiChangePassword, useAuth } from '@/data/auth';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ChangePasswordDialog({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setPw1(''); setPw2(''); setLoading(false); };
  const close = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (pw1.length < 6) { toast.error('Пароль должен быть не короче 6 символов'); return; }
    if (pw1 !== pw2) { toast.error('Пароли не совпадают'); return; }

    setLoading(true);
    const res = await apiChangePassword(user.id, pw1);
    setLoading(false);
    if (res.error) { toast.error(res.error); return; }

    toast.success('Пароль обновлён. Войдите заново с новым паролем.');
    close();
    await logout();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="sm:max-w-[min(96vw,500px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="KeyRound" size={18} />
            Смена пароля
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Текущий пользователь: <span className="font-semibold text-foreground">{user?.displayName}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">Новый пароль</Label>
            <Input id="new-pw" type="password" value={pw1} onChange={e => setPw1(e.target.value)}
              autoFocus placeholder="не короче 6 символов" autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw2">Повторите пароль</Label>
            <Input id="new-pw2" type="password" value={pw2} onChange={e => setPw2(e.target.value)}
              placeholder="••••••••" autoComplete="new-password" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close} className="flex-1" disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" className="flex-1 font-semibold" disabled={loading}>
              {loading ? <Icon name="Loader2" size={14} className="animate-spin mr-1.5" /> : <Icon name="Check" size={14} className="mr-1.5" />}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}