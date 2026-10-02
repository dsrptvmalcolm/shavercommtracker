import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/airtable-2026.json";
import {
  dealCommission,
  miniRateFor,
  round2,
  salespersonMonth,
  storeUnitsFor,
  storeVolumeSpiffFor,
} from "./engine";
import type { CommissionSettings, DealInput } from "./types";

// Shaver's Airtable "Current Settings" — never changed during 2026
const settings: CommissionSettings = {
  miniTiers: [
    { startUnits: 1, amount: 200 },
    { startUnits: 15, amount: 225 },
    { startUnits: 23, amount: 250 },
  ],
  frontPct: 0,
  backPct: 0.01,
  productHatTrickBonus: 200,
  twoCarDaySpiff: 100,
  hatTrickDaySpiff: 200,
  multilingualSpiff: 100,
  ninetyDaySpiff: 50,
  personalBestSpiff: 500,
  storeVolumeTiers: [
    { units: 75, amount: 500 },
    { units: 80, amount: 750 },
    { units: 90, amount: 1000 },
    { units: 100, amount: 1500 },
  ],
};

const productRates = fixture.products as Record<string, number>;
const mlEligible = new Set(fixture.multilingualEligible);

// Joey's deals are house deals in the new app; Airtable credited them to him
const toDeal = (d: (typeof fixture.deals)[number], houseAs: string | null = "Joey Golub"): DealInput => ({
  id: d.id,
  saleDate: d.saleDate,
  salespersonId: d.salesperson === houseAs ? null : d.salesperson,
  splitSalespersonId: null,
  isHouse: d.salesperson === houseAs,
  frontGross: null,
  backGross: d.backGross,
  productSpiffs: d.products.map((p) => productRates[p]),
  multilingual: d.multilingual,
  ninetyDay: d.ninetyDay,
});

const monthOf = (date: string) => date.slice(0, 7);

describe("mini tiers", () => {
  it("applies the reached tier to every unit", () => {
    expect(miniRateFor(0, settings.miniTiers)).toBe(200);
    expect(miniRateFor(14.5, settings.miniTiers)).toBe(200);
    expect(miniRateFor(15, settings.miniTiers)).toBe(225);
    expect(miniRateFor(23, settings.miniTiers)).toBe(250);
  });
});

describe("store volume", () => {
  it("pays the highest tier only", () => {
    expect(storeVolumeSpiffFor(74, settings.storeVolumeTiers)).toBe(0);
    expect(storeVolumeSpiffFor(87, settings.storeVolumeTiers)).toBe(750);
    expect(storeVolumeSpiffFor(100, settings.storeVolumeTiers)).toBe(1500);
  });
});

describe("Airtable parity — every deal Jan–Sep 2026", () => {
  const unitsBy = fixture.deals.reduce<Map<string, number>>((m, d) => {
    const k = `${d.salesperson}|${monthOf(d.saleDate)}`;
    return m.set(k, (m.get(k) ?? 0) + 1);
  }, new Map());

  it.each(fixture.deals.map((d) => [d.id, d] as const))("deal %s matches", (_, d) => {
    const rate = miniRateFor(unitsBy.get(`${d.salesperson}|${monthOf(d.saleDate)}`)!, settings.miniTiers);
    const row = dealCommission(toDeal(d, null), 1, rate, mlEligible.has(d.salesperson), settings);
    expect(rate).toBe(d.airtableMini);
    expect(round2(row.total)).toBeCloseTo(d.airtableTotal!, 2);
  });
});

/**
 * Airtable months that are wrong, verified by hand on 2026-10-02:
 * - Khristian: multi-lingual spiffs never rolled into the monthly total
 * - Derrick Jun / Kevin Sep: a 2-car day's Sales Day record was mislinked or unlinked
 * - Personal best: Airtable compared against an unknown pre-2026 baseline
 */
const KNOWN_DIFFS: Record<string, number> = {
  "Khristian Ayala|2026-02": 200,
  "Khristian Ayala|2026-03": 300,
  "Khristian Ayala|2026-04": 300,
  "Khristian Ayala|2026-05": 300,
  "Khristian Ayala|2026-07": 200,
  "Khristian Ayala|2026-08": 300,
  "Khristian Ayala|2026-09": 200,
  "Derrick Kong|2026-06": 100,
  "Kevin Loughney|2026-09": 100,
};

