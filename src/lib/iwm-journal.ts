import { supabase } from "@/integrations/supabase/client";
import { journalColumns, journalDay, type Journal } from "@/lib/iwm-screen-rules";

export async function loadIwmJournal(from = "", to = ""): Promise<Journal> {
  if (from && to && from > to) throw new Error("Start date must be before end date");
  const mappings = {Trades:"iwm_trades",Signals:"iwm_signals",Protection:"iwm_protection_events","Bank Events":"iwm_bank_events",Daily:"iwm_daily_reports"} as const;
  const entries = await Promise.all(Object.entries(mappings).map(async ([sheet,table])=> {
    const rows: Record<string,any>[] = [];
    const order = table === "iwm_trades" ? "entry_time" : table === "iwm_daily_reports" ? "day" : "created_at";
    for (let offset=0;;offset+=500) {
      const {data,error} = await supabase.from(table).select("*").order(order).order("id").range(offset,offset+499);
      if(error) throw new Error("Could not load the complete journal");
      rows.push(...data);
      if(data.length<500) break;
    }
    return [sheet,rows.filter(row=>{const day=journalDay(row,sheet as keyof Journal);return (!from||day>=from)&&(!to||day<=to);})];
  }));
  return Object.fromEntries(entries) as Journal;
}

export async function exportIwmJournal(journal: Journal, date: string) {
  // SheetJS supplies the canonical table data; ExcelJS applies styles and frozen panes.
  const [xlsx, excel] = await Promise.all([import("xlsx"),import("exceljs")]);
  const workbook = new excel.default.Workbook();
  for (const sheet of Object.keys(journalColumns) as (keyof Journal)[]) {
    const headers = [...journalColumns[sheet]];
    const canonical = xlsx.utils.json_to_sheet(journal[sheet],{header:headers});
    const matrix = xlsx.utils.sheet_to_json<(string|number|null)[]>(canonical,{header:1,defval:null});
    const ws = workbook.addWorksheet(sheet,{views:[{state:"frozen",ySplit:1}]});
    ws.addRows(matrix.length ? matrix : [headers]);
    ws.getRow(1).font={bold:true,color:{argb:"FFF1F5F9"}};
    ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17212E"}};
    ws.getRow(1).height=24;
    ws.columns.forEach(column=>{column.width=22;});
    ws.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
  }
  const bytes=await workbook.xlsx.writeBuffer();
  const file = new File([new Uint8Array(bytes)],`iwm_paper_journal_${date}.xlsx`,{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  if (navigator.canShare?.({files:[file]})) {
    try {await navigator.share({files:[file]});return;} catch(error) {if(error instanceof Error && error.name==="AbortError") return;}
  }
  const url=URL.createObjectURL(file), anchor=document.createElement("a");
  anchor.href=url;anchor.download=file.name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}