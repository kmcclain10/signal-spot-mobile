import { createFileRoute, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { PublicDocument } from '@/components/PublicDocument';
import { publicHead } from '@/lib/public-content';

const DESCRIPTION = 'How The Signal Spot optional bots follow published options rules in an Alpaca account you connect, including paper and live use, setup, and how to turn them off. Educational information, not personalized investment advice.';

export const Route = createFileRoute('/automation')({
  staticData: { sitemap: true },
  head: () => publicHead('How optional automation works', DESCRIPTION, '/automation'),
  component: AutomationPage,
});

function Source({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{children}</a>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 border-t border-border pt-6"><h2 className="text-xl font-semibold text-foreground">{title}</h2>{children}</section>;
}

function AutomationPage() {
  return <PublicDocument title="How optional automation works" updated="November 21, 2026">
    <aside aria-label="Options trading risk" className="space-y-3 border-l-4 border-warning bg-muted p-5">
      <h2 className="flex items-center gap-2 font-semibold text-foreground"><AlertTriangle className="size-5 shrink-0 text-warning" />Options trading risk</h2>
      <p>Educational information only, not personalized investment advice. Past signals do not guarantee future results. Options trading involves substantial risk of loss, including loss of all money used to trade. You can lose money in paper practice if you later use the same rules with real funds. You stay responsible for your brokerage account, permissions, positions, and orders.</p>
    </aside>
    <p>We publish rule-based options alerts. The setups are for listed calls and puts, not a stock-only or share-buying product. Alerts Only does not place orders. Full AI Bot Assistance is an optional add-on for published-rule automation that can follow entry and exit rules in an Alpaca account you open and connect. We do not take custody of your brokerage funds. You can leave a bot off, run it in paper, or disconnect the account. This page explains how that works. It is not a recommendation to enable automation, to open a brokerage account, or to trade options.</p>

    <aside aria-label="You control the account" className="space-y-3 border-l-4 border-primary bg-muted p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground"><ShieldCheck className="size-5 shrink-0 text-primary" />You control the account</h2>
      <p>If you use optional automation, the Alpaca account is yours. Approval, funding, options permissions, deposits, withdrawals, statements, and official positions and orders are handled by Alpaca Securities LLC, not by us. The Signal Spot is not Alpaca; Alpaca did not develop or endorse this app.</p>
      <p>You can turn a bot off and delete the connection in the member Connections page at any time. Turning a bot off or deleting a connection does not guarantee that working orders are canceled or open positions closed immediately. Check your Alpaca dashboard for authoritative orders and positions, and close or cancel anything that remains.</p>
      <p>If you only use alerts, you may use a broker of your choice. That account is also yours, and that broker handles permissions, balances, and orders. For The Signal Spot access or billing, email <a href="mailto:support@thesignalspot.com" className="text-primary underline">support@thesignalspot.com</a>. Do not email passwords, payment card details, or brokerage secret keys. For balances, deposits, execution, or account-specific trading questions, contact your broker.</p>
    </aside>

    <Section title="Built around options">
      <p>The service is built around call and put setups. There is no mode that buys or sells only shares in place of those options. To trade the setups described in the alerts, you need an options-enabled brokerage account approved to buy calls and puts, which Alpaca and many other brokers describe as options Level 2. Other brokers may use the same or different names.</p>
      <p>This applies to Alerts Only as well as to subscribers who later use a bot. You do not have to open or connect Alpaca to receive alerts. Optional automation is built for a connected Alpaca account; live options orders need Alpaca’s Level 2 approval to buy a call or put. Per Alpaca, paper accounts have options capability enabled by default; live approval is Alpaca’s decision. We do not grant brokerage permissions. This is not a recommendation to apply for approval or trade.</p>
      <p>See <Source href="https://docs.alpaca.markets/us/docs/options-trading">Alpaca’s options levels</Source>.</p>
    </Section>

    <Section title="What published-rule bots do — and do not do">
      <p>Bots follow the published rules for the strategy you enable, plus the settings you configure in the member area. They do not give personalized recommendations, change rules mid-trade to suit your circumstances, or guarantee a profit, an execution price, or a fill.</p>
      <p>Alerts can be delayed, missed, or wrong. An alert does not choose or verify an option contract for someone trading manually. Automation, if enabled, may place, change, or cancel options orders in your connected Alpaca account. You remain responsible for monitoring exposure, including when the site is unavailable.</p>
    </Section>

    <Section title="Paper and live">
      <p>Anyone considering automation should start in a paper (simulated) account and keep live trading off until they understand the rules, fills, and off switches. This is general education, not a personal recommendation.</p>
      <ul className="list-disc space-y-3 pl-5">
        <li>The IWM 9/20 Momentum bot can run in the paper or live Alpaca account you select in the member area. Switching to live places real-money options orders. The member screen warns that there is no stop loss.</li>
        <li>The other 10 bots — Opening Bell, VWAP Reclaim, Trend Rider, Squeeze Fire, Dip Buyer, Momentum Cross, Band Bounce, Trend Flip, Breakout 20, and The Scalpers — are paper-only. They will not place live orders.</li>
        <li>Paper trading does not fully reflect live liquidity, slippage, queue position, market impact, or regulatory fees. Paper results are not live results. See <Source href="https://docs.alpaca.markets/us/docs/paper-trading">Alpaca’s simulation limits</Source>.</li>
      </ul>
    </Section>

    <Section title="Open an Alpaca account">
      <p>This applies only if you want optional automation. We do not open the account for you and have no referral or revenue-share arrangement with Alpaca. Create your account directly with Alpaca. Alerts Only subscribers who are not using a bot may skip this step and use their own broker, with that broker’s options approval if they choose to trade.</p>
      <p>Alpaca states that anyone globally can create a paper-only account by signing up with an email. A new paper account starts with a simulated $100,000 balance; Alpaca describes opening a new paper account to replace that balance. Paper is a simulation, not a funded brokerage account.</p>
      <p>Live trading requires separate onboarding with Alpaca Securities LLC, a FINRA member and SEC-registered broker-dealer. Alpaca supports individual taxable brokerage accounts and does not currently support retirement accounts. Eligibility, identity verification, and funding are decided by Alpaca. Not every country is supported, and US and non-US residents follow different guides. Use Alpaca’s current application and support pages; requirements can change.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li><Source href="https://app.alpaca.markets/signup">Alpaca signup</Source> and <Source href="https://docs.alpaca.markets/us/docs/paper-trading">paper trading</Source></li>
        <li><Source href="https://alpaca.markets/learn/live-trading-account-us-resident">US resident live-account guide</Source></li>
        <li><Source href="https://alpaca.markets/learn/live-trading-account-non-us">Non-US resident live-account guide</Source></li>
        <li><Source href="https://alpaca.markets/support/requirements-alpaca-brokerage-account">Who can apply</Source> and <Source href="https://alpaca.markets/support/countries-alpaca-is-available">country availability</Source>. Alpaca asks applicants to contact support@alpaca.markets to confirm country questions.</li>
        <li><Source href="https://alpaca.markets/learn/connect-to-alpaca-api">How to get API keys</Source> and <Source href="https://alpaca.markets/learn/start-paper-trading">start paper trading</Source></li>
      </ul>
      <p>Alpaca’s guides describe identity details, a government-issued ID, tax information, financial profile information, required agreements, and identity verification such as a live selfie. Alpaca also requires multi-factor authentication. After approval, US residents can generally fund by ACH or wire; funding methods elsewhere are set by Alpaca. Its US resident guide currently states no minimum deposit to open an individual account, while accounts generally need at least $2,000 in equity to use margin leverage.</p>
    </Section>

    <Section title="Connect your account in The Signal Spot">
      <p>With a Signal Spot account on Full AI Bot Assistance — optional published-rule automation — or a trial that includes it, sign in and open Connections in the member area. The current connection uses an API Key ID and Secret Key you enter, not OAuth or one-click Alpaca Connect.</p>
      <ol className="list-decimal space-y-3 pl-5">
        <li>Choose Alpaca as the broker connection.</li>
        <li>Select Paper or Live to match the keys. Paper keys and live keys are different. Live keys in a live environment can place real-money orders.</li>
        <li>Paste your Alpaca API Key ID and Secret Key. Alpaca shows the secret when the key is created. Store it securely and do not share it. Never send secret keys to our support email, in a chat, or in a ticket.</li>
        <li>Save and test the connection. You can edit it, test it again, set it as the default broker, or delete it later.</li>
        <li>If you regenerate keys in Alpaca’s dashboard, the old keys stop working; update the connection here.</li>
      </ol>
      <p>Only if you connect an account do we process brokerage-connection data, including encrypted connection credentials and the account, position, and order information needed for the features you use, as described in our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.</p>
    </Section>

    <Section title="Turn it on, watch it, turn it off">
      <p>Once connected, use the member IWM screen for IWM and the member Bots screen for paper-only bots. A bot does nothing until you enable it. You can stay subscribed to the add-on and keep every bot off.</p>
      <p>For IWM, enable or disable the bot on the IWM screen. Stopping asks the runner to cancel its working order, sell its open position, and turn itself off. The IWM kill switch in Settings works in both paper and live. It stops new entries and asks the runner, at its next check, to cancel or close the bot’s own working order and position. Manual trades you place yourself are not affected. Check your Alpaca dashboard after stopping.</p>
      <p>For paper-only bots, add a paper bot and set allocation and session controls. You can stop and flatten it. A flatten request is carried out on the bot’s next market check, not instantly.</p>
      <p className="font-semibold text-foreground">A stop, kill switch, or deleted connection does not guarantee immediate cancellation or liquidation. Official orders and positions are in your Alpaca account.</p>
    </Section>

    <Section title="What orders may be placed">
      <p>See the full <Link to="/strategies" className="text-primary underline">published strategies</Link> and <Link to="/strategies/$slug" params={{ slug: 'iwm' }} className="text-primary underline">IWM rules</Link>.</p>
      <ul className="list-disc space-y-3 pl-5">
        <li>IWM, if enabled, buys at-the-money IWM call or put options after a confirmed 5-minute 9/20 EMA cross. Entries begin at 9:30 AM ET; no new entries after 3:00 PM ET.</li>
        <li>Size is at most half the available strategy balance, rounded down to whole contracts. There is no price stop.</li>
        <li>A trailing exit can arm after a peak gain of 50% and request a full exit if gain falls 10 percentage points below that peak. The +1000% maximum-gain exit rule is a ceiling, not a target or expected return.</li>
        <li>An opposite confirmed cross requests closing the IWM options position and opening the other direction.</li>
        <li>The bot requests liquidation by 3:40 PM ET, or earlier on shortened sessions. Orders may not fill in time. Options can lose substantial value before exit, including a total loss.</li>
      </ul>
      <p>The IWM bot uses a mix of market and limit order types intended to execute quickly. Fills are not guaranteed and may occur at prices different from the alert.</p>
      <p>The other 10 bots place paper options orders only, following published rules and your allocation, stop, take-profit, trailing, session, and flatten settings. They can be set to automatic paper orders or alerts only.</p>
    </Section>

    <Section title="Permissions, options approval, and margin">
      <p>Live IWM automation needs Alpaca approval for the options activity requested. Paper options are enabled by default; live accounts require options approval before their first options trade. Alpaca defines Level 0 as disabled; Level 1 as covered calls and cash-secured puts; Level 2 adds buying calls and puts; Level 3 adds buying call or put spreads. IWM buys calls and puts, listed at Level 2.</p>
      <p>The Signal Spot app does not block a live IWM order for lack of options approval. If the connected Alpaca account lacks the needed approval, Alpaca rejects the order and no position is opened. Approval is Alpaca’s decision; we do not grant brokerage permissions. Alerts Only subscribers trading elsewhere are responsible for their broker’s equivalent permission.</p>
      <p>Buying power, equity, and margin are determined by your broker. Insufficient buying power or a failed broker check can cause an order to be rejected.</p>
      <p>Alpaca says FINRA replaced the former Pattern Day Trader framework with an Intraday Margin Rule, and Alpaca lifted the PDT rule in production on June 4, 2026. Its current documentation says brokers no longer must count day-trade round trips or restrict accounts solely for more than three day trades in five days. The specific $25,000 day-trading equity minimum has been removed.</p>
      <p>Standard margin rules still apply. Alpaca says margin-enabled accounts typically need at least $2,000 in equity to use margin leverage and may receive intraday margin calls if they exceed available intraday margin. Options and frequent entries and exits can use substantial buying power and lose money. This is not tax or legal advice.</p>
      <p>Confirm current rules with Alpaca using its <Source href="https://docs.alpaca.markets/us/docs/the-intraday-margin-rule">Intraday Margin Rule documentation</Source> and <Source href="https://alpaca.markets/blog/finra-retires-the-pdt-rule-introducing-alpacas-new-intraday-margin-framework/">margin-framework explanation</Source>. Brokerage and regulatory rules can change. If you use a different broker for alerts, confirm that firm’s current options and margin rules.</p>
    </Section>

    <Section title="Subscriptions and broker fees">
      <p>Alerts Only is $49/month or $490/year. Full AI Bot Assistance — optional published-rule automation — is $99/month or $990/year, after any applicable 7-day card-required trial. Our subscription does not include brokerage commissions, regulatory fees, or market-data fees charged by Alpaca or another broker.</p>
      <p>Alpaca currently describes commission-free trading for retail self-directed individual accounts trading US-listed securities and equity options through its API. Regulatory fees still apply; index options and some routes can carry commissions, and authorized-partner or non-retail order flow may be priced differently. We are not an Alpaca authorized business partner for account opening and do not set Alpaca’s fees. Paper trading does not simulate regulatory fees.</p>
      <p>Alpaca’s schedule lists pass-through categories such as the Options Regulatory Fee, OCC clearing fee, FINRA trading-activity and CAT fees, and an SEC transaction fee for equity sales. Check broker confirmations and the current schedule; other brokers set their own fees.</p>
      <p>Current sources: <Source href="https://alpaca.markets/disclosures">disclosures</Source>, <Source href="https://alpaca.markets/disclosures/commission-fees">commission and fee information</Source>, <Source href="https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf">broker fee schedule</Source>, and <Source href="https://docs.alpaca.markets/us/docs/regulatory-fees">regulatory fees</Source>.</p>
    </Section>

    <Section title="Common questions">
      <dl className="space-y-5">
        <div><dt className="font-semibold text-foreground">Do I have to use a bot?</dt><dd>No. Alerts Only never places automated orders. Even on Full AI Bot Assistance, optional published-rule bots stay off until you enable them.</dd></div>
        <div><dt className="font-semibold text-foreground">Do I need options approval if I only want alerts?</dt><dd>Not to receive alerts. To trade the call and put setups, you need an options-enabled account approved to buy calls and puts — Level 2 or your broker’s equivalent. You do not have to connect Alpaca to receive alerts. This is not a recommendation to trade.</dd></div>
        <div><dt className="font-semibold text-foreground">Can I use a broker other than Alpaca?</dt><dd>Yes, for alerts. Current optional automation requires an Alpaca account you connect.</dd></div>
        <div><dt className="font-semibold text-foreground">Is there a mode that only buys shares?</dt><dd>No. The service is built around options.</dd></div>
        <div><dt className="font-semibold text-foreground">What if Alpaca has not approved my account to buy calls and puts?</dt><dd>The app does not block the order. Alpaca rejects it and no position is opened. Approval is Alpaca’s decision.</dd></div>
        <div><dt className="font-semibold text-foreground">Can I start without funding a live account?</dt><dd>Yes. Paper accounts are simulated and do not use real money. Live trading needs the broker’s live-account approval and funding.</dd></div>
        <div><dt className="font-semibold text-foreground">What if I already have an Alpaca account?</dt><dd>Connect it with the correct paper or live API keys, if Alpaca makes those keys available and the account has the permissions you intend to use.</dd></div>
        <div><dt className="font-semibold text-foreground">What about international subscribers?</dt><dd>Alpaca describes paper signup as broadly available. Live eligibility depends on Alpaca and your country of residence; check its guides and support. For alerts at another broker, check that firm’s eligibility rules.</dd></div>
        <div><dt className="font-semibold text-foreground">Is this investment advice?</dt><dd>No. Published-strategy alerts use the same rules for subscribers who select the same settings.</dd></div>
      </dl>
    </Section>

    <Section title="Read before enabling automation">
      <p>Options can expire worthless. Some strategies have no price stop. Only money you can afford to lose should be used.</p>
      <nav aria-label="Automation disclosures" className="flex flex-wrap gap-x-5 gap-y-2 text-primary underline">
        <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/risk">Risk disclosure</Link><Link to="/strategies">Strategies</Link><Link to="/strategies/$slug" params={{ slug: 'iwm' }}>IWM rules</Link><Link to="/contact">Contact</Link><Source href="https://alpaca.markets/disclosures">Alpaca disclosures</Source>
      </nav>
    </Section>
  </PublicDocument>;
}