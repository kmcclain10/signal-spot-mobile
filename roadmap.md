# IWM 20-Min Window
- [x] Preserve supplied strategy and test its concrete rules.
- [x] Add user-owned strategy tables and atomic run locking.
- [x] Implement paper-only Alpaca scanning, fill reconciliation, exits, banking and reports.
- [x] Configure one-minute weekday schedule and verify real connected paper account, disabled defaults, saved $200 state, and rejected unauthenticated callbacks.
- [ ] Market-open quote and fill verification — waits for an open market; no real orders placed during testing.
- [ ] Discord notifications implemented — deferred at user's request; not a blocker.
- [ ] Strategy screen and authenticated paper enable/settings controls.
- [ ] Excel journal with date filter and mobile sharing.
- [ ] Diagnose live scheduled callback 404 and verify the live runner.