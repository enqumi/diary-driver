import type { DaySummary } from "../api";
import { duration, hhmm, money, plural } from "../format";

interface Props {
  summary: DaySummary;
  tzOffsetMinutes: number;
}

export function SummaryPanel({ summary: s, tzOffsetMinutes }: Props) {
  const cashShare = s.revenue > 0 ? (s.cash.amount / s.revenue) * 100 : 0;

  return (
    <section aria-label="Сводка за день" className="grid gap-px overflow-hidden rounded-2xl bg-line sm:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col justify-between gap-6 bg-taxi p-5 sm:p-7">
        <p className="text-base font-medium">На руки</p>
        <div>
          <p className="text-[2.75rem] leading-none font-extrabold tracking-[-0.04em] sm:text-[3.75rem]">{money(s.net)}</p>
          <p className="mt-2 text-sm text-asphalt/75">
            {s.trips === 0
              ? "Поездок в этот день нет"
              : `${s.trips} ${plural(s.trips, "поездка", "поездки", "поездок")}, ${duration(s.busyMinutes)} с пассажирами`}
            {s.firstStart && s.lastEnd && (
              <>
                <br />
                смена {hhmm(s.firstStart, tzOffsetMinutes)}–{hhmm(s.lastEnd, tzOffsetMinutes)}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid bg-surface">
        <dl className="grid grid-cols-2 divide-x divide-line border-b border-line">
          <div className="p-5">
            <dt className="text-sm text-mute">Выручка</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight">{money(s.revenue)}</dd>
          </div>
          <div className="p-5">
            <dt className="text-sm text-mute">Комиссия</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-fee">
              {s.commission > 0 ? "−" : ""}
              {money(s.commission)}
            </dd>
          </div>
        </dl>

        <div className="p-5">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-paper" role="img" aria-label={`Наличные ${Math.round(cashShare)}%, карта ${Math.round(100 - cashShare)}%`}>
            {s.revenue > 0 && (
              <>
                <div key={`c${s.cash.amount}`} className="grow-x bg-cash" style={{ width: `${cashShare}%` }} />
                <div key={`k${s.card.amount}`} className="grow-x bg-card" style={{ width: `${100 - cashShare}%` }} />
              </>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <PaymentLine color="bg-cash" label="Наличные" amount={s.cash.amount} trips={s.cash.trips} />
            <PaymentLine color="bg-card" label="Карта" amount={s.card.amount} trips={s.card.trips} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function PaymentLine({ color, label, amount, trips }: { color: string; label: string; amount: number; trips: number }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-mute">
        <span className={`size-2.5 rounded-sm ${color}`} aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-semibold">{money(amount)}</dd>
      <dd className="text-mute">
        {trips} {plural(trips, "поездка", "поездки", "поездок")}
      </dd>
    </div>
  );
}
