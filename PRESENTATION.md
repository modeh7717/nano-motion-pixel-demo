# Nano Motion presentation

## Prepare the demo

Use Node.js 24, install with `npm ci`, and start `npm run dev`. Open the app through your local or hosting environment's normal access method. The supplied public Pixel ID is configured by default; use `.env.local` to override it. No Ads API or Conversions API credential is needed.

Use a fresh browser profile so the cart, consent, order, and membership start empty. In development, the **Local instrumentation log** appears below the footer on every route and the SDK initializes with `debug: true`. In production, append `?measurementDebug=true` to the current URL to reveal the inspector. Navigation links do not retain the query flag: append it again when inspecting the next route. The bounded log remains in memory across client navigation, so opening the panel later still shows recent observations. Changing the flag does not produce another view event.

Open DevTools Console and Network, enable preserve log, and filter Network by `bzrcdn.openai.com` and `bzr.openai.com`. In production, set the debug flag before accepting/restoring consent if you want SDK console debugging: the debug option is read at the document's one initialization and is not changed by later panel toggles. Refresh with the flag to start a new SDK initialization.

Confirm the official SDK can load before presenting live transport. The initial automated download was rejected with HTTP 403 (Cloudflare error 1010), while a browser-style user agent received HTTP 200. Direct cloud Chromium loading separately fails certificate verification (`ERR_CERT_AUTHORITY_INVALID`). The downloaded official SDK was verified to generate a page-view request with locally intercepted responses; that is not live receipt evidence. If your browser cannot load it, show the local failure and working commerce, then describe the integration tests accurately. Never present intercepted responses or mocked SDK calls as live OpenAI receipt.

## Suggested 20-minute walkthrough

| Time      | Show                                                                     | Explain                                                                                                     |
| --------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 0–3 min   | Home, three-product catalog, consent choice                              | A small commerce funnel with explicit measurement boundaries and no real billing                            |
| 3–8 min   | Accept, product view, add two jackets, cart, checkout, order             | Product interest, shopping intent, checkout intent, and a simulated completed order                         |
| 8–11 min  | Local log, SDK console, browser requests, confirmation refresh           | Separate application handoff from SDK activity and transport; conversion IDs remain tied to outcomes        |
| 11–14 min | Join Nano Motion Plus, refresh and revisit it                            | An initial monthly enrollment signal, with one saved membership and no recurring billing                    |
| 14–17 min | Revoke/reset consent and continue shopping; show blocked-script behavior | Shopping is independent of measurement; suppressed actions are never replayed                               |
| 17–20 min | Production architecture and evidence limits                              | Backend-confirmed outcomes, consent infrastructure, real campaign reporting, and evaluation are future work |

### Commerce sequence and values

1. Start with unknown consent. Show the equal Accept/Decline controls and the absence of an SDK request. Accept measurement and wait until the inspector reports **SDK: ready**. Acceptance measures the current eligible route once.
2. Open **Aero Run Jacket**. Its `contents_viewed` event reports product ID `NM-RUN-001`, quantity `1`, amount `14800`, currency `USD`. A product visit sends this event instead of an additional generic page view.
3. Add it twice. Each `items_added` reports a delta of `1` and amount `14800`, even though the cart now contains two jackets. The inspector shows these as two actions, not one resulting cart quantity.
4. Open cart and start checkout. `checkout_started` contains quantity `2` and total `29600` USD cents. It represents a newly created attempt; refresh/history reuse the attempt without resending it. Explicitly starting again from the cart creates a new attempt.
5. Complete the simulated order. `order_created` carries the same contents/total and fourth-argument `event_id: "order_<saved order ID>"`. The order was saved before handoff, and the cart is cleared. No payment or customer identity is collected.
6. Refresh confirmation. A new generic page visit is legitimate; a second purchase is not. The saved order ID and snapshot remain the same. The local log resets on refresh, so use preserved Console/Network evidence to compare before and after.

### Membership and consent sequence

1. Open Nano Motion Plus and join. `subscription_created` uses `type: "plan_enrollment"`, `plan_id: "nano-motion-plus-monthly"`, amount `1900`, currency `USD`, and `event_id: "subscription_<saved enrollment ID>"`. Explain $19 as the simulated first monthly enrollment value, not lifetime value or subsequent renewals.
2. Refresh confirmation and revisit the plan. “View your membership” reuses the same enrollment; neither action creates another subscription conversion. Benefits are fictional and do not change cart prices.
3. Use **Revoke measurement** in the footer. It closes the local gate, calls SDK consent false, and clears the diagnostic history. Add another product: the new local observation is `suppressed`, shopping still succeeds, and no new measure call is made.
4. Use **Change measurement preference** to reset to unknown; the banner reopens below the header. Decline or accept again. Previous actions and conversions are never reconstructed. A previously unmeasured current visit can be measured once after acceptance/readiness; an already measured visit is not counted again.
5. Optionally block or throttle the SDK in DevTools. Loading-time actions show `suppressed`; failure appears locally and commerce remains usable. There is no application retry/replay queue. Acceptance and readiness are prerequisites for new handoffs.

## What each signal answers

| Event                  | Business question                                             |
| ---------------------- | ------------------------------------------------------------- |
| `page_viewed`          | Which important storefront pages receive eligible engagement? |
| `contents_viewed`      | Which products attract explicit interest?                     |
| `items_added`          | Which products turn interest into shopping intent?            |
| `checkout_started`     | Which baskets reach checkout intent?                          |
| `order_created`        | Which completed orders and order values are represented?      |
| `subscription_created` | Which initial paid membership enrollments are represented?    |

Assess production funnel progression with appropriately scoped users/sessions or checkout attempts, not by dividing raw event counts: legitimate repeat visits and additions exist. USD cents are the demo's currency scope; international support must apply the relevant ISO currency minor unit.

## Explain the evidence precisely

| Observation                      | What it demonstrates                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `suppressed`                     | The application withheld a call due to consent, loading, or invalid data               |
| `handed_to_sdk`                  | The application called the loaded SDK locally; receipt remains unverified              |
| `failed`                         | A local SDK loading/configuration/dispatch failure                                     |
| SDK console output               | Activity observed inside the actual SDK when it can load                               |
| Browser request/response         | A transport attempt and available response; no attribution/reporting conclusion        |
| Authorized Ads account reporting | Separate account evidence needed to establish receipt/reporting or attributed outcomes |

The inspector never labels events as delivered. It stores at most 100 observations in memory and has no replay behavior. `queued` does not appear in this implementation: only consent/init commands use the documented loading stub; measure actions during loading are suppressed. SDK batching after handoff is a separate vendor concern, not an application-owned queue.

Revocation cannot retract a request already sent. Live SDK batch suppression and no replay across revocation must be checked with the real SDK; follow [TESTING.md](./TESTING.md). The sample banner is a technical consent demonstration, not a complete production CMP.

The Pixel handles real `oppref` attribution values automatically; do not fabricate one for the presentation. Real attribution, campaign reporting, CPA, or ROAS require campaign traffic, account reporting, and spend data. Optimization impact requires campaign delivery and evaluation. Simulated purchases and local logs do not establish those results.

For production, emit confirmed backend outcomes through a future Conversions API integration and reuse the same Pixel ID, event name, and stable event ID for browser/server deduplication. That requires a backend, server-held credentials, appropriate attribution capture, and a production consent design; it is not implemented by this browser demo. Public deployment also remains a later phase.
