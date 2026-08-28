export type CatalogVariant = {
  id: string;
  storage_gb: number | null;
  region: string;
  products: { brand: string; family: string } | null;
};

export type InventoryMarketState =
  | 'PRIVATE'
  | 'OFFERS_ENABLED'
  | 'MARKET_ELIGIBLE'
  | 'ACTIVATING'
  | 'RESERVED'
  | 'SOLD';

export type InventoryValueEvidence = {
  estimated_value_cents: number;
  currency: 'EUR';
  source_type: string;
  observed_at: string;
};

export type ValuationConditionGrade = 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';

export type ValuationInput = {
  purchasePriceCents: number;
  purchaseYear: number;
  conditionGrade: ValuationConditionGrade;
};

export type ConditionInput = {
  color?: string;
  displayState?: 'INTACT' | 'DAMAGED';
  housingState?: 'CLEAN' | 'LIGHT_WEAR' | 'HEAVY_WEAR' | 'DAMAGED';
  camerasWorking?: boolean;
  biometricsWorking?: boolean;
  batteryHealth?: number | null;
  networkLocked?: boolean;
  otherDefect?: boolean;
};

export type PrivateInventoryItem = {
  id: string;
  custom_name: string | null;
  category: string | null;
  location_label: string | null;
  notes: string | null;
  color: string | null;
  created_at: string;
  market_state: InventoryMarketState | null;
  value_evidence: InventoryValueEvidence | null;
  product_variants: {
    id: string;
    storage_gb: number | null;
    region: string;
    products: { brand: string; family: string } | null;
  } | null;
  condition_snapshots: Array<{
    display_state: 'INTACT' | 'DAMAGED';
    housing_state: 'CLEAN' | 'LIGHT_WEAR' | 'HEAVY_WEAR' | 'DAMAGED';
    cameras_working: boolean;
    biometrics_working: boolean;
    battery_health: number | null;
    network_locked: boolean | null;
    other_defect: boolean;
    captured_at: string;
  }>;
};

export type AddPrivateDeviceInput = ConditionInput & { variantId: string };

export type PrivateThingInput = {
  name: string;
  category?: string;
  location?: string;
  notes?: string;
};
