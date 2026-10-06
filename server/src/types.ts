export type Payment = "cash" | "card";

export interface Trip {
  id: string;
  start: string;
  end: string;
  amount: number;
  payment: Payment;
  commission: number;
}

export interface PaymentBreakdown {
  trips: number;
  amount: number;
}

export interface DaySummary {
  trips: number;
  revenue: number;
  commission: number;
  net: number;
  cash: PaymentBreakdown;
  card: PaymentBreakdown;
  busyMinutes: number;
  firstStart: string | null;
  lastEnd: string | null;
}
