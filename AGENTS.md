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
