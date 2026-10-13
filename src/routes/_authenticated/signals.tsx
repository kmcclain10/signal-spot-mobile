import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/use-app-data";
import { FAMILY_LABEL, parseStrategyId, strategyName } from "@/lib/strategy-names";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel } from "@/components/common";
import { SignalRow, type Signal } from "@/components/SignalRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/signals")({
  head: () => ({
    meta: [
      { title: "Signals — Pulse Signals" },
      { name: "description", content: "Full history of trade signals with filters and CSV export." },
      { property: "og:title", content: "Signals — Pulse Signals" },
      { property: "og:description", content: "Full history of trade signals with filters and CSV export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignalsPage,
});

function SignalsPage() {
  useRealtimeInvalidate("signals", [["signals"]]);
  const [date, setDate] = useState("");
  const [symbol, setSymbol] = useState("");
  const [family, setFamily] = useState("all");
  const [side, setSide] = useState("all");
  const [status, setStatus] = useState("all");
  const q = useQuery({
    queryKey: ["signals", "history", date],
    queryFn: async () => {
      let r = supabase.from("signals").select("*").order("signal_time", { ascending: false }).limit(1000);
      if (date) r = r.eq("trade_date", date);
      const { data, error } = await r;
      if (error) throw error;
      return data as unknown as Signal[];
    },
  });
  const rows = useMemo(
    () =>
      (q.data ?? []).filter(
        (s) =>
          (!symbol || s.symbol.includes(symbol.toUpperCase())) &&
          (family === "all" || parseStrategyId(s.strategy_id)?.family === family) &&
          (side === "all" || s.side === side) &&
          (status === "all" || s.status === status),
      ),
    [q.data, symbol, family, side, status],
  );

  function exportCsv() {
    const head = ["date", "time", "symbol", "strategy", "side", "entry", "stop", "target", "status"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((s) =>
      [s.trade_date, s.signal_time, s.symbol, strategyName(s.strategy_id), s.side, s.entry, s.stop, s.target ?? "close", s.status]
        .map(esc)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `signals${date ? "-" + date : ""}.csv`;
    a.click();
  }

  return (
    <div>
      <PageHeader
        title="Signals"
        sub="Every entry the engine flagged."
        action={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download /> CSV
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input placeholder="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All families</SelectItem>
            {Object.entries(FAMILY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={side} onValueChange={setSide}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Long & short</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "new", "ordered", "skipped", "expired"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "Any status" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {q.isLoading ? (
        <LoadingRows />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !rows.length ? (
        <EmptyState title="No signals match." body="Signals appear here once the engine's intraday scan runs." />
      ) : (
        <Panel>
          {rows.map((s) => (
            <SignalRow key={s.id} s={s} />
          ))}
        </Panel>
      )}
    </div>
  );
}
