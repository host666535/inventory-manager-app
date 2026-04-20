export type InventoryEntry = {
  itemId: string;
  itemName: string;
  systemQty: number;
  actualQty: number | null;
  unit: string;
  category: string;
  categoryColor: string;
  locationName: string;
  locationId: string;
};

export type ScanFlash = { itemId: string; ts: number } | null;
export type ScanToast = { kind: 'ok' | 'warn' | 'error'; text: string } | null;

export type InventorySummary = {
  total: number;
  counted: number;
  matches: number;
  surpluses: number;
  shortages: number;
  discrepancies: InventoryEntry[];
};

export type InventoryProgress = {
  total: number;
  counted: number;
};
