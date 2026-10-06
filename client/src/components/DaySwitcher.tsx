import { useEffect, useRef } from "react";
import { dayTitle, plural, shiftDate } from "../format";

interface Props {
  date: string;
  today: string;
  days: { date: string; trips: number }[];
  onChange: (date: string) => void;
}

const chipFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
const chipWeekdayFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" });

export function DaySwitcher({ date, today, days, onChange }: Props) {
  const { weekday, dayMonth } = dayTitle(date);
  const pickerRef = useRef<HTMLInputElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [date]);

  const openPicker = () => {
    const input = pickerRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  return (
    <section className="pb-2">
      <div className="flex items-end justify-between gap-4">
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={openPicker}
            className="group block max-w-full rounded-2xl text-left"
            aria-label={`${weekday}, ${dayMonth}. Выбрать другую дату`}
          >
            <span className="flex items-center gap-2 text-lg font-medium text-body group-hover:text-ink">
              {dayMonth}
              {date === today && <span className="rounded-full bg-taxi px-3 py-0.5 text-sm font-medium text-ink">сегодня</span>}
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
            <span className="mt-1 block truncate text-display-lg font-bold sm:text-display-xxl">{weekday}</span>
          </button>
          <input
            ref={pickerRef}
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && e.target.value <= today && onChange(e.target.value)}
            className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
            tabIndex={-1}
            aria-hidden
          />
        </div>

        <div className="flex shrink-0 gap-2 pb-1 sm:pb-2">
          <ArrowButton label="Предыдущий день" onClick={() => onChange(shiftDate(date, -1))} dir="left" />
          <ArrowButton label="Следующий день" onClick={() => onChange(shiftDate(date, 1))} dir="right" disabled={date >= today} />
        </div>
      </div>

      {days.length > 0 && (
        <nav aria-label="Дни со сменами" className="-mx-4 mt-6 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-8 sm:px-8">
          <ul className="flex gap-2">
            {days.map((d) => {
              const active = d.date === date;
              const at = new Date(`${d.date}T00:00:00Z`);
              return (
                <li key={d.date}>
                  <button
                    ref={active ? activeChipRef : undefined}
                    type="button"
                    onClick={() => onChange(d.date)}
                    aria-current={active ? "date" : undefined}
                    className={`flex h-11 items-center gap-2 rounded-full pr-2 pl-4 text-sm font-medium whitespace-nowrap transition-colors ${
                      active ? "bg-ink text-white" : "bg-soft text-ink hover:bg-pressed"
                    }`}
                  >
                    <span className={active ? "text-mute" : "text-body"}>{chipWeekdayFmt.format(at)}</span>
                    {chipFmt.format(at).replace(".", "")}
                    <span
                      className={`grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs ${active ? "bg-taxi text-ink" : "bg-canvas text-ink"}`}
                      title={`${d.trips} ${plural(d.trips, "поездка", "поездки", "поездок")}`}
                    >
                      {d.trips}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </section>
  );
}

function ArrowButton({ label, onClick, dir, disabled }: { label: string; onClick: () => void; dir: "left" | "right"; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={`${label} (${dir === "left" ? "←" : "→"})`}
      className="grid size-12 shrink-0 place-items-center rounded-full bg-soft text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-taxi disabled:opacity-35"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}
