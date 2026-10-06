import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { TripConflictError, TripStore } from "../src/store.js";
import type { Trip } from "../src/types.js";

const trip = {
  start: "2026-10-01T10:00:00+05:00",
  end: "2026-10-01T10:25:00+05:00",
  amount: 2000,
  payment: "card",
  commission: 300,
} as const;

const now = () => Date.parse("2026-10-06T12:00:00+05:00");

describe("TripStore: защита от дублей", () => {
  it("повтор с тем же id не создаёт вторую запись", async () => {
    const store = TripStore.inMemory();
    const first = await store.add({ id: "a1", ...trip });
    const second = await store.add({ id: "a1", ...trip });

    expect(first.created).toBe(true);
    expect(second).toEqual({ trip: first.trip, created: false });
    expect(store.all()).toHaveLength(1);
  });

  it("повтор без id распознаётся по содержимому", async () => {
    const store = TripStore.inMemory();
    const first = await store.add({ ...trip });
    const second = await store.add({ ...trip });

    expect(second.created).toBe(false);
    expect(second.trip.id).toBe(first.trip.id);
    expect(store.all()).toHaveLength(1);
  });

  it("то же время в другой записи пояса — тоже дубль", async () => {
    const store = TripStore.inMemory();
    await store.add({ ...trip });
    const again = await store.add({ ...trip, start: "2026-10-01T05:00:00Z", end: "2026-10-01T05:25:00.000Z" });

    expect(again.created).toBe(false);
    expect(store.all()).toHaveLength(1);
  });

  it("тот же id с другими данными — конфликт, а не перезапись", async () => {
    const store = TripStore.inMemory();
    await store.add({ id: "a1", ...trip });

    await expect(store.add({ id: "a1", ...trip, amount: 9999 })).rejects.toBeInstanceOf(TripConflictError);
    expect(store.all()).toEqual([expect.objectContaining({ id: "a1", amount: 2000 })]);
  });

  it("одновременные одинаковые запросы дают одну запись", async () => {
    const store = TripStore.inMemory();
    const results = await Promise.all(Array.from({ length: 10 }, () => store.add({ id: "race", ...trip })));

    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(store.all()).toHaveLength(1);
  });

  it("разные поездки добавляются обе", async () => {
    const store = TripStore.inMemory();
    await store.add({ ...trip });
    await store.add({ ...trip, amount: 2100 });
    expect(store.all()).toHaveLength(2);
  });
});

describe("POST /api/trips", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "diary-"));
    file = join(dir, "trips.json");
    const seed: Trip[] = [
      { id: "t1", start: "2026-10-01T08:10:00+05:00", end: "2026-10-01T08:32:00+05:00", amount: 2400, payment: "card", commission: 360 },
    ];
    await writeFile(file, JSON.stringify(seed));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const makeApp = async () => createApp({ store: await TripStore.open(file), tzOffsetMinutes: 300, now });

  it("создаёт поездку, а повторная отправка отвечает 200 и не пишет дубль в файл", async () => {
    const app = await makeApp();

    const created = await request(app).post("/api/trips").send({ id: "n1", ...trip });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ trip: { id: "n1", ...trip }, duplicate: false });

    const repeated = await request(app).post("/api/trips").send({ id: "n1", ...trip });
    expect(repeated.status).toBe(200);
    expect(repeated.body.duplicate).toBe(true);

    const saved = JSON.parse(await readFile(file, "utf8")) as Trip[];
    expect(saved.map((t) => t.id)).toEqual(["t1", "n1"]);
  });

  it("дубль распознаётся и после перезапуска сервера", async () => {
    await request(await makeApp()).post("/api/trips").send(trip).expect(201);
    const res = await request(await makeApp()).post("/api/trips").send(trip);

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
  });

  it("повтор существующей поездки из файла не дублирует её", async () => {
    const res = await request(await makeApp())
      .post("/api/trips")
      .send({ start: "2026-10-01T08:10:00+05:00", end: "2026-10-01T08:32:00+05:00", amount: 2400, payment: "card", commission: 360 });

    expect(res.status).toBe(200);
    expect(res.body.trip.id).toBe("t1");
  });

  it("тот же id с другой суммой — 409", async () => {
    const res = await request(await makeApp()).post("/api/trips").send({ ...trip, id: "t1" });
    expect(res.status).toBe(409);
    expect(res.body.trip.amount).toBe(2400);
  });

  it("новая поездка видна в сводке дня ровно один раз", async () => {
    const app = await makeApp();
    await request(app).post("/api/trips").send(trip);
    await request(app).post("/api/trips").send(trip);

    const day = await request(app).get("/api/days/2026-10-01").expect(200);
    expect(day.body.summary).toMatchObject({ trips: 2, revenue: 4400, commission: 660, net: 3740 });
  });
});

