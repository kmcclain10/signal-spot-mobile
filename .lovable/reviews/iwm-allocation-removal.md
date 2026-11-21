# IWM allocation removal sweep

Rule: IWM wins must not buy, queue, or substitute any security. Other trade rules, permissions, settings, settled records and holdings remain unchanged.

- Public IWM page, public strategy adapter, shared member playbook: allocation rule removed; other rule strings unchanged. Public desktop/phone checks passed.
- Member IWM overview, Rules, Settings, Home and account disclosure: allocation section, purchase totals and purchase language removed. Journal balance is expressly cash-only. Signed-in owner desktop/phone checks passed without changing trading settings or placing orders.
- Trade completion, broker-reconciled closes, periodic open/closed-market runner: security purchase and queue functions/calls removed. Tests cover profitable paper/live closes, sub-$1 profits, restarts and old intents/queues. No actual broker orders submitted for verification.
- Scheduled callback and order adapter: code reviewed; callback calls the same amended IWM runner. Schedule unchanged. Existing option entry/exit submissions remain intact.
- Database checkpoint: allocation history writer retired and old purchase state preserved. Migration applied; readback confirms savings-event writer and retired-state assignments are absent. Current state has no legacy allocation intents; historical totals remain retained. No holdings were sold, history deleted or balances reset.
- Journal export, Activity, browser/Discord notifications, daily reports: source reviewed. No security-allocation export exists; journal-cash accounting remains. Future Activity/browser notification labels explicitly say cash-only accounting. Already-sent records are unchanged.
- Alerts, rankings, manual Trade and other bots: source search reviewed; WMT remains eligible as an ordinary market symbol, not an IWM profit purchase. Unrelated strategies, subscriptions and legal body text are unchanged.
- Protected supplied strategy math remains untouched. Regression tests retain cross, half-risk sizing, no stop, +50% activation / 10-point trailing exit, +1000% ceiling, reversal, and force-exit coverage.

Publication must ship the amended runner before live scheduled behavior changes. The completed separate security review found five unresolved warnings; no unrelated permissions or payment behavior were changed here. Native Apple Messages, hosted email/Stripe branding and actual Firebase push delivery remain unverified from the previous work.