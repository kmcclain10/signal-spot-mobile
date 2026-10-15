import { describe, expect, it } from "vitest";
import { positionSize } from "@/lib/format";
import { strategyName, barTime } from "@/lib/strategy-names";

describe("order sizing", () => {
  it("qty = floor(risk / |entry - stop|)", () => {
    expect(positionSize(50, 100, 98.5)).toBe(33);
  });
  it("minimum qty is 1", () => {
    expect(positionSize(50, 100, 20)).toBe(1);
  });
});

describe("strategy names", () => {
  it("names an ORB strategy in plain English", () => {
    expect(strategyName("orb(6)/L/stop0.3/2R")).toBe("30-min opening range breakout · Long · stop 0.3 ATR · target 2R");
  });
  it("maps bar index to time of day", () => {
    expect(barTime(12)).toBe("10:30am");
    expect(barTime(54)).toBe("2:00pm");
  });
});
