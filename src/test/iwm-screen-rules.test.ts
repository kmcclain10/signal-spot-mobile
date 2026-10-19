import { describe,it,expect } from "vitest";
import {iwmSettingsInput,iwmScreenStatus,journalDay,journalColumns} from "@/lib/iwm-screen-rules";
describe("IWM screen rules",()=>{
  it("supports the requested bar intervals",()=>{for(const timeframe_min of [1,2,4,5,10]) expect(iwmSettingsInput.parse({timeframe_min})).toEqual({timeframe_min});expect(iwmSettingsInput.safeParse({timeframe_min:3}).success).toBe(false);});
  it("does not allow starting bankroll or bank trigger edits",()=>{expect(iwmSettingsInput.safeParse({starting_bankroll:300}).success).toBe(false);expect(iwmSettingsInput.safeParse({bank_trigger:1000}).success).toBe(false);});
  it("does not permit exit later than 15:50",()=>{expect(iwmSettingsInput.safeParse({force_exit_time:"15:50"}).success).toBe(true);expect(iwmSettingsInput.safeParse({force_exit_time:"15:51"}).success).toBe(false);});
  it("waits until 10 ET",()=>{expect(iwmScreenStatus(new Date("2026-10-19T13:59:00Z"),null,true).label).toBe("Waiting for 10:00 ET");});
  it("ends entry windows at 15 ET",()=>{expect(iwmScreenStatus(new Date("2026-10-19T19:00:00Z"),null,true).label).toBe("Done for today");});
  it("shows seventh window and countdown",()=>{expect(iwmScreenStatus(new Date("2026-10-19T16:05:30Z"),{last_run_at:"2026-10-19T16:05:00Z"},true)).toEqual({label:"Scanning • Window 7/15",remaining:870});});
  it("keeps a position visible even when disabled",()=>{expect(iwmScreenStatus(new Date("2026-10-19T19:00:00Z"),{open_trade:{}},false).label).toBe("In trade");});
  it("filters journal dates in Eastern time",()=>{expect(journalDay({entry_time:"2026-10-20T01:00:00Z"},"Trades")).toBe("2026-10-19");});
  it("includes all five required journal sheets",()=>{expect(Object.keys(journalColumns)).toEqual(["Trades","Signals","Protection","Bank Events","Daily"]);});
});