describe("Airtable parity — monthly totals", () => {
  const deals = fixture.deals.map((d) => toDeal(d));
  const months = fixture.months.filter((m) => m.salesperson !== "Joey Golub");

  it.each(months.map((m) => [`${m.salesperson}|${m.month}`, m] as const))("%s", (key, m) => {
    const monthDeals = deals.filter((d) => monthOf(d.saleDate) === m.month);
    const summary = salespersonMonth({
      salesperson: {
        id: m.salesperson,
        multilingualEligible: mlEligible.has(m.salesperson),
        // Use Airtable's own personal-best decision so this test isolates the other math
        priorBestUnits: m.personalBestSpiff! > 0 ? m.units - 1 : Number.POSITIVE_INFINITY,
      },
      deals: monthDeals,
      storeUnits: storeUnitsFor(monthDeals),
      adjustments: [],
      settings,
    });
    expect(summary.units).toBe(m.units);
    expect(summary.vehicleCommission).toBeCloseTo(m.vehicleCommission!, 1);
    expect(summary.productSpiffs).toBeCloseTo(m.productSpiffs!, 2);
    expect(summary.storeVolumeSpiff).toBe(m.storeVolumeSpiff);
    expect(summary.total).toBeCloseTo(m.total! + (KNOWN_DIFFS[key] ?? 0), 1);
  });
});

describe("split deals", () => {
  const base: DealInput = {
    id: "s1",
    saleDate: "2026-10-01",
    salespersonId: "a",
    splitSalespersonId: "b",
    isHouse: false,
    frontGross: null,
    backGross: 1000,
    productSpiffs: [25, 25, 50],
    multilingual: true,
    ninetyDay: true,
  };
  const person = (id: string, ml = false) => ({ id, multilingualEligible: ml, priorBestUnits: 99 });
  const run = (id: string, deals: DealInput[], ml = false) =>
    salespersonMonth({ salesperson: person(id, ml), deals, storeUnits: deals.length, adjustments: [], settings });

  it("halves units, mini and spiffs for each person", () => {
    const a = run("a", [base], true);
    const b = run("b", [base]);
    expect(a.units).toBe(0.5);
    expect(b.units).toBe(0.5);
    // 0.5 × (200 mini + 10 back + 200 product hat trick + 100 multi-lingual + 50 aged)
    expect(a.total).toBe(280);
    // b isn't multi-lingual eligible
    expect(b.total).toBe(230);
  });

  it("doesn't count half deals toward a 2-car day", () => {
    const full: DealInput = { ...base, id: "f1", splitSalespersonId: null };
    expect(run("a", [base, full]).twoCarDayCount).toBe(0);
    expect(run("a", [full, { ...full, id: "f2" }]).twoCarDayCount).toBe(1);
  });

  it("pays only the hat trick for 4+ cars in a day", () => {
    const full: DealInput = { ...base, splitSalespersonId: null };
    const four = ["1", "2", "3", "4"].map((id) => ({ ...full, id }));
    const s = run("a", four);
    expect(s.hatTrickDayCount).toBe(1);
    expect(s.twoCarDayCount).toBe(0);
  });
});

describe("house deals and personal best", () => {
  it("house deals count to the store only", () => {
    const house: DealInput = {
      id: "h",
      saleDate: "2026-10-01",
      salespersonId: null,
      splitSalespersonId: null,
      isHouse: true,
      frontGross: null,
      backGross: 500,
      productSpiffs: [],
      multilingual: false,
      ninetyDay: false,
    };
    const s = salespersonMonth({
      salesperson: { id: "a", multilingualEligible: false, priorBestUnits: 99 },
      deals: [house],
      storeUnits: 75,
      adjustments: [],
      settings,
    });
    expect(s.units).toBe(0);
    // store volume still paid with zero units
    expect(s.total).toBe(500);
  });

  it("ties don't count as a personal best", () => {
    const deal = (id: string): DealInput => ({
      id,
      saleDate: "2026-10-01",
      salespersonId: "a",
      splitSalespersonId: null,
      isHouse: false,
      frontGross: null,
      backGross: null,
      productSpiffs: [],
      multilingual: false,
      ninetyDay: false,
    });
    const run = (best: number) =>
      salespersonMonth({
        salesperson: { id: "a", multilingualEligible: false, priorBestUnits: best },
        deals: [deal("1"), deal("2")],
        storeUnits: 2,
        adjustments: [],
        settings,
      }).personalBest;
    expect(run(2)).toBe(false);
    expect(run(1)).toBe(true);
    // first month on record
    expect(run(0)).toBe(false);
  });
});
