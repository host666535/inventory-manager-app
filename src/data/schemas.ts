import { z } from 'zod';

export const itemFormSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(200, 'Название слишком длинное (до 200 символов)'),
  unit: z.string().trim().min(1, 'Выберите единицу измерения'),
  categoryId: z.string().trim().min(1, 'Выберите категорию'),
  quantity: z.coerce.number().int('Количество должно быть целым').min(0, 'Количество не может быть отрицательным').max(1_000_000, 'Слишком большое количество'),
  lowStockThreshold: z.coerce.number().int('Порог должен быть целым').min(0, 'Порог не может быть отрицательным').max(1_000_000, 'Слишком большой порог'),
  description: z.string().max(1000, 'Описание слишком длинное (до 1000 символов)').optional(),
});

export type ItemFormInput = z.infer<typeof itemFormSchema>;

export const locationFormSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(100, 'Название слишком длинное (до 100 символов)'),
  description: z.string().max(500, 'Описание слишком длинное').optional(),
  warehouseId: z.string().optional(),
  parentId: z.string().optional(),
});

export type LocationFormInput = z.infer<typeof locationFormSchema>;

export const receiptLineSchema = z.object({
  itemLabel: z.string().trim().min(1, 'Укажите товар').max(200, 'Слишком длинное название'),
  qty: z.coerce.number().int('Количество должно быть целым').min(1, 'Количество должно быть больше 0').max(1_000_000, 'Слишком большое количество'),
  unit: z.string().trim().min(1, 'Выберите единицу'),
  price: z.coerce.number().min(0, 'Цена не может быть отрицательной').optional(),
});

export type ReceiptLineInput = z.infer<typeof receiptLineSchema>;

export const warehouseFormSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(100, 'Название слишком длинное'),
  address: z.string().max(300, 'Адрес слишком длинный').optional(),
  description: z.string().max(500, 'Описание слишком длинное').optional(),
});

export type WarehouseFormInput = z.infer<typeof warehouseFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(80, 'Название слишком длинное'),
});

export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

export function firstError<T>(result: z.SafeParseReturnType<T, T>): string | null {
  if (result.success) return null;
  return result.error.issues[0]?.message || 'Проверьте введённые данные';
}
