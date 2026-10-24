import { describe, expect, it } from "vitest";
import { backgroundLockDue, sensitiveAccountChange, sensitiveIwmChange } from "@/lib/account-rules";
describe("Account security", () => {
  it("locks at 15 minutes in the background, not earlier or while foreground", () => {
    expect(backgroundLockDue(1000, 900999)).toBe(false);
    expect(backgroundLockDue(1000, 901000)).toBe(true);
    expect(backgroundLockDue(null, 9999999)).toBe(false);
  });
  it("requires confirmation for LIVE and risk changes", () => {
    const old = { trading_mode: "paper", risk_per_trade_usd: 25, max_open_positions: 5, max_daily_loss_usd: 100 };
    expect(sensitiveAccountChange(old, { ...old, trading_mode: "live" })).toBe(true);
    for (const key of ["risk_per_trade_usd", "max_open_positions", "max_daily_loss_usd"]) expect(sensitiveAccountChange(old, { ...old, [key]: 50 })).toBe(true);
    expect(sensitiveAccountChange(old, old)).toBe(false);
  });
  it("requires confirmation to disable kill switch, including via enabled", () => {
    expect(sensitiveIwmChange({ kill_switch: true }, { enabled: true })).toBe(true);
    expect(sensitiveIwmChange({ kill_switch: true }, { kill_switch: false })).toBe(true);
    expect(sensitiveIwmChange({ kill_switch: false }, { kill_switch: true })).toBe(false);
  });
  it("requires confirmation for each bot risk limit change", () => {
    for (const key of ["max_daily_loss", "stop_loss_pct", "max_trades_per_day", "force_exit_time"]) expect(sensitiveIwmChange({ [key]: 100 }, { [key]: 50 })).toBe(true);
    expect(sensitiveIwmChange({ max_daily_loss: 100 }, { max_daily_loss: 100 })).toBe(false);
  });
});