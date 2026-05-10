-- Поля для импорта/экспорта выдач из Excel (объединение/соединение/в/ч и серийник позиции)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS unit_group TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS unit_formation TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS unit_number TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS serial_number TEXT;
