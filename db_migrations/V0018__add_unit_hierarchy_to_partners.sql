-- Иерархия структурного подразделения у получателя: Объединение → Соединение
ALTER TABLE partners ADD COLUMN IF NOT EXISTS unit_group TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS unit_formation TEXT;
