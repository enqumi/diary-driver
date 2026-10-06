import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, api, type Payment, type Trip } from "../api";
import { CURRENCY, dayTitle, offsetLabel, shiftDate } from "../format";

interface Props {
  open: boolean;
  date: string;
  tzOffsetMinutes: number;
  dayStartHour: number;
  onClose: () => void;
  onSaved: (trip: Trip, duplicate: boolean) => void;
}

const DEFAULT_COMMISSION_RATE = 0.15;
const MAX_TRIP_HOURS = 12;
const CLOCK_SKEW_MINUTES = 5;

type Errors = Partial<Record<"start" | "end" | "amount" | "commission" | "form", string>>;

function newId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function AddTripDialog({ open, date, tzOffsetMinutes, dayStartHour, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [id, setId] = useState(newId);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [commission, setCommission] = useState("");
  const [commissionTouched, setCommissionTouched] = useState(false);
  const [payment, setPayment] = useState<Payment>("card");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const reset = () => {
    setId(newId());
    setStart("");
    setEnd("");
    setAmount("");
    setCommission("");
    setCommissionTouched(false);
    setPayment("card");
    setErrors({});
  };

  const onAmountChange = (value: string) => {
    setAmount(value);
    if (!commissionTouched) {
      const n = Number(value);
      setCommission(value && Number.isFinite(n) && n > 0 ? String(Math.round(n * DEFAULT_COMMISSION_RATE)) : "");
    }
  };

  const toIso = (day: string, time: string) => `${day}T${time}:00${offsetLabel(tzOffsetMinutes)}`;
  const dayStart = `${String(dayStartHour).padStart(2, "0")}:00`;
  const startDay = start && start < dayStart ? shiftDate(date, 1) : date;
  const endDay = end && start && end < start ? shiftDate(startDay, 1) : startDay;
  const otherDayHint = (day: string) => (day === date ? undefined : `Это уже ${dayTitle(day).dayMonth}`);

  const validate = (): { errors: Errors; trip?: Trip } => {
    const e: Errors = {};
    if (!start) e.start = "Укажите время начала";
    if (!end) e.end = "Укажите время окончания";
    const amountN = Number(amount);
    const commissionN = Number(commission || 0);
    if (!amount || !Number.isInteger(amountN) || amountN <= 0) e.amount = "Сумма — целое число больше нуля";
    if (!Number.isInteger(commissionN) || commissionN < 0) e.commission = "Комиссия — целое число, не меньше нуля";
    else if (!e.amount && commissionN > amountN) e.commission = "Комиссия больше суммы поездки";

    if (e.start || e.end) return { errors: e };
    const startIso = toIso(startDay, start);
    const endIso = toIso(endDay, end);
    if (Date.parse(endIso) <= Date.parse(startIso)) {
      e.end = "Окончание должно быть позже начала";
    } else if (Date.parse(endIso) - Date.parse(startIso) > MAX_TRIP_HOURS * 3_600_000) {
      e.end = `Поездка не может длиться дольше ${MAX_TRIP_HOURS} часов`;
    } else if (Date.parse(endIso) > Date.now() + CLOCK_SKEW_MINUTES * 60_000) {
      e.end = "Нельзя добавить поездку, которая ещё не закончилась";
    }
    if (Object.keys(e).length) return { errors: e };
    return { errors: e, trip: { id, start: startIso, end: endIso, amount: amountN, payment, commission: commissionN } };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const { errors: e, trip } = validate();
    setErrors(e);
    if (!trip) return;

    setSaving(true);
    try {
      const res = await api.addTrip(trip);
      onSaved(res.trip, res.duplicate);
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) {
        const next: Errors = {};
        for (const issue of err.issues) {
          const key = (["start", "end", "amount", "commission"] as const).find((k) => k === issue.field) ?? "form";
          next[key] ??= issue.message;
        }
        setErrors(next);
      } else {
        setErrors({ form: err instanceof Error ? err.message : "Не получилось сохранить поездку" });
      }
    } finally {
      setSaving(false);
    }
  };

  const { weekday, dayMonth } = dayTitle(date);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="add-trip-title"
      className="m-auto w-[min(100%-2rem,30rem)] rounded-2xl bg-surface p-0 text-asphalt shadow-[0_24px_60px_-12px_rgb(27_36_48/0.45)]"
    >
      <div className="checker h-2" aria-hidden />
      <form onSubmit={submit} noValidate className="p-6">
        <h2 id="add-trip-title" className="text-xl font-extrabold tracking-tight">
          Новая поездка
        </h2>
        <p className="mt-1 text-sm text-mute">
          Смена {weekday.toLowerCase()}, {dayMonth}, время по {offsetLabel(tzOffsetMinutes)}. Поездки до {dayStart} следующего утра тоже относятся к этой смене.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label="Начало" error={errors.start} htmlFor="f-start" hint={otherDayHint(startDay)}>
            <input id="f-start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={inputCls(errors.start)} autoFocus />
          </Field>
          <Field label="Окончание" error={errors.end} htmlFor="f-end" hint={otherDayHint(endDay)}>
            <input id="f-end" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls(errors.end)} />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label={`Сумма, ${CURRENCY}`} error={errors.amount} htmlFor="f-amount">
            <input
              id="f-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value.replace(/[^\d]/g, ""))}
              className={inputCls(errors.amount)}
            />
          </Field>
          <Field label={`Комиссия, ${CURRENCY}`} error={errors.commission} htmlFor="f-commission" hint={commissionTouched ? undefined : "15% от суммы"}>
            <input
              id="f-commission"
              inputMode="numeric"
              value={commission}
              onChange={(e) => {
                setCommissionTouched(true);
                setCommission(e.target.value.replace(/[^\d]/g, ""));
              }}
              className={inputCls(errors.commission)}
            />
          </Field>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Оплата</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-paper p-1">
            {(["card", "cash"] as const).map((p) => (
              <label
                key={p}
                className={`cursor-pointer rounded-lg py-2 text-center font-medium transition-colors has-focus-visible:outline-3 has-focus-visible:outline-card ${
                  payment === p ? (p === "cash" ? "bg-cash text-white" : "bg-card text-white") : "text-asphalt-soft hover:text-asphalt"
                }`}
              >
                <input type="radio" name="payment" value={p} checked={payment === p} onChange={() => setPayment(p)} className="sr-only" />
                {p === "cash" ? "Наличные" : "Карта"}
              </label>
            ))}
          </div>
        </fieldset>

        {errors.form && (
          <p role="alert" className="mt-4 rounded-lg bg-fee/10 px-3 py-2 text-sm text-fee">
            {errors.form}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 font-medium text-asphalt-soft hover:bg-paper">
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-asphalt px-5 py-2.5 font-semibold text-taxi transition-opacity disabled:opacity-60"
          >
            {saving ? "Сохраняем…" : "Сохранить поездку"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function inputCls(error?: string) {
  return `mt-1.5 w-full rounded-xl border bg-surface px-3 py-2.5 text-lg font-semibold outline-none transition-colors focus-visible:outline-0 focus:border-asphalt ${
    error ? "border-fee" : "border-line"
  }`;
}

function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-fee">{error}</p>
      ) : (
        hint && <p className="mt-1 text-sm text-mute">{hint}</p>
      )}
    </div>
  );
}
