import { useEffect, useRef } from "react";
import type { Trip } from "../api";
import { duration, hhmm, money, tripMinutes } from "../format";

interface Props {
  trips: Trip[];
  tzOffsetMinutes: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TripList({ trips, tzOffsetMinutes, selectedId, onSelect }: Props) {
  const selectedRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <section aria-labelledby="trips-title">
      <h2 id="trips-title" className="text-lg font-semibold">
        Поездки
      </h2>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
        <div
          className="hidden grid-cols-[8.5rem_5.5rem_1fr_7rem_7rem_7.5rem] gap-4 border-b border-line px-5 py-2.5 text-sm text-mute md:grid"
          aria-hidden
        >
          <span>Время</span>
          <span>В пути</span>
          <span>Оплата</span>
          <span className="text-right">Сумма</span>
          <span className="text-right">Комиссия</span>
          <span className="text-right">На руки</span>
        </div>

        <ol className="divide-y divide-line">
          {trips.map((t) => {
            const selected = t.id === selectedId;
            return (
              <li
                key={t.id}
                ref={selected ? selectedRef : undefined}
                className={`relative transition-colors ${selected ? "bg-taxi/25" : "hover:bg-paper/70"}`}
              >
                {selected && <span className="absolute inset-y-0 left-0 w-1 bg-taxi" aria-hidden />}
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-pressed={selected}
                  className="grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3.5 text-left md:grid-cols-[8.5rem_5.5rem_1fr_7rem_7rem_7.5rem] md:items-center"
                >
                  <span className="font-semibold">
                    {hhmm(t.start, tzOffsetMinutes)}–{hhmm(t.end, tzOffsetMinutes)}
                  </span>
                  <span className="text-right font-semibold md:order-last">{money(t.amount - t.commission)}</span>

                  <span className="text-sm text-mute md:order-none md:text-base md:text-asphalt-soft">
                    {duration(tripMinutes(t.start, t.end))}
                    <span className="md:hidden">
                      {", "}
                      {t.payment === "cash" ? "наличные" : "карта"}
                    </span>
                  </span>
                  <span className="text-right text-sm text-mute md:hidden">
                    {money(t.amount)} − {money(t.commission)}
                  </span>

                  <span className="hidden md:block">
                    <PaymentTag payment={t.payment} />
                  </span>
                  <span className="hidden text-right md:block">{money(t.amount)}</span>
                  <span className="hidden text-right text-fee md:block">−{money(t.commission)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function PaymentTag({ payment }: { payment: Trip["payment"] }) {
  const cash = payment === "cash";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium ${
        cash ? "bg-cash/10 text-cash" : "bg-card/10 text-card"
      }`}
    >
      <span className={`size-2 rounded-sm ${cash ? "bg-cash" : "bg-card"}`} aria-hidden />
      {cash ? "Наличные" : "Карта"}
    </span>
  );
}
