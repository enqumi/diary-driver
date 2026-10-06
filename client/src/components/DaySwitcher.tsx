import { useEffect, useRef } from "react";
import { dayTitle, shiftDate } from "../format";

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
    <div>
      <div className="flex items-center gap-2 sm:gap-3">
        <ArrowButton label="Предыдущий день" onClick={() => onChange(shiftDate(date, -1))} dir="left" />

        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={openPicker}
            className="group block w-full rounded-lg px-1 text-left"
            aria-label={`${weekday}, ${dayMonth}. Выбрать другую дату`}
          >
            <span className="block text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
              {weekday}
            </span>
            <span className="block text-lg text-asphalt-soft group-hover:text-asphalt">
              {dayMonth}
              {date === today && <span className="ml-2 rounded-full bg-asphalt px-2 py-0.5 text-sm text-taxi">сегодня</span>}
            </span>
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

        <ArrowButton label="Следующий день" onClick={() => onChange(shiftDate(date, 1))} dir="right" disabled={date >= today} />
      </div>

      {days.length > 0 && (
        <nav aria-label="Дни со сменами" className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <ul className="flex gap-1.5">
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
                    className={`flex min-w-[4.5rem] flex-col items-start rounded-lg border px-3 py-1.5 text-left transition-colors ${
                      active
                        ? "border-asphalt bg-asphalt text-white"
                        : "border-line bg-surface text-asphalt hover:border-asphalt-soft"
                    }`}
                  >
                    <span className={`text-xs ${active ? "text-taxi" : "text-mute"}`}>{chipWeekdayFmt.format(at)}</span>
                    <span className="text-sm font-semibold whitespace-nowrap">{chipFmt.format(at).replace(".", "")}</span>
                    <span className={`text-xs whitespace-nowrap ${active ? "text-white/70" : "text-mute"}`}>{d.trips} поезд.</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
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
      className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-asphalt transition-colors enabled:hover:border-asphalt enabled:hover:bg-asphalt enabled:hover:text-taxi disabled:opacity-35"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}
