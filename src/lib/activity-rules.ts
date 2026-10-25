export type ActivityKind = "fill" | "order" | "bot-entry" | "bot-exit" | "bot-bank" | "bot-signal" | "bot-error";
export type ActivityItem = { id: string; at: string; kind: ActivityKind; title: string; detail: string; amount: number | null };
export type ActivityFilter = "all" | "trades" | "bot" | "orders";

const money = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Merge broker fills, app-sent orders and IWM bot events into one newest-first feed. */
export function buildActivity(input: {
  fills: any[];
  sent: any[];
  botTrades: any[];
  botBanks: any[];
  pulseEvents?: any[];
}): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const o of input.fills) {
    if (!o.filledAt) continue;
    items.push({
      id: `fill-${o.id}`, at: o.filledAt, kind: "fill",
      title: `${o.side === "buy" ? "Bought" : "Sold"} ${o.symbol}`,
      detail: `${o.filledQty} @ ${money(Number(o.filledAvgPrice ?? 0))}`,
      amount: null,
    });
  }
  for (const o of input.sent) {
    items.push({
      id: `sent-${o.id}`, at: o.created_at, kind: "order",
      title: `${o.side === "buy" ? "Buy" : "Sell"} order sent • ${o.symbol}`,
      detail: `${o.qty} · stop ${o.stop} · ${o.environment}`,
      amount: null,
    });
  }
  for (const t of input.botTrades) {
    items.push({
      id: `bot-entry-${t.id}`, at: t.entry_time, kind: "bot-entry",
      title: `Bot bought IWM ${money(Number(t.strike))} ${t.side}`,
      detail: `${t.contracts} contracts @ ${money(Number(t.entry_premium))}`,
      amount: null,
    });
    if (t.exit_time) {
      items.push({
        id: `bot-exit-${t.id}`, at: t.exit_time, kind: "bot-exit",
        title: `Bot sold IWM ${money(Number(t.strike))} ${t.side}`,
        detail: t.exit_reason ?? "Exit",
        amount: Number(t.pnl ?? 0),
      });
    }
  }
  for (const b of input.botBanks) {
    items.push({
      id: `bot-bank-${b.id}`, at: b.created_at, kind: "bot-bank",
      title: "Bot banked profits",
      detail: `Cycle ${b.new_cycle} · restart ${money(Number(b.restart_balance))}`,
      amount: Number(b.amount_banked ?? 0),
    });
  }
  for(const e of input.pulseEvents??[]){
    if(!["entry","exit","bank","signal","error"].includes(e.kind)) continue;
    const d=e.detail??{},kind:ActivityKind=e.kind==="bank"?"bot-bank":e.kind==="entry"?"bot-entry":e.kind==="exit"?"bot-exit":e.kind==="signal"?"bot-signal":"bot-error";
    items.push({id:`pulse-${e.id}`,at:e.created_at,kind,title:e.kind==="bank"?"Separate bot banked profits":e.kind==="error"?"Separate bot check failed":`Separate bot ${e.kind} · ${d.symbol??""}`,detail:String(d.reason??d.message??(d.qty?`${d.qty} @ ${money(Number(d.price??0))}`:"")),amount:e.kind==="exit"?Number(d.pnl??0):e.kind==="bank"?Number(d.amount??0):null});
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function filterActivity(items: ActivityItem[], filter: ActivityFilter): ActivityItem[] {
  if (filter === "all") return items;
  if (filter === "trades") return items.filter((i) => i.kind === "fill");
  if (filter === "bot") return items.filter((i) => i.kind.startsWith("bot"));
  return items.filter((i) => i.kind === "order");
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** CSV export of the feed: when, type, what, detail, amount. */
export function activityCsv(items: ActivityItem[]): string {
  const rows = items.map((i) => [i.at, i.kind, i.title, i.detail, i.amount == null ? "" : i.amount.toFixed(2)]);
  return ["when,type,what,detail,amount", ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}
