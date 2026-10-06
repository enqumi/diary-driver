import express, { type ErrorRequestHandler } from "express";
import { summarize, workDate } from "./summary.js";
import { TripConflictError, type TripStore } from "./store.js";
import { dateParamSchema, formatIssues, makeTripInputSchema } from "./validation.js";

export interface AppOptions {
  store: TripStore;
  tzOffsetMinutes: number;
  dayStartHour?: number;
  now?: () => number;
}

export const DEFAULT_DAY_START_HOUR = 4;

export function createApp({ store, tzOffsetMinutes, dayStartHour = DEFAULT_DAY_START_HOUR, now = Date.now }: AppOptions) {
  const tripInputSchema = makeTripInputSchema({ now });
  const app = express();
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/days", (_req, res) => {
    const counts = new Map<string, number>();
    for (const trip of store.all()) {
      const day = workDate(trip.start, tzOffsetMinutes, dayStartHour);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    res.json({
      tzOffsetMinutes,
      dayStartHour,
      days: [...counts].map(([date, trips]) => ({ date, trips })),
    });
  });

  app.get("/api/days/:date", (req, res) => {
    const parsed = dateParamSchema.safeParse(req.params.date);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_date", issues: formatIssues(parsed.error) });
      return;
    }
    const trips = store.forDay(parsed.data, tzOffsetMinutes, dayStartHour);
    res.json({ date: parsed.data, tzOffsetMinutes, dayStartHour, summary: summarize(trips), trips });
  });

  app.post("/api/trips", async (req, res) => {
    const parsed = tripInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation", issues: formatIssues(parsed.error) });
      return;
    }
    try {
      const { trip, created } = await store.add(parsed.data);
      res.status(created ? 201 : 200).json({ trip, duplicate: !created });
    } catch (err) {
      if (err instanceof TripConflictError) {
        res.status(409).json({ error: "conflict", message: err.message, trip: err.existing });
        return;
      }
      throw err;
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed") {
      res.status(400).json({ error: "invalid_json", message: "Тело запроса — не JSON" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal" });
  };
  app.use(onError);

  return app;
}
