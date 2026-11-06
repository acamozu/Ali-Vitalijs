// Agenda clock: the time comes from the internet (German time), not from the visitor's device.
// Phones often run a few minutes off or in another time zone, which would shift the highlighted slot.

const TZ = "Europe/Berlin";

// How far the device clock is off: returns { offset (ms, add to Date.now()), source }.
export async function fetchOffset() {
  // 1) our own web server: its Date header is NTP-synced. A unique path avoids CDN-cached copies.
  try {
    const t0 = Date.now();
    const res = await fetch(`/__time?${t0}`, { method: "HEAD", cache: "no-store" });
    const t1 = Date.now();
    const date = res.headers.get("date");
    if (date) {
      const age = Number(res.headers.get("age") || 0) * 1000; // cached copies: Date is the generation time
      const server = new Date(date).getTime() + age + 500; // header has 1 s resolution: +0.5 s on average
      return { offset: server + (t1 - t0) / 2 - t1, source: "server" };
    }
  } catch {
    /* fall through */
  }
  // 2) public time API for Europe/Berlin
  try {
    const t0 = Date.now();
    const res = await fetch(`https://worldtimeapi.org/api/timezone/${TZ}`, { cache: "no-store" });
    const json = await res.json();
    const t1 = Date.now();
    return { offset: new Date(json.utc_datetime).getTime() + (t1 - t0) / 2 - t1, source: "api" };
  } catch {
    /* fall through */
  }
  // 3) last resort: device clock
  return { offset: 0, source: "device" };
}

// "2026-11-06" for the given instant, as the calendar date in Germany
export function berlinDate(ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

// "+01:00" (winter) or "+02:00" (summer) for the given instant in Germany
export function berlinOffset(ms) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
      .formatToParts(ms)
      .find((p) => p.type === "timeZoneName").value; // "GMT+1", "GMT+01:00" or "GMT"
    const m = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (m) return `${m[1]}${m[2].padStart(2, "0")}:${m[3] || "00"}`;
    return "+00:00";
  } catch {
    return "+01:00";
  }
}
