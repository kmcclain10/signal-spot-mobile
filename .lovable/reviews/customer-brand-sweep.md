# Customer branding and Apple sharing sweep

## Rule
Customers should see The Signal Spot as the platform name, with no Lovable promotional badge or template titles. Pulse remains an approved feature name. Apple Messages gets the homepage animation; other pages and apps retain still-image previews.

## Places reviewed
- Public homepage, strategy index and individual strategies: source reviewed; The Signal Spot titles and shared header. Homepage and trial link browser-checked on phone and desktop. The remaining unsupported “real-time” descriptions were corrected during this request.
- Contact, Terms, Privacy and Risk: source reviewed; company details, support address, shared header and legal footer follow the rule. Their public HTML and metadata were checked.
- Sign-in, signup and password recovery: source reviewed; shared wordmark and branded titles follow the rule. Trial navigation to sign-in was browser-checked. Managed OAuth integration identifiers are infrastructure, not promotional page copy; they remain unchanged.
- Member Home, Alerts, Bots, IWM, Activity/Orders, Trade, Explore, individual quotes, Playbook, Performance, Account/Settings, Connections, Plans and Admin: source reviewed; shared app wordmark/footer and individual branded titles follow the rule. These member flows were not rerun for this sweep.
- Account profile, password, disclosure, device unlock and locked screen: source reviewed; shared app branding or explicit The Signal Spot text follows the rule.
- Browser notifications, Firebase dispatcher, service worker and scheduled scan callback: source reviewed; messages name the actual strategy or IWM bot and use the site's icons and links, without Lovable promotion. Actual Firebase delivery is still blocked by the paused connection setup.
- Device installation: manifest and Apple head tags reviewed; names are The Signal Spot / Signal Spot. Existing installed labels cannot be updated by this sweep, and physical Apple installation was not tested.
- Share previews: root, all leaf heads, social-head normalizer, homepage video pointer and legacy redirects reviewed. Homepage-only video tags, still-image preservation, downloadable MP4 and Chromium playback were verified. Native Apple Messages rendering remains untested; next publish is required.
- Billing checkout/portal, Stripe client and webhook: source reviewed; approved product names and prices remain unchanged. Connector identifiers and metadata keys are infrastructure. Externally hosted Stripe branding/receipts were not checked or altered.
- Database migrations and stored roles, preferences, subscription and push functions: source read/search found no customer-facing Lovable promotional copy. Existing customer settings, permissions, examples and settled records were left untouched.
- Auth emails: no locally authored customer email templates were found; hosted email templates and actual confirmation/recovery email branding remain unverified.
- Published badge: settings read confirms it is hidden. Project monitoring reported no pending findings. Quick security check found no new actionable findings; the deeper security scan is still running independently.

## Outcome
No additional branding violations were found in this expanded source sweep. Necessary managed service dependencies, broker identifiers, product names, settings, permissions and settled records were preserved. Prior verification: 231 regression tests passed; follow-up metadata tests passed; latest preview build reports OK.