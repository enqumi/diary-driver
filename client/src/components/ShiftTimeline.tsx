import type { Trip } from "../api";
import { hhmm, minuteOfDay, money } from "../format";

interface Props {
  date: string;
  trips: Trip[];
  tzOffsetMinutes: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MIN_SPAN_HOURS = 8;

export function ShiftTimeline({ date, trips, tzOffsetMinutes, selectedId, onSelect }: Props) {
  if (trips.length === 0) return null;

  const laneEnds: number[] = [];
  const spans = trips
    .map((t) => ({
      trip: t,
      from: minuteOfDay(t.start, date, tzOffsetMinutes),
      to: minuteOfDay(t.end, date, tzOffsetMinutes),
    }))
    .sort((a, b) => a.from - b.from || b.to - a.to)
    .map((span) => {
      let lane = laneEnds.findIndex((end) => end <= span.from);
      if (lane === -1) lane = laneEnds.push(span.to) - 1;
      else laneEnds[lane] = span.to;
      return { ...span, lane };
    });
  const lanes = laneEnds.length;

  let startHour = Math.floor(Math.min(...spans.map((s) => s.from)) / 60);
  let endHour = Math.ceil(Math.max(...spans.map((s) => s.to)) / 60);
  if (endHour - startHour < MIN_SPAN_HOURS) {
    const pad = MIN_SPAN_HOURS - (endHour - startHour);
    startHour = Math.max(0, startHour - Math.floor(pad / 2));
    endHour = startHour + Math.max(MIN_SPAN_HOURS, endHour - startHour);
  }
  const total = (endHour - startHour) * 60;
  const pct = (minute: number) => ((minute - startHour * 60) / total) * 100;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const labelEvery = hours.length > 13 ? 3 : hours.length > 9 ? 2 : 1;

  return (
    <section aria-labelledby="timeline-title" className="rounded-2xl bg-soft p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="timeline-title" className="text-display-sm font-bold">
          Лента смены
        </h2>
        <p className="flex gap-4 text-sm text-body">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-cash" aria-hidden />
            наличные
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-card" aria-hidden />
            карта
          </span>
        </p>
      </div>

      <div className="relative mt-6" style={{ height: `${Math.max(80, 24 + lanes * 30)}px` }}>
        {hours.map((h, i) => (
          <div key={h} className="absolute inset-y-0 border-l border-pressed" style={{ left: `${pct(h * 60)}%` }} aria-hidden>
            {i % labelEvery === 0 && (
              <span className="absolute top-full mt-2 -translate-x-1/2 text-xs text-body">{String(h % 24).padStart(2, "0")}</span>
            )}
          </div>
        ))}

        <div className="absolute inset-x-0 top-1/2 h-px bg-pressed" aria-hidden />

        <ol className="absolute inset-x-0 top-3 bottom-3">
          {spans.map(({ trip, from, to, lane }, i) => {
            const selected = trip.id === selectedId;
            const label = `${hhmm(trip.start, tzOffsetMinutes)}–${hhmm(trip.end, tzOffsetMinutes)}, ${money(trip.amount)}, ${trip.payment === "cash" ? "наличные" : "карта"}`;
            return (
              <li key={trip.id} className="contents">
                <button
                  type="button"
                  onClick={() => onSelect(trip.id)}
                  aria-label={label}
                  aria-pressed={selected}
                  title={label}
                  className={`rise absolute min-w-1.5 rounded-md transition-[filter,box-shadow] hover:brightness-125 ${
                    trip.payment === "cash" ? "bg-cash" : "bg-card"
                  } ${selected ? "z-10 shadow-[0_0_0_2px_var(--color-soft),0_0_0_4px_var(--color-ink)]" : ""}`}
                  style={{
                    left: `${pct(from)}%`,
                    width: `${pct(to) - pct(from)}%`,
                    top: `calc(${(lane / lanes) * 100}% + ${lane > 0 ? 2 : 0}px)`,
                    height: `calc(${100 / lanes}% - ${lanes > 1 ? 2 : 0}px)`,
                    animationDelay: `${i * 25}ms`,
                  }}
                />
              </li>
            );
          })}
        </ol>
      </div>
      <div className="h-6" aria-hidden />
    </section>
  );
}
