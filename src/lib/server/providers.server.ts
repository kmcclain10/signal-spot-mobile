// Server-only: provider tests, adapters, and secret encryption. Never import from components.
import { getProviderDef } from "@/lib/providers";

type Rec = Record<string, any>;

// ---------- crypto (AES-256-GCM, key = SHA-256 of CONNECTIONS_ENCRYPTION_KEY) ----------
const b64 = (u: Uint8Array) => {
  let s = "";
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey() {
  const raw = process.env["CONNECTIONS_ENCRYPTION_KEY"];
  if (!raw) throw new Error("Encryption key is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptJson(obj: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(JSON.stringify(obj))),
  );
  return { cipher: b64(ct), iv: b64(iv) };
}
export async function decryptJson(cipher: string | null, iv: string | null): Promise<Rec> {
  if (!cipher || !iv) return {};
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(), unb64(cipher));
  return JSON.parse(new TextDecoder().decode(pt));
}

// ---------- helpers ----------
async function getJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
export const alpacaTradingBase = (env: string) =>
  env === "live" ? "https://api.alpaca.markets" : "https://paper-api.alpaca.markets";
const ALPACA_DATA = "https://data.alpaca.markets";
const alpacaHeaders = (s: Rec) => ({
  "APCA-API-KEY-ID": s.key_id,
  "APCA-API-SECRET-KEY": s.secret_key,
  "Content-Type": "application/json",
});

export function buildCustomRequest(cfg: Rec, sec: Rec, path: string, init: RequestInit = {}) {
  const url = new URL(path, cfg.base_url);
  let extra: Rec = {};
  if (cfg.extra_headers) {
    try {
      extra = JSON.parse(cfg.extra_headers);
    } catch {
      throw new Error("Extra headers must be valid JSON");
    }
  }
  const headers: Record<string, string> = { ...extra };
  if (cfg.auth_type === "header" && cfg.auth_name) headers[cfg.auth_name] = sec.auth_value ?? "";
  if (cfg.auth_type === "bearer") headers["Authorization"] = `Bearer ${sec.auth_value ?? ""}`;
  if (cfg.auth_type === "query" && cfg.auth_name) url.searchParams.set(cfg.auth_name, sec.auth_value ?? "");
  return { url: url.toString(), init: { ...init, headers: { ...headers, ...((init.headers as Rec) || {}) } } };
}

// ---------- tests ----------
export async function testProvider(provider: string, cfg: Rec, sec: Rec, env: string): Promise<string> {
  getProviderDef(provider);
  switch (provider) {
    case "alpaca": {
      const a = await getJson(`${alpacaTradingBase(env)}/v2/account`, { headers: alpacaHeaders(sec) });
      return `Connected — ${env} account, equity $${Number(a.equity).toLocaleString()}`;
    }
    case "polygon":
      await getJson(`https://api.polygon.io/v2/aggs/ticker/SPY/prev?apiKey=${encodeURIComponent(sec.api_key)}`);
      return "Connected — fetched SPY previous close";
    case "finnhub": {
      const q = await getJson(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(sec.token)}`);
      return `Connected — AAPL last ${q.c}`;
    }
    case "custom": {
      const { url, init } = buildCustomRequest(cfg, sec, cfg.test_path || "/");
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
      return `Connected — ${cfg.test_path || "/"} returned ${r.status}`;
    }
  }
  throw new Error(`No test for ${provider}`);
}

// ---------- adapters ----------
export type Conn = { provider: string; environment: string; config: Rec };

export function brokerAdapter(conn: Conn, sec: Rec) {
  if (conn.provider !== "alpaca") throw new Error(`${conn.provider} has no broker adapter`);
  const base = alpacaTradingBase(conn.environment);
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(base + path, { ...init, headers: alpacaHeaders(sec) });
    const t = await r.text();
    if (!r.ok) throw new Error(`Alpaca ${r.status}: ${t.slice(0, 300)}`);
    return t ? JSON.parse(t) : null;
  };
  return {
    async getAccount() {
      const a = await call("/v2/account");
      return {
        equity: +a.equity,
        lastEquity: +a.last_equity,
        dayPl: +a.equity - +a.last_equity,
        buyingPower: +a.buying_power,
        cash: +a.cash,
      };
    },
    async getPositions() {
      return ((await call("/v2/positions")) as any[]).map((p) => ({
        symbol: p.symbol,
        qty: +p.qty,
        avgPrice: +p.avg_entry_price,
        currentPrice: +p.current_price,
        unrealizedPl: +p.unrealized_pl,
      }));
    },
    async getOrders(status: string = "all") {
      const s = ["open", "closed", "all"].includes(status) ? status : "all";
      const rows = (await call(`/v2/orders?status=${s}&limit=100&nested=true`)) as any[];
      return rows.map((o) => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        qty: +o.qty,
        filledQty: +o.filled_qty,
        filledAvgPrice: o.filled_avg_price ? +o.filled_avg_price : null,
        type: o.type,
        orderClass: o.order_class,
        status: o.status,
        submittedAt: o.submitted_at,
        filledAt: o.filled_at,
      }));
    },
    async placeBracketOrder(o: { symbol: string; side: "buy" | "sell"; qty: number; stop: number; target?: number | null; clientId: string }) {
      const body: Rec = {
        symbol: o.symbol,
        side: o.side,
        qty: String(o.qty),
        type: "market",
        time_in_force: "day",
        client_order_id: o.clientId,
        order_class: o.target ? "bracket" : "oto",
        stop_loss: { stop_price: o.stop.toFixed(2) },
        ...(o.target ? { take_profit: { limit_price: o.target.toFixed(2) } } : {}),
      };
      const r = await call("/v2/orders", { method: "POST", body: JSON.stringify(body) });
      return { id: r.id as string, status: r.status as string, raw: r };
    },
    async cancelOrder(id: string) {
      await call(`/v2/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
      return { ok: true };
    },
    async closePosition(symbol: string) {
      await call(`/v2/positions/${encodeURIComponent(symbol)}`, { method: "DELETE" });
      return { ok: true };
    },
  };
}

