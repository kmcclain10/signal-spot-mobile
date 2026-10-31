import { describe, it, expect } from "vitest";
import { iwmForceExitAt, openingRange } from "@/lib/iwm-engine-rules";
import { crossEntry } from "@/lib/iwm-trade-policy";
import { iwmConfigFor } from "@/lib/iwm-config";
const cfg=iwmConfigFor({});
const row=(t:string,c:number,bull=true)=>({t,c,o:c,h:c,l:c,v:1,bullCross:bull,bearCross:!bull} as any);
describe("3:40 close-out and opening range filter",()=>{
  it("sells by 3:40 PM ET even if setting says 3:50",()=>{expect(iwmForceExitAt("15:50",960)).toBe(940);});
  it("sells 20 minutes before an early 1 PM close",()=>{expect(iwmForceExitAt("15:40",780)).toBe(760);});
  const bars=[{t:"2026-10-19T13:30:00Z",o:280,h:281,l:279,c:280,v:1},{t:"2026-10-19T13:59:00Z",o:280,h:280.5,l:279.5,c:280,v:1}] as any;
  const orb=openingRange(bars,"2026-10-19");
  it("opening range is 9:30–10:00 high/low",()=>{expect(orb).toEqual({high:281,low:279});});
  it("10:00 window CALL needs close above range high",()=>{
    expect(crossEntry(row("2026-10-19T14:05:00Z",280.9),new Set(),cfg,orb)).toHaveLength(0);
    expect(crossEntry(row("2026-10-19T14:05:00Z",281.2),new Set(),cfg,orb)).toHaveLength(1);
  });
  it("10:00 window PUT needs close below range low",()=>{expect(crossEntry(row("2026-10-19T14:05:00Z",278.8,false),new Set(),cfg,orb)).toHaveLength(1);});
  it("later windows ignore the opening range",()=>{expect(crossEntry(row("2026-10-19T15:05:00Z",280),new Set(),cfg,orb)).toHaveLength(1);});
});
