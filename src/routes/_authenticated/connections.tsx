import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveConnection, setDefaultConnection, testConnection } from "@/lib/api.functions";
import { useConnections } from "@/hooks/use-app-data";
import { CAPABILITY_LABEL, PROVIDERS, getProviderDef, type Capability, type ProviderDef } from "@/lib/providers";
import { timeAgo } from "@/lib/format";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Connections — Pulse Signals" },
      { name: "description", content: "Connect market data, news, broker or any REST API." },
      { property: "og:title", content: "Connections — Pulse Signals" },
      { property: "og:description", content: "Connect market data, news, broker or any REST API." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectionsPage,
});

type Conn = NonNullable<ReturnType<typeof useConnections>["data"]>[number];

function ConnectionForm({ def, existing, onDone }: { def: ProviderDef; existing?: Conn; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveConnection);
  const cfg0 = (existing?.config ?? {}) as Record<string, string>;
  const [label, setLabel] = useState(existing?.label ?? def.name);
  const [env, setEnv] = useState(existing?.environment === "live" ? "live" : "paper");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of def.fields) v[f.key] = f.secret ? "" : (cfg0[f.key] ?? (f.type === "select" ? f.options?.[0] ?? "" : ""));
    return v;
  });
  const [show, setShow] = useState<Record<string, boolean>>({});
  const m = useMutation({
    mutationFn: () => {
      const config: Record<string, string> = {};
      const secrets: Record<string, string> = {};
      for (const f of def.fields) (f.secret ? secrets : config)[f.key] = values[f.key];
      return save({ data: { id: existing?.id, provider: def.id, label, environment: env, config, secrets } });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      qc.invalidateQueries({ queryKey: ["broker"] });
      if (r.status === "ok") toast.success(r.message);
      else toast.error(r.message);
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <div className="space-y-1.5">
        <Label>Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      {def.hasEnvironment && (
        <div className="space-y-1.5">
          <Label>Environment</Label>
          <div className="grid grid-cols-2 gap-1 rounded-md border p-1">
            {["paper", "live"].map((e) => (
              <button type="button" key={e} onClick={() => setEnv(e)}
                className={cn("rounded px-3 py-1.5 text-sm capitalize", env === e ? (e === "live" ? "bg-loss text-destructive-foreground" : "bg-accent") : "text-muted-foreground")}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
      {def.fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label>{f.label}{f.required && !(f.secret && existing) ? " *" : ""}</Label>
          {f.type === "select" ? (
            <Select value={values[f.key]} onValueChange={(v) => setValues({ ...values, [f.key]: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{f.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className="relative">
              <Input
                type={f.secret && !show[f.key] ? "password" : f.type === "url" ? "url" : "text"}
                placeholder={f.secret && existing ? `•••• (leave blank to keep ${existing.secret_hint ? "••••" + existing.secret_hint : "current"})` : f.placeholder}
                value={values[f.key]}
                autoComplete="off"
                required={f.required && !(f.secret && existing)}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className={f.secret ? "num pr-9" : undefined}
              />
              {f.secret && (
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShow({ ...show, [f.key]: !show[f.key] })} aria-label="Show or hide">
                  {show[f.key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              )}
            </div>
          )}
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Keys are encrypted and only ever used on the server — they're never shown again.</p>
      <Button type="submit" className="w-full" disabled={m.isPending}>{m.isPending ? "Saving & testing…" : "Save & test"}</Button>
    </form>
  );
}

function ConnectionCard({ c, onEdit }: { c: Conn; onEdit: () => void }) {
  const qc = useQueryClient();
  const test = useServerFn(testConnection);
  const setDef = useServerFn(setDefaultConnection);
  const def = getProviderDef(c.provider);
  const refresh = () => qc.invalidateQueries({ queryKey: ["connections"] });
  const t = useMutation({
    mutationFn: () => test({ data: { id: c.id } }),
    onSuccess: (r) => { refresh(); r.ok ? toast.success(r.message) : toast.error(r.message); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Test failed"),
  });
  const d = useMutation({
    mutationFn: (kind: "data" | "broker") => setDef({ data: { id: c.id, kind } }),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["broker"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const del = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("connections").delete().eq("id", c.id); if (error) throw error; },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });
  const dot = c.status === "ok" ? "bg-gain" : c.status === "failed" ? "bg-loss" : "bg-muted-foreground";
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{c.label}</span>
            {c.environment !== "n/a" && (
              <span className={cn("num rounded px-1.5 text-[10px] font-semibold uppercase", c.environment === "live" ? "bg-loss text-destructive-foreground" : "bg-secondary text-muted-foreground")}>{c.environment}</span>
            )}
            {c.is_default_data && <span className="rounded bg-primary/15 px-1.5 text-[10px] text-primary">default data</span>}
            {c.is_default_broker && <span className="rounded bg-primary/15 px-1.5 text-[10px] text-primary">default broker</span>}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{def.name}{c.secret_hint && <span className="num"> · ••••{c.secret_hint}</span>}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          <span className={cn("size-2 rounded-full", dot)} />
          <span className="text-muted-foreground">{c.status === "ok" ? "Connected" : c.status === "failed" ? "Failed" : "Untested"} · {timeAgo(c.last_tested_at)}</span>
        </div>
      </div>
      {c.status_detail && (
        c.status === "failed"
          ? <pre className="num mt-3 overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-2 text-[11px] text-muted-foreground">{c.status_detail}</pre>
          : <p className="mt-2 text-xs text-gain">{c.status_detail}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => t.mutate()} disabled={t.isPending}>{t.isPending ? "Testing…" : "Test"}</Button>
        <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
        {def.capabilities.includes("data") && !c.is_default_data && <Button size="sm" variant="ghost" onClick={() => d.mutate("data")}>Make default data</Button>}
        {def.capabilities.includes("broker") && !c.is_default_broker && <Button size="sm" variant="ghost" onClick={() => d.mutate("broker")}>Make default broker</Button>}
        <AlertDialog>
          <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="ml-auto text-loss">Delete</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {c.label}?</AlertDialogTitle>
              <AlertDialogDescription>The saved keys are removed permanently.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Panel>
  );
}

function ConnectionsPage() {
  const conns = useConnections();
  const [sheet, setSheet] = useState<{ open: boolean; def?: ProviderDef; existing?: Conn }>({ open: false });
  const close = () => setSheet({ open: false });
  const caps: Capability[] = ["data", "broker", "news", "custom"];

  return (
    <div>
      <PageHeader title="Connections" sub="Plug in market data, news, your broker or any REST API."
        action={<Button onClick={() => setSheet({ open: true })}><Plus /> Add connection</Button>} />
      {conns.isLoading ? <LoadingRows /> : conns.error ? <ErrorState error={conns.error} onRetry={() => conns.refetch()} /> : (
        <div className="space-y-6">
          {caps.map((cap) => {
            const rows = (conns.data ?? []).filter((c) => getProviderDef(c.provider).capabilities.includes(cap));
            return (
              <section key={cap}>
                <h2 className="mb-2 text-sm font-semibold">{CAPABILITY_LABEL[cap]}</h2>
                {rows.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {rows.map((c) => <ConnectionCard key={c.id + cap} c={c} onEdit={() => setSheet({ open: true, def: getProviderDef(c.provider), existing: c })} />)}
                  </div>
                ) : (
                  <EmptyState title={`No ${CAPABILITY_LABEL[cap].toLowerCase()} connection yet.`} />
                )}
              </section>
            );
          })}
        </div>
      )}

      <Sheet open={sheet.open} onOpenChange={(o) => !o && close()}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{sheet.existing ? `Edit ${sheet.existing.label}` : sheet.def ? `Connect ${sheet.def.name}` : "Choose a provider"}</SheetTitle>
          </SheetHeader>
          {!sheet.def ? (
            <div className="grid gap-2 p-4">
              {PROVIDERS.map((p) => (
                <button key={p.id} onClick={() => setSheet({ open: true, def: p })}
                  className="flex items-start gap-3 rounded-[10px] border p-3 text-left hover:bg-accent">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 font-semibold text-primary">{p.name[0]}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.description}</span>
                    {p.docsUrl && (
                      <a href={p.docsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Docs <ExternalLink className="size-3" /></a>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <ConnectionForm key={sheet.existing?.id ?? sheet.def.id} def={sheet.def} existing={sheet.existing} onDone={close} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
