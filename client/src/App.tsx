import { useCallback, useEffect, useRef, useState } from "react";
import { api, type DayResponse, type DaysResponse, type Trip } from "./api";
import { AddTripDialog } from "./components/AddTripDialog";
import { DaySwitcher } from "./components/DaySwitcher";
import { ShiftTimeline } from "./components/ShiftTimeline";
import { SummaryPanel } from "./components/SummaryPanel";
import { TripList } from "./components/TripList";
import { dayTitle, hhmm, money, shiftDate, todayIn } from "./format";

const DEFAULT_OFFSET = 300;
const DEFAULT_DAY_START_HOUR = 4;

function dateFromUrl(): string | null {
  const d = new URLSearchParams(location.search).get("date");
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export default function App() {
  const [days, setDays] = useState<DaysResponse | null>(null);
  const [date, setDate] = useState<string | null>(dateFromUrl);
  const [day, setDay] = useState<DayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const request = useRef(0);

  const offset = days?.tzOffsetMinutes ?? DEFAULT_OFFSET;
  const dayStartHour = days?.dayStartHour ?? DEFAULT_DAY_START_HOUR;
  const today = todayIn(offset, dayStartHour);

  const loadDays = useCallback(async () => {
    try {
      const res = await api.days();
      setDays(res);
      const resToday = todayIn(res.tzOffsetMinutes, res.dayStartHour);
      setDate((current) => current ?? (res.days.some((d) => d.date === resToday) ? resToday : (res.days.at(-1)?.date ?? resToday)));
    } catch (err) {
      setError((err as Error).message);
      setDate((current) => current ?? todayIn(DEFAULT_OFFSET, DEFAULT_DAY_START_HOUR));
    }
  }, []);

  const loadDay = useCallback(async (d: string) => {
    const id = ++request.current;
    setError(null);
    try {
      const res = await api.day(d);
      if (id === request.current) setDay(res);
    } catch (err) {
      if (id === request.current) setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  useEffect(() => {
    if (date && date > today) setDate(today);
  }, [date, today]);

  useEffect(() => {
    if (!date || date > today) return;
    void loadDay(date);
    setSelectedId(null);
    const url = new URL(location.href);
    url.searchParams.set("date", date);
    history.replaceState(null, "", url);
  }, [date, loadDay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") setDate((d) => d && shiftDate(d, -1));
      else if (e.key === "ArrowRight") setDate((d) => (d && d < today ? shiftDate(d, 1) : d));
      else if (e.key === "n" || e.key === "т") {
        e.preventDefault();
        setDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, today]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const onSaved = (trip: Trip, duplicate: boolean) => {
    setDialogOpen(false);
    const when = `${hhmm(trip.start, offset)}–${hhmm(trip.end, offset)}`;
    setToast({
      key: Date.now(),
      text: duplicate ? `Поездка ${when} уже была записана, дубль не создан` : `Поездка ${when} на ${money(trip.amount)} добавлена`,
    });
    setSelectedId(trip.id);
    void loadDays();
    if (date) void loadDay(date).then(() => setSelectedId(trip.id));
  };

  const shownDay = day && day.date === date ? day : null;
  const prevShift = date ? days?.days.filter((d) => d.date < date).at(-1) : undefined;
  const nextShift = date ? days?.days.find((d) => d.date > date) : undefined;

  return (
    <>
      <nav className="sticky top-0 z-20 bg-canvas">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Logo />
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={!date}
            title="Добавить поездку (N)"
            className="flex items-center gap-2 rounded-full bg-taxi py-3 pr-5 pl-4 font-medium text-ink transition-colors hover:bg-taxi-deep active:scale-[0.98] disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="sm:hidden">Поездка</span>
            <span className="hidden sm:inline">Добавить поездку</span>
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
        {date && (
          <main className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-6">
            <DaySwitcher date={date} today={today} days={days?.days ?? []} onChange={setDate} />

            {error && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-soft p-6">
                <span className="flex items-center gap-3 font-medium">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-taxi font-bold text-ink" aria-hidden>
                    !
                  </span>
                  {error}
                </span>
                <button type="button" onClick={() => { void loadDays(); void loadDay(date); }} className="rounded-full bg-ink px-4 py-3 font-medium text-white hover:bg-elevated">
                  Повторить
                </button>
              </div>
            )}

            {shownDay ? (
              <>
                <SummaryPanel summary={shownDay.summary} tzOffsetMinutes={shownDay.tzOffsetMinutes} />
                {shownDay.trips.length > 0 ? (
                  <>
                    <ShiftTimeline
                      date={shownDay.date}
                      trips={shownDay.trips}
                      tzOffsetMinutes={shownDay.tzOffsetMinutes}
                      selectedId={selectedId}
                      onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                    />
                    <TripList
                      trips={shownDay.trips}
                      tzOffsetMinutes={shownDay.tzOffsetMinutes}
                      selectedId={selectedId}
                      onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                    />
                  </>
                ) : (
                  <EmptyDay
                    onAdd={() => setDialogOpen(true)}
                    prev={prevShift?.date}
                    next={nextShift?.date}
                    onGo={setDate}
                  />
                )}
              </>
            ) : (
              !error && <Skeleton />
            )}
          </main>
        )}
      </div>

      <footer className="bg-ink text-white">
        <div className="checker h-4" aria-hidden />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-8 sm:px-8">
          <Logo />
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute">
            <li>
              <Kbd>←</Kbd> <Kbd>→</Kbd> соседний день
            </li>
            <li>
              <Kbd>N</Kbd> новая поездка
            </li>
          </ul>
        </div>
      </footer>

      {date && (
        <AddTripDialog
          open={dialogOpen}
          date={date}
          tzOffsetMinutes={offset}
          dayStartHour={dayStartHour}
          onClose={() => setDialogOpen(false)}
          onSaved={onSaved}
        />
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
        {toast && (
          <p key={toast.key} className="rise pointer-events-auto flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3 text-sm font-medium shadow-card">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-taxi text-ink" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            {toast.text}
          </p>
        )}
      </div>
    </>
  );
}

function Logo() {
  return (
    <p className="text-display-sm font-bold">
      Дневник смен
    </p>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-grid min-w-7 place-items-center rounded-full bg-elevated px-2 py-0.5 font-sans font-medium text-taxi">{children}</kbd>;
}

function EmptyDay({ onAdd, prev, next, onGo }: { onAdd: () => void; prev?: string; next?: string; onGo: (d: string) => void }) {
  const label = (d: string) => {
    const { weekday, dayMonth } = dayTitle(d);
    return `${weekday.toLowerCase()}, ${dayMonth}`;
  };
  return (
    <section className="rounded-2xl bg-soft px-6 py-10 sm:px-8 sm:py-12">
      <h2 className="text-display-md font-bold">В этот день вы не выходили на линию</h2>
      <p className="mt-2 max-w-prose text-body">Если поездки были, добавьте их, и сводка пересчитается.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={onAdd} className="rounded-full bg-taxi px-5 py-3 font-medium text-ink hover:bg-taxi-deep">
          Добавить поездку
        </button>
        {prev && (
          <button type="button" onClick={() => onGo(prev)} className="rounded-full bg-canvas px-5 py-3 font-medium hover:bg-pressed">
            Прошлая смена: {label(prev)}
          </button>
        )}
        {next && (
          <button type="button" onClick={() => onGo(next)} className="rounded-full bg-canvas px-5 py-3 font-medium hover:bg-pressed">
            Следующая смена: {label(next)}
          </button>
        )}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:gap-6" aria-busy aria-label="Загрузка">
      <div className="h-56 animate-pulse rounded-2xl bg-soft" />
      <div className="h-40 animate-pulse rounded-2xl bg-softer" />
    </div>
  );
}
