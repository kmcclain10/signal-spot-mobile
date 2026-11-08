import { describe, it, expect } from "vitest";
import { requireIwmAccount } from "@/lib/iwm-engine-rules";
import { sensitiveIwmChange } from "@/lib/account-rules";

const conn = (environment: string) => ({ provider: "alpaca", environment, config: {} });

describe("paper vs live routing", () => {
  it("live mode uses the live Alpaca endpoint", () => {
    expect(requireIwmAccount(conn("live"), "live")).toBe("https://api.alpaca.markets");
  });
  it("paper mode refuses a live connection", () => {
    expect(() => requireIwmAccount(conn("live"), "paper")).toThrow();
  });
  it("live mode refuses a paper connection", () => {
    expect(() => requireIwmAccount(conn("paper"), "live")).toThrow();
  });
  it("switching to live needs password confirmation", () => {
    expect(sensitiveIwmChange({ trading_env: "paper" }, { trading_env: "live" })).toBe(true);
    expect(sensitiveIwmChange({ trading_env: "live" }, { trading_env: "paper" })).toBe(false);
  });
});
