<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- TypeScript runs with strict on but index-signature/unchecked-index/exact-optional flags off; trading payloads are loose JSON from brokers and the engine.
- Keep supplied IWM math isolated in src/lib/iwmWindowStrategy.ts; callers guard invalid or empty inputs without changing calculations.
- IWM automation uses managed TanStack callbacks and service-only atomic lease/checkpoint RPCs; persist order intents with broker client IDs before submissions to avoid duplicate exposure after interruption.
- IWM screen reads use authenticated query-backed server functions; subscribe to owner-filtered realtime changes and retain polling to detect stopped runners.
- IWM journal export is browser-only, paginates owner-visible rows and uses SheetJS table conversion plus ExcelJS formatting to retain frozen styled headers.
- Manual stock and option tickets share one selected underlying; pass it through quote and contract selection, while automated IWM callers keep the default underlying to preserve strategy behavior.
- IWM runs record bot_runs/bot_errors in a non-throwing finally block; monitoring writes must never interrupt order handling.
- The shared shell groups existing routes into five primary destinations and keeps Trade plus secondary pages accessible; UI redesign stages must reuse trading functions without changing broker or strategy behavior.
- Home portfolio reads use separate authenticated paper-only functions and foreground-aware queries; persist watchlist changes only to the owner's existing settings row, never fabricate missing broker prices or history.
- Explore uses authenticated read-only Alpaca asset and market functions; quote routes pass validated symbols and sides to the existing Trade desk, while market-wide screeners remain distinct from IEX quotes and unavailable data is explicitly labeled.
- Account sensitive updates are guarded by database triggers using verified password AMR timestamps; shared confirmation supplies fresh authentication across Account, Bots and IWM, without changing broker behavior.
- The shared shell owns first-launch disclosure acceptance and background device sign-out; home-screen support is manifest-only with no offline caching of trading data or credentials.
