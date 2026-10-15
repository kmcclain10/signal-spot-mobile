import { describe, it, expect } from "vitest";
import { phaseForNyHour } from "@/lib/server/scan.server";

describe("scan schedule (New York time)", () => {
  it("runs pre-market at 9am", () => expect(phaseForNyHour(9)).toBe("premarket"));
  it("runs 30 min after open at 10am", () => expect(phaseForNyHour(10)).toBe("open"));
  it("runs at 2pm", () => expect(phaseForNyHour(14)).toBe("afternoon"));
  it("skips other hours", () => expect(phaseForNyHour(12)).toBeNull());
});
