# IWM 20-Min Window
- [x] Refresh stale runner access binding; closed-market run processed the enabled account (1 user, 0 errors), saved a fresh heartbeat, and passed 35 IWM tests. Next published market-hours callback still needs verification.
- [x] Market-day check: runner ran every minute and found 7 setups but no exact 3rd-candle entry on the free IEX feed (full SIP data would have entered one PUT at 12:08 ET; real-time SIP needs a paid Alpaca data plan). Screen now shows window ranges and bar close times.
- [x] Enable Kevin's account opt-in and verify it persists after reopening; active weekday schedule and published callback present (401 without credentials).
- [x] Preserve supplied strategy and test its concrete rules.
- [x] Add user-owned strategy tables and atomic run locking.
- [x] Implement paper-only Alpaca scanning, fill reconciliation, exits, banking and reports.
- [x] Configure one-minute weekday schedule and verify real connected paper account, disabled defaults, saved $200 state, and rejected unauthenticated callbacks.
- [ ] Market-open quote and fill verification — waits for an open market; no real orders placed during testing.
- [ ] Discord notifications implemented — deferred at user's request; not a blocker.
- [x] Strategy screen and authenticated paper enable/settings controls; phone/desktop checks and saved settings verified.
- [x] Excel journal with date filter and mobile sharing; downloaded all five sheets with frozen headers. Native share handoff requires a supported phone.
- [x] Published scheduled callback is present and rejects unauthenticated requests (401); weekday one-minute managed schedule is active. Market-open execution remains to be verified.
- [x] Audit Fix B/C: broker position check, early-close entries, kill switch, $100 daily loss limit (default), 15s quote guard, run history, error log, Bot offline warning; 62 tests pass.
- [ ] Robinhood-style redesign P1–P8 — next, after paper-testing the safety fixes.
# Trade desk
- [x] Manual Options follow the selected stock/ETF; verified live SPY and IWM contracts on the phone-sized page, with 38 tests passing and no orders placed.
- [x] Trade tab: stock/ETF and IWM option tickets, positions with Close (bot positions handed to bot), working/recent orders with Cancel. Page verified on phone; no test order placed.
