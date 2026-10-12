// Market clock in America/New_York. Ignores exchange holidays.
export type MarketPhase = "open" | "pre" | "after" | "closed";

function nyParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return {
    date: `${o.year}-${o.month}-${o.day}`,
    weekday: o.weekday,
    secs: (Number(o.hour) % 24) * 3600 + Number(o.minute) * 60 + Number(o.second),
  };
}

export function nyDate(d = new Date()) {
  return nyParts(d).date;
}

const OPEN = 9.5 * 3600;
const CLOSE = 16 * 3600;
const PRE = 4 * 3600;

export function marketStatus(now = new Date()): { phase: MarketPhase; label: string; countdown: string } {
  const { weekday, secs } = nyParts(now);
  const weekend = weekday === "Sat" || weekday === "Sun";
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`;
  };
  if (!weekend && secs >= OPEN && secs < CLOSE)
    return { phase: "open", label: "Market open", countdown: `closes in ${fmt(CLOSE - secs)}` };
  if (!weekend && secs >= PRE && secs < OPEN)
    return { phase: "pre", label: "Pre-market", countdown: `opens in ${fmt(OPEN - secs)}` };
  // time until next weekday open
  const daysAhead = (() => {
    const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let i = order.indexOf(weekday);
    let n = secs >= OPEN ? 1 : 0;
    let idx = (i + n) % 7;
    while (order[idx] === "Sat" || order[idx] === "Sun") {
      n++;
      idx = (i + n) % 7;
    }
    return n;
  })();
  const until = daysAhead * 86400 + OPEN - secs;
  return {
    phase: !weekend && secs >= CLOSE && secs < 20 * 3600 ? "after" : "closed",
    label: "Market closed",
    countdown: `opens in ${fmt(until)}`,
  };
}

export function isBeforeSignals(now = new Date()) {
  const { secs } = nyParts(now);
  return secs < 9 * 3600 + 35 * 60;
}
