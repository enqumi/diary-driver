const MINUTE = 60_000;

const moneyFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export const CURRENCY = "₸";

export function money(value: number): string {
  return `${moneyFmt.format(value)} ${CURRENCY}`;
}

export function clock(iso: string, offsetMinutes: number): { h: number; m: number } {
  const d = new Date(Date.parse(iso) + offsetMinutes * MINUTE);
  return { h: d.getUTCHours(), m: d.getUTCMinutes() };
}

export function hhmm(iso: string, offsetMinutes: number): string {
  const { h, m } = clock(iso, offsetMinutes);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minuteOfDay(iso: string, date: string, offsetMinutes: number): number {
  const midnight = Date.parse(`${date}T00:00:00Z`) - offsetMinutes * MINUTE;
  return (Date.parse(iso) - midnight) / MINUTE;
}

export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

export function tripMinutes(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / MINUTE);
}

export function offsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIn(tzOffsetMinutes: number, dayStartHour: number): string {
  return new Date(Date.now() + (tzOffsetMinutes - dayStartHour * 60) * MINUTE).toISOString().slice(0, 10);
}

const weekdayFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" });
const dayMonthFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

export function dayTitle(date: string): { weekday: string; dayMonth: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = weekdayFmt.format(d);
  return { weekday: weekday[0]!.toUpperCase() + weekday.slice(1), dayMonth: dayMonthFmt.format(d) };
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
