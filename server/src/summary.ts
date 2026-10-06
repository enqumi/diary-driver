import type { DaySummary, Trip } from "./types.js";

const MINUTE = 60_000;

export function summarize(trips: readonly Trip[]): DaySummary {
  const summary: DaySummary = {
    trips: 0,
    revenue: 0,
    commission: 0,
    net: 0,
    cash: { trips: 0, amount: 0 },
    card: { trips: 0, amount: 0 },
    busyMinutes: 0,
    firstStart: null,
    lastEnd: null,
  };

  let first = Infinity;
  let last = -Infinity;

  for (const trip of trips) {
    const start = Date.parse(trip.start);
    const end = Date.parse(trip.end);

    summary.trips += 1;
    summary.revenue += trip.amount;
    summary.commission += trip.commission;
    summary[trip.payment].trips += 1;
    summary[trip.payment].amount += trip.amount;
    summary.busyMinutes += Math.round((end - start) / MINUTE);

    if (start < first) {
      first = start;
      summary.firstStart = trip.start;
    }
    if (end > last) {
      last = end;
      summary.lastEnd = trip.end;
    }
  }

  summary.net = summary.revenue - summary.commission;
  return summary;
}

export function localDate(iso: string, offsetMinutes: number): string {
  return new Date(Date.parse(iso) + offsetMinutes * MINUTE).toISOString().slice(0, 10);
}

export function workDate(iso: string, tzOffsetMinutes: number, dayStartHour: number): string {
  return localDate(iso, tzOffsetMinutes - dayStartHour * 60);
}
