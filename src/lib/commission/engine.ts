import type {
  AdjustmentInput,
  CommissionSettings,
  DealCommission,
  DealInput,
  MiniTier,
  MonthSummary,
  SalespersonInput,
  StoreVolumeTier,
} from "./types";

export const PRODUCT_HAT_TRICK_MIN = 3;

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

const sortedMiniTiers = (tiers: MiniTier[]): MiniTier[] =>
  [...tiers].sort((a, b) => a.startUnits - b.startUnits);

/** Per-unit mini for the month. The tier reached applies to every unit (retroactive). */
export const miniRateFor = (units: number, tiers: MiniTier[]): number => {
  const sorted = sortedMiniTiers(tiers);
  if (sorted.length === 0) return 0;
  const reached = sorted.filter((t) => units >= t.startUnits);
  return (reached.at(-1) ?? sorted[0]).amount;
};

export const currentMiniTierIndex = (units: number, tiers: MiniTier[]): number => {
  const sorted = sortedMiniTiers(tiers);
  const idx = sorted.findLastIndex((t) => units >= t.startUnits);
  return Math.max(idx, 0);
};

/** Highest tier reached only — tiers don't stack. */
export const storeVolumeSpiffFor = (storeUnits: number, tiers: StoreVolumeTier[]): number =>
  [...tiers]
    .sort((a, b) => a.units - b.units)
    .filter((t) => storeUnits >= t.units)
    .at(-1)?.amount ?? 0;

/** 3+ products pays the flat hat trick bonus instead of the individual product spiffs. */
export const productSpiffFor = (
  productSpiffs: number[],
  settings: CommissionSettings,
): { amount: number; hatTrick: boolean } =>
  productSpiffs.length >= PRODUCT_HAT_TRICK_MIN
    ? { amount: settings.productHatTrickBonus, hatTrick: true }
    : { amount: sum(productSpiffs), hatTrick: false };

export const isSplit = (deal: DealInput): boolean =>
  !deal.isHouse && deal.splitSalespersonId !== null && deal.splitSalespersonId !== deal.salespersonId;

/** The share of a deal credited to a salesperson: 1, 0.5 for a split, 0 if not theirs. */
export const shareOf = (deal: DealInput, staffId: string): number => {
  if (deal.isHouse) return 0;
  const split = isSplit(deal);
  if (deal.salespersonId === staffId) return split ? 0.5 : 1;
  if (split && deal.splitSalespersonId === staffId) return 0.5;
  return 0;
};

export const dealCommission = (
  deal: DealInput,
  share: number,
  miniRate: number,
  multilingualEligible: boolean,
  settings: CommissionSettings,
): DealCommission => {
  const products = productSpiffFor(deal.productSpiffs, settings);
  const mini = miniRate * share;
  const front = (deal.frontGross ?? 0) * settings.frontPct * share;
  const back = (deal.backGross ?? 0) * settings.backPct * share;
  const productAmount = products.amount * share;
  const multilingual = deal.multilingual && multilingualEligible ? settings.multilingualSpiff * share : 0;
  const ninetyDay = deal.ninetyDay ? settings.ninetyDaySpiff * share : 0;
  return {
    dealId: deal.id,
    share,
    mini,
    front,
    back,
    products: productAmount,
    productHatTrick: products.hatTrick,
    multilingual,
    ninetyDay,
    total: mini + front + back + productAmount + multilingual + ninetyDay,
  };
};

/** 2 cars on a day = 2-car day, 3+ = hat trick only. Split (half) deals don't count. */
export const daySpiffCounts = (
  deals: DealInput[],
  staffId: string,
): { twoCarDays: number; hatTrickDays: number } => {
  const perDay = deals
    .filter((d) => shareOf(d, staffId) === 1)
    .reduce<Map<string, number>>((m, d) => m.set(d.saleDate, (m.get(d.saleDate) ?? 0) + 1), new Map());
  const counts = [...perDay.values()];
  return {
    twoCarDays: counts.filter((c) => c === 2).length,
    hatTrickDays: counts.filter((c) => c >= 3).length,
  };
};

export const storeUnitsFor = (deals: DealInput[]): number => deals.length;

export const unitsFor = (deals: DealInput[], staffId: string): number =>
  sum(deals.map((d) => shareOf(d, staffId)));

type MonthArgs = {
  salesperson: SalespersonInput;
  /** Every deal in the month — the salesperson's own deals are picked out by share */
  deals: DealInput[];
  storeUnits: number;
  adjustments: AdjustmentInput[];
  settings: CommissionSettings;
};

export const salespersonMonth = ({
  salesperson,
  deals,
  storeUnits,
  adjustments,
  settings,
}: MonthArgs): MonthSummary => {
  const mine = deals.filter((d) => shareOf(d, salesperson.id) > 0);
  const units = unitsFor(mine, salesperson.id);
  const miniRate = miniRateFor(units, settings.miniTiers);
  const dealRows = mine
    .toSorted((a, b) => a.saleDate.localeCompare(b.saleDate))
    .map((d) =>
      dealCommission(d, shareOf(d, salesperson.id), miniRate, salesperson.multilingualEligible, settings),
    );
  const { twoCarDays, hatTrickDays } = daySpiffCounts(mine, salesperson.id);
  // Needs a month on record (or a manual baseline) to beat — a first month isn't a personal best
  const personalBest = salesperson.priorBestUnits > 0 && units > salesperson.priorBestUnits;

  const vehicleCommission = sum(dealRows.map((r) => r.mini + r.front + r.back));
  const productSpiffs = sum(dealRows.map((r) => r.products));
  const multilingualSpiffs = sum(dealRows.map((r) => r.multilingual));
  const ninetyDaySpiffs = sum(dealRows.map((r) => r.ninetyDay));
  const twoCarDaySpiffs = twoCarDays * settings.twoCarDaySpiff;
  const hatTrickDaySpiffs = hatTrickDays * settings.hatTrickDaySpiff;
  const personalBestSpiff = personalBest ? settings.personalBestSpiff : 0;
  const storeVolumeSpiff = storeVolumeSpiffFor(storeUnits, settings.storeVolumeTiers);
  const adjustmentTotal = sum(adjustments.filter((a) => a.staffId === salesperson.id).map((a) => a.amount));

  return {
    staffId: salesperson.id,
    units,
    miniRate,
    deals: dealRows,
    vehicleCommission: round2(vehicleCommission),
    productSpiffs: round2(productSpiffs),
    multilingualSpiffs: round2(multilingualSpiffs),
    ninetyDaySpiffs: round2(ninetyDaySpiffs),
    twoCarDayCount: twoCarDays,
    twoCarDaySpiffs,
    hatTrickDayCount: hatTrickDays,
    hatTrickDaySpiffs,
    personalBest,
    personalBestSpiff,
    storeVolumeSpiff,
    adjustments: round2(adjustmentTotal),
    total: round2(
      vehicleCommission +
        productSpiffs +
        multilingualSpiffs +
        ninetyDaySpiffs +
        twoCarDaySpiffs +
        hatTrickDaySpiffs +
        personalBestSpiff +
        storeVolumeSpiff +
        adjustmentTotal,
    ),
  };
};

/** Month-end projection: units so far / days elapsed × days in month. */
export const paceFor = (units: number, daysElapsed: number, daysInMonth: number): number =>
  daysElapsed <= 0 ? 0 : round2((units / daysElapsed) * daysInMonth);