export function dataAdapter(conn: Conn, sec: Rec) {
  if (conn.provider === "alpaca") {
    const feed = conn.config.feed || "iex";
    const h = alpacaHeaders(sec);
    return {
      async getBars(symbol: string, timeframe: string, start: string, end: string) {
        const u = new URL(`${ALPACA_DATA}/v2/stocks/${encodeURIComponent(symbol)}/bars`);
        u.search = new URLSearchParams({ timeframe, start, end, limit: "10000", feed, adjustment: "raw" }).toString();
        const j = await getJson(u.toString(), { headers: h });
        return (j.bars ?? []).map((b: any) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
      },
      async getLastPrice(symbol: string) {
        const j = await getJson(`${ALPACA_DATA}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=${feed}`, { headers: h });
        return j.trade.p as number;
      },
    };
  }
  if (conn.provider === "polygon") {
    const k = encodeURIComponent(sec.api_key);
    return {
      async getBars(symbol: string, timeframe: string, start: string, end: string) {
        const [mult, unit] = timeframe === "1Day" ? [1, "day"] : timeframe === "5Min" ? [5, "minute"] : [1, "minute"];
        const j = await getJson(
          `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${mult}/${unit}/${start.slice(0, 10)}/${end.slice(0, 10)}?limit=50000&apiKey=${k}`,
        );
        return (j.results ?? []).map((b: any) => ({ t: new Date(b.t).toISOString(), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
      },
      async getLastPrice(symbol: string) {
        const j = await getJson(`https://api.polygon.io/v2/last/trade/${encodeURIComponent(symbol)}?apiKey=${k}`);
        return j.results.p as number;
      },
    };
  }
  throw new Error(`${conn.provider} has no data adapter`);
}

export function newsAdapter(conn: Conn, sec: Rec) {
  if (conn.provider !== "finnhub") throw new Error(`${conn.provider} has no news adapter`);
  return {
    async getNews(symbol: string, from: string, to: string) {
      const j = await getJson(
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(sec.token)}`,
      );
      return (j as any[]).slice(0, 50).map((n) => ({
        time: new Date(n.datetime * 1000).toISOString(),
        headline: n.headline,
        url: n.url,
        source: n.source,
      }));
    },
  };
}

export async function customRequest(cfg: Rec, sec: Rec, args: { path: string; method?: string; body?: unknown }) {
  if (!args.path?.startsWith("/")) throw new Error("Path must start with /");
  const method = (args.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") throw new Error("Only GET and POST are allowed");
  const { url, init } = buildCustomRequest(cfg, sec, args.path, {
    method,
    ...(method === "POST" ? { body: JSON.stringify(args.body ?? {}), headers: { "Content-Type": "application/json" } } : {}),
  });
  const r = await fetch(url, init);
  const text = await r.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* plain text */
  }
  return { status: r.status, body };
}