describe("POST /api/trips: проверка данных", () => {
  const app = createApp({ store: TripStore.inMemory(), tzOffsetMinutes: 300, now });

  it.each([
    ["сумма 0", { ...trip, amount: 0 }, "amount"],
    ["отрицательная сумма", { ...trip, amount: -100 }, "amount"],
    ["окончание раньше начала", { ...trip, end: "2026-10-01T09:59:00+05:00" }, "end"],
    ["окончание равно началу", { ...trip, end: trip.start }, "end"],
    ["комиссия больше суммы", { ...trip, commission: 2001 }, "commission"],
    ["неизвестная оплата", { ...trip, payment: "crypto" }, "payment"],
    ["время без пояса", { ...trip, start: "2026-10-01T10:00:00" }, "start"],
    ["нет суммы", { ...trip, amount: undefined }, "amount"],
    ["поездка дольше 12 часов", { ...trip, end: "2026-10-01T22:01:00+05:00" }, "end"],
    ["поездка на 28 часов через полночь", { ...trip, start: "2026-10-01T09:01:00+05:00", end: "2026-10-02T13:03:00+05:00" }, "end"],
  ])("отклоняет: %s", async (_name, body, field) => {
    const res = await request(app).post("/api/trips").send(body);
    expect(res.status).toBe(400);
    expect(res.body.issues.map((i: { field: string }) => i.field)).toContain(field);
  });

  it("поездка ровно 12 часов проходит проверку", async () => {
    await request(app).post("/api/trips").send({ ...trip, end: "2026-10-01T22:00:00+05:00" }).expect(201);
  });

  it("поездка через полночь проходит проверку", async () => {
    await request(app)
      .post("/api/trips")
      .send({ ...trip, start: "2026-10-01T23:50:00+05:00", end: "2026-10-02T00:20:00+05:00" })
      .expect(201);
  });

  it.each([
    ["завтра", "2026-10-07"],
    ["через неделю", "2026-10-13"],
    ["через месяц", "2026-11-06"],
    ["через год", "2027-10-06"],
  ])("поездку %s добавить нельзя", async (_name, day) => {
    const res = await request(app)
      .post("/api/trips")
      .send({ ...trip, start: `${day}T10:00:00+05:00`, end: `${day}T10:25:00+05:00` })
      .expect(400);
    expect(res.body.issues).toEqual([{ field: "end", message: "Нельзя добавить поездку, которая ещё не закончилась" }]);
  });

  it("сегодняшнюю поездку, которая ещё не закончилась, добавить нельзя", async () => {
    await request(app)
      .post("/api/trips")
      .send({ ...trip, start: "2026-10-06T11:50:00+05:00", end: "2026-10-06T12:30:00+05:00" })
      .expect(400);
  });

  it("сегодняшнюю поездку, которая только что закончилась, добавить можно", async () => {
    await request(app)
      .post("/api/trips")
      .send({ ...trip, start: "2026-10-06T11:30:00+05:00", end: "2026-10-06T12:02:00+05:00" })
      .expect(201);
  });

  it("битый JSON — 400", async () => {
    const res = await request(app).post("/api/trips").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_json");
  });
});

describe("GET /api/days/:date", () => {
  it("отдаёт поездки дня по порядку и сводку", async () => {
    const store = TripStore.inMemory([
      { id: "b", start: "2026-10-01T09:05:00+05:00", end: "2026-10-01T09:20:00+05:00", amount: 1500, payment: "cash", commission: 225 },
      { id: "a", start: "2026-10-01T08:10:00+05:00", end: "2026-10-01T08:32:00+05:00", amount: 2400, payment: "card", commission: 360 },
      { id: "other", start: "2026-10-02T08:10:00+05:00", end: "2026-10-02T08:32:00+05:00", amount: 100, payment: "card", commission: 0 },
    ]);
    const res = await request(createApp({ store, tzOffsetMinutes: 300, now })).get("/api/days/2026-10-01").expect(200);

    expect(res.body.trips.map((t: Trip) => t.id)).toEqual(["a", "b"]);
    expect(res.body.summary).toMatchObject({ trips: 2, revenue: 3900, commission: 585, net: 3315 });
  });

  it("ночная смена целиком попадает в день, когда началась", async () => {
    const night = (id: string, start: string, end: string): Trip => ({ id, start, end, amount: 1000, payment: "cash", commission: 150 });
    const store = TripStore.inMemory([
      night("n1", "2026-10-01T22:10:00+05:00", "2026-10-01T22:40:00+05:00"),
      night("n2", "2026-10-01T23:55:00+05:00", "2026-10-02T00:25:00+05:00"),
      night("n3", "2026-10-02T01:10:00+05:00", "2026-10-02T01:30:00+05:00"),
      night("n4", "2026-10-02T03:59:00+05:00", "2026-10-02T04:20:00+05:00"),
      night("d1", "2026-10-02T04:00:00+05:00", "2026-10-02T04:15:00+05:00"),
    ]);
    const app = createApp({ store, tzOffsetMinutes: 300, now });

    const first = await request(app).get("/api/days/2026-10-01").expect(200);
    expect(first.body.trips.map((t: Trip) => t.id)).toEqual(["n1", "n2", "n3", "n4"]);
    expect(first.body.summary).toMatchObject({ trips: 4, firstStart: "2026-10-01T22:10:00+05:00", lastEnd: "2026-10-02T04:20:00+05:00" });
    expect(first.body.dayStartHour).toBe(4);

    const second = await request(app).get("/api/days/2026-10-02").expect(200);
    expect(second.body.trips.map((t: Trip) => t.id)).toEqual(["d1"]);

    const days = await request(app).get("/api/days").expect(200);
    expect(days.body.days).toEqual([
      { date: "2026-10-01", trips: 4 },
      { date: "2026-10-02", trips: 1 },
    ]);
  });

  it("начало рабочих суток настраивается", async () => {
    const store = TripStore.inMemory([
      { id: "a", start: "2026-10-02T01:10:00+05:00", end: "2026-10-02T01:30:00+05:00", amount: 1000, payment: "cash", commission: 150 },
    ]);
    const res = await request(createApp({ store, tzOffsetMinutes: 300, dayStartHour: 0, now })).get("/api/days/2026-10-02").expect(200);
    expect(res.body.summary.trips).toBe(1);
  });

  it("неверная дата — 400", async () => {
    const app = createApp({ store: TripStore.inMemory(), tzOffsetMinutes: 300, now });
    await request(app).get("/api/days/2026-02-30").expect(400);
    await request(app).get("/api/days/yesterday").expect(400);
  });
});
