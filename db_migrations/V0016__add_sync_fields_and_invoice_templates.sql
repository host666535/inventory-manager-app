-- Добавляем warehouse_id в work_orders (теряется при синхронизации)
ALTER TABLE t_p45174738_inventory_manager_ap.work_orders
  ADD COLUMN IF NOT EXISTS warehouse_id TEXT;

-- Добавляем attachments в receipts (были только в localStorage)
ALTER TABLE t_p45174738_inventory_manager_ap.receipts
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Создаём таблицу для шаблонов накладных (invoiceTemplates)
CREATE TABLE IF NOT EXISTS t_p45174738_inventory_manager_ap.invoice_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  data_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);