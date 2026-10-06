import { describe, expect, it } from "vitest";
import { localDate, summarize, workDate } from "../src/summary.js";
import type { Trip } from "../src/types.js";

const t1: Trip = {
  id: "t1",
  start: "2026-10-01T08:10:00+05:00",
  end: "2026-10-01T08:32:00+05:00",
  amount: 2400,
  payment: "card",
  commission: 360,
};
const t2: Trip = {
  id: "t2",
  start: "2026-10-01T09:05:00+05:00",
  end: "2026-10-01T09:20:00+05:00",
  amount: 1500,
  payment: "cash",
  commission: 225,
};

describe("summarize", () => {
  it("считает сводку по примеру из задания", () => {
    expect(summarize([t1, t2])).toEqual({
      trips: 2,
      revenue: 3900,
      commission: 585,
      net: 3315,
      cash: { trips: 1, amount: 1500 },
      card: { trips: 1, amount: 2400 },
      busyMinutes: 22 + 15,
      firstStart: t1.start,
      lastEnd: t2.end,
    });
  });

  it("для пустого дня возвращает нули", () => {
    expect(summarize([])).toEqual({
      trips: 0,
      revenue: 0,
      commission: 0,
      net: 0,
      cash: { trips: 0, amount: 0 },
      card: { trips: 0, amount: 0 },
      busyMinutes: 0,
      firstStart: null,
      lastEnd: null,
    });
  });

  it("не зависит от порядка поездок", () => {
    expect(summarize([t2, t1])).toEqual(summarize([t1, t2]));
  });

  it("наличные и карта в сумме дают выручку", () => {
    const t3: Trip = { ...t1, id: "t3", amount: 999, commission: 0, payment: "cash" };
    const s = summarize([t1, t2, t3]);
    expect(s.cash.amount + s.card.amount).toBe(s.revenue);
    expect(s.cash.trips + s.card.trips).toBe(s.trips);
    expect(s.cash).toEqual({ trips: 2, amount: 2499 });
    expect(s.net).toBe(3315 + 999);
  });

  it("первую и последнюю поездку определяет по моменту, а не по записи времени", () => {
    const early: Trip = { ...t2, id: "e", start: "2026-10-01T02:00:00Z", end: "2026-10-01T02:10:00Z" };
    expect(summarize([t1, early]).firstStart).toBe(early.start);
  });
});

describe("localDate", () => {
  it("относит поездку к дню в поясе водителя", () => {
    expect(localDate("2026-09-30T23:30:00Z", 300)).toBe("2026-10-01");
    expect(localDate("2026-10-01T00:10:00+05:00", 300)).toBe("2026-10-01");
    expect(localDate("2026-10-01T00:10:00+05:00", 0)).toBe("2026-09-30");
  });
});

describe("workDate", () => {
  it("рабочие сутки начинаются в заданный час", () => {
    expect(workDate("2026-10-02T03:59:00+05:00", 300, 4)).toBe("2026-10-01");
    expect(workDate("2026-10-02T04:00:00+05:00", 300, 4)).toBe("2026-10-02");
    expect(workDate("2026-10-01T23:30:00+05:00", 300, 4)).toBe("2026-10-01");
    expect(workDate("2026-10-02T01:00:00+05:00", 300, 0)).toBe("2026-10-02");
  });
});
