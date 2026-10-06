import { fileURLToPath } from "node:url";
import { createApp, DEFAULT_DAY_START_HOUR } from "./app.js";
import { TripStore } from "./store.js";

const port = Number(process.env.PORT ?? 3001);
const dataFile = process.env.TRIPS_FILE ?? fileURLToPath(new URL("../data/trips.json", import.meta.url));
const tzOffsetMinutes = Number(process.env.TZ_OFFSET_MINUTES ?? 300);
const dayStartHour = Number(process.env.DAY_START_HOUR ?? DEFAULT_DAY_START_HOUR);

const store = await TripStore.open(dataFile);
createApp({ store, tzOffsetMinutes, dayStartHour }).listen(port, () => {
  console.log(`API: http://localhost:${port}/api  (данные: ${dataFile})`);
});
