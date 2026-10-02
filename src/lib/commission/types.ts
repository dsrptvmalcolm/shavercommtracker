export type MiniTier = { startUnits: number; amount: number };
export type StoreVolumeTier = { units: number; amount: number };

export type CommissionSettings = {
  miniTiers: MiniTier[];
  frontPct: number;
  backPct: number;
  productHatTrickBonus: number;
  twoCarDaySpiff: number;
  hatTrickDaySpiff: number;
  multilingualSpiff: number;
  ninetyDaySpiff: number;
  personalBestSpiff: number;
  storeVolumeTiers: StoreVolumeTier[];
};

export type DealInput = {
  id: string;
  /** YYYY-MM-DD */
  saleDate: string;
  salespersonId: string | null;
  splitSalespersonId: string | null;
  isHouse: boolean;
  frontGross: number | null;
  backGross: number | null;
  /** Spiff amount for each product sold on the deal */
  productSpiffs: number[];
  multilingual: boolean;
  ninetyDay: boolean;
};

export type SalespersonInput = {
  id: string;
  multilingualEligible: boolean;
  /** Best month (units) before the month being calculated — manual baseline or history, whichever is higher */
  priorBestUnits: number;
};

export type AdjustmentInput = { staffId: string; amount: number; note: string };

export type DealCommission = {
  dealId: string;
  share: number;
  mini: number;
  front: number;
  back: number;
  products: number;
  productHatTrick: boolean;
  multilingual: number;
  ninetyDay: number;
  total: number;
};

export type MonthSummary = {
  staffId: string;
  units: number;
  miniRate: number;
  deals: DealCommission[];
  /** Mini + front + back — Airtable's "Deals Only" */
  vehicleCommission: number;
  productSpiffs: number;
  multilingualSpiffs: number;
  ninetyDaySpiffs: number;
  twoCarDayCount: number;
  twoCarDaySpiffs: number;
  hatTrickDayCount: number;
  hatTrickDaySpiffs: number;
  personalBest: boolean;
  personalBestSpiff: number;
  storeVolumeSpiff: number;
  adjustments: number;
  total: number;
};
