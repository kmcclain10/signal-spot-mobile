import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SideBadge({ side }: { side: string }) {
  const long = side === "long" || side === "buy";
  return (
    <span
      className={cn(
        "num inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider",
        long ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss",
      )}
    >
      {long ? "LONG" : "SHORT"}
    </span>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-[10px] border bg-card", className)}>{children}</div>;
}

export function StatCard({ label, value, tone, hint }: { label: string; value: string; tone?: "gain" | "loss"; hint?: string }) {
  return (
    <Panel className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("num mt-1 text-2xl font-semibold", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Panel>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[10px] border border-dashed px-6 py-10 text-center">
      <Inbox className="mb-3 size-6 text-muted-foreground" />
      <div className="text-sm font-medium">{title}</div>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[10px] border border-loss/40 px-6 py-8 text-center">
      <AlertTriangle className="mb-2 size-5 text-loss" />
      <p className="max-w-md text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
