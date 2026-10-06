import type { DaySummary } from "../api";
import { duration, hhmm, money, plural } from "../format";

interface Props {
  summary: DaySummary;
  tzOffsetMinutes: number;
}

export function SummaryPanel({ summary: s, tzOffsetMinutes }: Props) {
  const cashShare = s.revenue > 0 ? (s.cash.amount / s.revenue) * 100 : 0;

  return (
    <section aria-label="Сводка за день" className="grid gap-4 sm:gap-6 md:grid-cols-[1.25fr_1fr]">
      <div className="relative flex flex-col justify-between gap-10 overflow-hidden rounded-2xl bg-taxi p-6 text-ink sm:p-8">
        <span className="checker absolute top-0 right-0 h-8 w-32 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
        <p className="text-lg font-medium">На руки</p>
        <div>
          <p className="text-[2.5rem] leading-none font-bold sm:text-display-xxl">{money(s.net)}</p>
          <p className="mt-3 text-ink/70">
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

      <div className="flex flex-col justify-between gap-6 rounded-2xl bg-soft p-6 sm:p-8">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-body">Выручка</dt>
            <dd className="mt-1 text-display-md font-bold">{money(s.revenue)}</dd>
          </div>
          <div>
            <dt className="text-sm text-body">Комиссия</dt>
            <dd className="mt-1 text-display-md font-bold">
              {s.commission > 0 ? "−" : ""}
              {money(s.commission)}
            </dd>
          </div>
        </dl>

        <div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`Наличные ${Math.round(cashShare)}%, карта ${Math.round(100 - cashShare)}%`}>
            {s.revenue > 0 && (
              <>
                {s.cash.amount > 0 && <div key={`c${s.cash.amount}`} className="grow-x rounded-full bg-cash" style={{ width: `${cashShare}%` }} />}
                {s.card.amount > 0 && <div key={`k${s.card.amount}`} className="grow-x flex-1 rounded-full bg-card" />}
              </>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
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
      <dt className="flex items-center gap-2 text-body">
        <span className={`size-2.5 rounded-full ${color}`} aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 text-base font-medium">{money(amount)}</dd>
      <dd className="text-body">
        {trips} {plural(trips, "поездка", "поездки", "поездок")}
      </dd>
    </div>
  );
}
