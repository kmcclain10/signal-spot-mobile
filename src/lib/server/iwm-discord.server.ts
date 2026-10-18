const COLORS: Record<string,number> = {"POTENTIAL ENTRY":0x7B7BFF,ENTRY:0x2ECC71,PROTECTED:0xF1C40F,EXIT:0xE74C3C,BANKED:0xA855F7,"DAILY REPORT":0x3B82F6};
export async function iwmDiscord(enabled:boolean,type:string,body:string) {
  const raw = process.env["DISCORD_WEBHOOK_URL"];
  if (!enabled || !raw) return;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !["discord.com","discordapp.com"].includes(url.hostname) || !url.pathname.startsWith("/api/webhooks/")) return;
    for (let attempt=0;attempt<2;attempt++) {
      const response = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Claude IWM Paper Trader",allowed_mentions:{parse:[]},embeds:[{title:`PAPER • ${type}`,description:body.slice(0,1500),color:COLORS[type] ?? COLORS.ENTRY,timestamp:new Date().toISOString()}]}),signal:AbortSignal.timeout(2000)});
      if (response.status !== 429) { await response.body?.cancel(); return; }
      const json = await response.json() as {retry_after?:number};
      // Bounded retry; never keep a scheduled trading run waiting on a notification.
      const delay = Number(json.retry_after)*1000;
      if (!Number.isFinite(delay) || delay>1000) return;
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay)));
    }
  } catch { console.warn("IWM Discord delivery unavailable"); }
}