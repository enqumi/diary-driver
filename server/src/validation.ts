import { z } from "zod";

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const timestamp = (label: string) =>
  z
    .string({ error: `${label}: нужна строка с датой и временем` })
    .regex(ISO_WITH_OFFSET, `${label}: формат 2026-10-01T08:10:00+05:00`)
    .refine((s) => !Number.isNaN(Date.parse(s)), `${label}: такой даты не существует`);

const money = (label: string) =>
  z
    .number({ error: `${label}: нужно число` })
    .int(`${label}: целое число тенге`)
    .max(10_000_000, `${label}: слишком большая сумма`);

export const MAX_TRIP_HOURS = 12;

export const CLOCK_SKEW_MINUTES = 5;

export interface TripRules {
  now: () => number;
}

export const makeTripInputSchema = ({ now }: TripRules) =>
  z
    .object({
      id: z.string().trim().min(1).max(100).optional(),
      start: timestamp("Начало"),
      end: timestamp("Окончание"),
      amount: money("Сумма").positive("Сумма должна быть больше нуля"),
      payment: z.enum(["cash", "card"], { error: "Способ оплаты: cash или card" }),
      commission: money("Комиссия").nonnegative("Комиссия не может быть отрицательной"),
    })
    .superRefine((t, ctx) => {
      const length = Date.parse(t.end) - Date.parse(t.start);
      if (length <= 0) {
        ctx.addIssue({ code: "custom", path: ["end"], message: "Окончание должно быть позже начала" });
      } else if (length > MAX_TRIP_HOURS * 3_600_000) {
        ctx.addIssue({ code: "custom", path: ["end"], message: `Поездка не может длиться дольше ${MAX_TRIP_HOURS} часов` });
      } else if (Date.parse(t.end) > now() + CLOCK_SKEW_MINUTES * 60_000) {
        ctx.addIssue({ code: "custom", path: ["end"], message: "Нельзя добавить поездку, которая ещё не закончилась" });
      }
      if (t.commission > t.amount) {
        ctx.addIssue({ code: "custom", path: ["commission"], message: "Комиссия больше суммы поездки" });
      }
    });

export type TripInput = z.infer<ReturnType<typeof makeTripInputSchema>>;

export const dateParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
  .refine((s) => {
    const ms = Date.parse(`${s}T00:00:00Z`);
    return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(s);
  }, "Такой даты не существует");

export function formatIssues(error: z.ZodError) {
  return error.issues.map((i) => ({ field: i.path.join(".") || null, message: i.message }));
}
