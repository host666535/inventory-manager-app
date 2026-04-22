import { format, isAfter, subDays, parseISO } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuditEventType =
  | 'operation_in'
  | 'operation_out'
  | 'order_created'
  | 'order_completed'
  | 'receipt_created'
  | 'receipt_posted'
  | 'doc_created';

export type AuditEvent = {
  id: string;
  date: string;
  type: AuditEventType;
  user: string;
  description: string;
  details?: string;
  icon: string;
  color: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

export const PAGE_SIZE = 100;

export const TYPE_LABELS: Record<AuditEventType, string> = {
  operation_in: 'Приход',
  operation_out: 'Расход',
  order_created: 'Заявка создана',
  order_completed: 'Заявка выполнена',
  receipt_created: 'Приёмка создана',
  receipt_posted: 'Приёмка проведена',
  doc_created: 'Документ',
};

export const TYPE_FILTER_OPTIONS: { value: 'all' | AuditEventType; label: string }[] = [
  { value: 'all', label: 'Все типы' },
  { value: 'operation_in', label: 'Приход' },
  { value: 'operation_out', label: 'Расход' },
  { value: 'order_created', label: 'Заявки (создание)' },
  { value: 'order_completed', label: 'Заявки (выполнение)' },
  { value: 'receipt_created', label: 'Приёмки (создание)' },
  { value: 'receipt_posted', label: 'Приёмки (проведение)' },
  { value: 'doc_created', label: 'Документы' },
];

export const RU_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function safeParse(dateStr: string): Date {
  try {
    return parseISO(dateStr);
  } catch {
    return new Date(dateStr);
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    const d = safeParse(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${mon}.${year} ${h}:${m}`;
  } catch {
    return dateStr;
  }
}

export function getDateGroup(dateStr: string): string {
  const d = safeParse(dateStr);
  const now = new Date();

  const dStr = format(d, 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');

  if (dStr === todayStr) return 'Сегодня';
  if (dStr === yesterdayStr) return 'Вчера';
  if (isAfter(d, subDays(now, 7))) return 'На этой неделе';
  if (isAfter(d, subDays(now, 30))) return 'В этом месяце';

  const month = RU_MONTHS[d.getMonth()];
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`;
}

// ─── Style helpers ───────────────────────────────────────────────────────────

export function getBorderColor(type: AuditEventType): string {
  switch (type) {
    case 'operation_in':
      return 'border-l-success';
    case 'operation_out':
      return 'border-l-destructive';
    case 'order_created':
    case 'order_completed':
      return 'border-l-blue-500';
    case 'receipt_created':
    case 'receipt_posted':
      return 'border-l-amber-500';
    case 'doc_created':
      return 'border-l-violet-500';
    default:
      return 'border-l-border';
  }
}

export function getIconBg(type: AuditEventType): string {
  switch (type) {
    case 'operation_in':
      return 'bg-success/10';
    case 'operation_out':
      return 'bg-destructive/10';
    case 'order_created':
    case 'order_completed':
      return 'bg-blue-500/10';
    case 'receipt_created':
    case 'receipt_posted':
      return 'bg-amber-500/10';
    case 'doc_created':
      return 'bg-violet-500/10';
    default:
      return 'bg-muted';
  }
}

export function getTypeBadge(type: AuditEventType): string {
  switch (type) {
    case 'operation_in':
      return 'bg-success/15 text-success';
    case 'operation_out':
      return 'bg-destructive/15 text-destructive';
    case 'order_created':
    case 'order_completed':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
    case 'receipt_created':
    case 'receipt_posted':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
    case 'doc_created':
      return 'bg-violet-500/15 text-violet-600 dark:text-violet-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
