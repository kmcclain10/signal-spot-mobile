import { describe, it, expect } from "vitest";
import { allocationSummary, botHealth, runStats } from "@/lib/bots-rules";

// Monday 2026-10-19, 11:00 ET = 15:00 UTC (inside market hours)
const marketOpen = new Date("2026-10-19T15:00:00Z");
const settings = { enabled: true, kill_switch: false, max_daily_loss: 100, starting_bankroll: 200, bank_trigger: 25200 };

describe("botHealth", () => {
  it("is disabled when the bot is off", () => {
    expect(botHealth(marketOpen, { ...settings, enabled: false }, null).status).toBe("disabled");
  });
  it("is paused by the kill switch", () => {
    expect(botHealth(marketOpen, { ...settings, kill_switch: true }, null).status).toBe("paused");
  });
  it("is paused when the broker mismatch needs review", () => {
    expect(botHealth(marketOpen, settings, { needs_review: "orphan position" }).status).toBe("paused");
  });
  it("is paused once today's loss reaches the limit", () => {
    expect(botHealth(marketOpen, settings, { pnl_today: -100 }).status).toBe("paused");
    expect(botHealth(marketOpen, settings, { pnl_today: -99, last_success_at: "2026-10-19T14:59:30Z" }).detail).toBe("Checking every minute");
  });
  it("is offline during market hours without a recent success", () => {
    expect(botHealth(marketOpen, settings, { last_success_at: "2026-10-19T14:50:00Z" }).status).toBe("offline");
  });
  it("is running with a fresh success, and waits outside market hours", () => {
    expect(botHealth(marketOpen, settings, { last_success_at: "2026-10-19T14:59:30Z" }).status).toBe("running");
    expect(botHealth(new Date("2026-10-19T03:00:00Z"), settings, null).detail).toBe("Waiting for market hours");
  });
});

describe("runStats", () => {
  it("counts failures and averages duration", () => {
    const runs = [
      { ok: true, duration_ms: 1000, started_at: "a", finished_at: "b", error: null },
      { ok: true, duration_ms: 3000, started_at: "a", finished_at: "b", error: null },
      { ok: false, duration_ms: 2000, started_at: "a", finished_at: "b", error: "boom" },
    ];
    expect(runStats(runs)).toEqual({ total: 3, failures: 1, successRate: 2 / 3, avgDurationMs: 2000 });
  });
  it("treats no runs as fully healthy", () => {
    expect(runStats([])).toEqual({ total: 0, failures: 0, successRate: 1, avgDurationMs: 0 });
  });
});

describe("allocationSummary", () => {
  it("reports balance, banked total and progress toward the bank trigger", () => {
    const a = allocationSummary(settings, { balance: 12600, banked_total: 25000 });
    expect(a.allocated).toBe(200);
    expect(a.balance).toBe(12600);
    expect(a.banked).toBe(25000);
    expect(a.progressPct).toBe(50);
    expect(a.dailyLossLimit).toBe(100);
  });
  it("caps progress at 100% and defaults to the starting bankroll", () => {
    expect(allocationSummary(settings, { balance: 30000 }).progressPct).toBe(100);
    expect(allocationSummary(settings, null).balance).toBe(200);
  });
});
