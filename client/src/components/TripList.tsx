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
      <h2 id="trips-title" className="text-display-sm font-bold">
        Поездки
      </h2>

      <div className="mt-4 overflow-hidden rounded-2xl border border-pressed bg-canvas">
        <div
          className="hidden grid-cols-[8.5rem_5.5rem_1fr_7rem_7rem_7.5rem] gap-4 bg-soft px-6 py-3 text-sm font-medium md:grid"
          aria-hidden
        >
          <span>Время</span>
          <span>В пути</span>
          <span>Оплата</span>
          <span className="text-right">Сумма</span>
          <span className="text-right">Комиссия</span>
          <span className="text-right">На руки</span>
        </div>

        <ol className="divide-y divide-pressed">
          {trips.map((t) => {
            const selected = t.id === selectedId;
            return (
              <li
                key={t.id}
                ref={selected ? selectedRef : undefined}
                className={`relative transition-colors ${selected ? "bg-taxi/20" : "hover:bg-softer"}`}
              >
                {selected && <span className="absolute inset-y-0 left-0 w-1 bg-taxi" aria-hidden />}
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-pressed={selected}
                  className="grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-6 py-4 text-left md:grid-cols-[8.5rem_5.5rem_1fr_7rem_7rem_7.5rem] md:items-center"
                >
                  <span className="font-medium">
                    {hhmm(t.start, tzOffsetMinutes)}–{hhmm(t.end, tzOffsetMinutes)}
                  </span>
                  <span className="text-right font-bold md:order-last">{money(t.amount - t.commission)}</span>

                  <span className="text-sm text-body md:order-none md:text-base">
                    {duration(tripMinutes(t.start, t.end))}
                    <span className="md:hidden">
                      {", "}
                      {t.payment === "cash" ? "наличные" : "карта"}
                    </span>
                  </span>
                  <span className="text-right text-sm text-body md:hidden">
                    {money(t.amount)} − {money(t.commission)}
                  </span>

                  <span className="hidden md:block">
                    <PaymentTag payment={t.payment} />
                  </span>
                  <span className="hidden text-right md:block">{money(t.amount)}</span>
                  <span className="hidden text-right text-body md:block">−{money(t.commission)}</span>
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
    <span className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1 text-sm font-medium">
      <span className={`size-2 rounded-full ${cash ? "bg-cash" : "bg-card"}`} aria-hidden />
      {cash ? "Наличные" : "Карта"}
    </span>
  );
}
