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
      <div className="checker h-3" aria-hidden />
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-24 sm:px-6 sm:pt-8">
        <header className="flex items-center justify-between gap-4">
          <p className="font-semibold text-asphalt-soft">Дневник смен</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={!date}
            title="Добавить поездку (N)"
            className="flex items-center gap-2 rounded-xl bg-asphalt px-4 py-2.5 font-semibold text-taxi transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Добавить поездку
          </button>
        </header>

        {date && (
          <main className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6">
            <DaySwitcher date={date} today={today} days={days?.days ?? []} onChange={setDate} />

            {error && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fee/30 bg-fee/5 px-5 py-4 text-fee">
                <span>{error}</span>
                <button type="button" onClick={() => { void loadDays(); void loadDay(date); }} className="rounded-lg border border-fee/40 px-3 py-1.5 text-sm font-semibold hover:bg-fee/10">
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

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 flex justify-center px-4">
        {toast && (
          <p key={toast.key} className="rise pointer-events-auto rounded-xl bg-asphalt px-4 py-3 text-white shadow-lg">
            <span className="mr-2 inline-block size-2.5 rounded-sm bg-taxi align-middle" aria-hidden />
            {toast.text}
          </p>
        )}
      </div>
    </>
  );
}

function EmptyDay({ onAdd, prev, next, onGo }: { onAdd: () => void; prev?: string; next?: string; onGo: (d: string) => void }) {
  const label = (d: string) => {
    const { weekday, dayMonth } = dayTitle(d);
    return `${weekday.toLowerCase()}, ${dayMonth}`;
  };
  return (
    <section className="rounded-2xl border border-dashed border-asphalt-soft/40 px-6 py-10">
      <h2 className="text-xl font-semibold">В этот день вы не выходили на линию</h2>
      <p className="mt-2 max-w-prose text-asphalt-soft">Если поездки были, добавьте их, и сводка пересчитается.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onAdd} className="rounded-xl bg-asphalt px-4 py-2.5 font-semibold text-taxi">
          Добавить поездку
        </button>
        {prev && (
          <button type="button" onClick={() => onGo(prev)} className="rounded-xl border border-line bg-surface px-4 py-2.5 font-medium hover:border-asphalt">
            Прошлая смена: {label(prev)}
          </button>
        )}
        {next && (
          <button type="button" onClick={() => onGo(next)} className="rounded-xl border border-line bg-surface px-4 py-2.5 font-medium hover:border-asphalt">
            Следующая смена: {label(next)}
          </button>
        )}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-6" aria-busy aria-label="Загрузка">
      <div className="h-52 animate-pulse rounded-2xl bg-line/70" />
      <div className="h-36 animate-pulse rounded-2xl bg-line/50" />
    </div>
  );
}
