import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { workDate } from "./summary.js";
import type { Trip } from "./types.js";
import type { TripInput } from "./validation.js";

export class TripConflictError extends Error {
  constructor(readonly existing: Trip) {
    super(`Поездка с id «${existing.id}» уже есть, и её данные отличаются`);
  }
}

export type AddResult = { trip: Trip; created: boolean };

function fingerprint(t: Omit<Trip, "id">): string {
  return [Date.parse(t.start), Date.parse(t.end), t.amount, t.payment, t.commission].join("|");
}

export class TripStore {
  private readonly byId = new Map<string, Trip>();
  private readonly byFingerprint = new Map<string, Trip>();
  private writes: Promise<void> = Promise.resolve();

  private constructor(private readonly file: string | null, trips: Trip[]) {
    for (const trip of trips) this.index(trip);
  }

  static async open(file: string): Promise<TripStore> {
    let trips: Trip[] = [];
    try {
      trips = JSON.parse(await readFile(file, "utf8")) as Trip[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    return new TripStore(file, trips);
  }

  static inMemory(trips: Trip[] = []): TripStore {
    return new TripStore(null, trips);
  }

  all(): Trip[] {
    return [...this.byId.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  }

  forDay(date: string, tzOffsetMinutes: number, dayStartHour: number): Trip[] {
    return this.all().filter((t) => workDate(t.start, tzOffsetMinutes, dayStartHour) === date);
  }

  async add(input: TripInput): Promise<AddResult> {
    const { id, ...data } = input;
    const print = fingerprint(data);

    if (id !== undefined) {
      const existing = this.byId.get(id);
      if (existing) {
        if (fingerprint(existing) === print) return { trip: existing, created: false };
        throw new TripConflictError(existing);
      }
    }

    const duplicate = this.byFingerprint.get(print);
    if (duplicate) return { trip: duplicate, created: false };

    const trip: Trip = { id: id ?? randomUUID(), ...data };
    this.index(trip);

    try {
      await this.persist();
    } catch (err) {
      this.byId.delete(trip.id);
      this.byFingerprint.delete(print);
      throw err;
    }
    return { trip, created: true };
  }

  private index(trip: Trip) {
    this.byId.set(trip.id, trip);
    this.byFingerprint.set(fingerprint(trip), trip);
  }

  private persist(): Promise<void> {
    const file = this.file;
    if (!file) return Promise.resolve();
    const next = this.writes.then(async () => {
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(this.all(), null, 2) + "\n");
      await rename(tmp, file);
    });
    this.writes = next.catch(() => {});
    return next;
  }
}
