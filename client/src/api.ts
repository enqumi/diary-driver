export type Payment = "cash" | "card";

export interface Trip {
  id: string;
  start: string;
  end: string;
  amount: number;
  payment: Payment;
  commission: number;
}

export interface DaySummary {
  trips: number;
  revenue: number;
  commission: number;
  net: number;
  cash: { trips: number; amount: number };
  card: { trips: number; amount: number };
  busyMinutes: number;
  firstStart: string | null;
  lastEnd: string | null;
}

export interface DayResponse {
  date: string;
  tzOffsetMinutes: number;
  dayStartHour: number;
  summary: DaySummary;
  trips: Trip[];
}

export interface DaysResponse {
  tzOffsetMinutes: number;
  dayStartHour: number;
  days: { date: string; trips: number }[];
}

export interface Issue {
  field: string | null;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: Issue[] = [],
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте, что он запущен, и попробуйте снова.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? `Сервер ответил ошибкой ${res.status}`, body?.issues ?? []);
  }
  return body as T;
}

export const api = {
  days: () => call<DaysResponse>("/api/days"),
  day: (date: string) => call<DayResponse>(`/api/days/${date}`),
  addTrip: (trip: Trip) =>
    call<{ trip: Trip; duplicate: boolean }>("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    }),
};
