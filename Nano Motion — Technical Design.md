# Nano Motion — Technical Design

## Scope and business goals

Nano Motion is a premium activewear retailer preparing for OpenAI advertising, international expansion, and a membership program. This demo connects shopping intent, simulated purchase value, and initial membership acquisition to six standard Pixel events.

**Live site:** https://nano-motion-pixel-demo.vercel.app/

**Stack:** Next.js App Router, React, TypeScript, responsive CSS; hosted on Vercel from GitHub `main`.

The site includes a homepage, three-product catalog, product pages, cart, checkout, order confirmation, and Nano Motion Plus enrollment/confirmation. Orders and the $19/month membership are simulated. All values are USD; there is no payment, authentication, database, billing, or Conversions API integration. Next.js renders HTML, while shopping state and measurement run in the browser.

## Architecture

The root layout nests `MeasurementProvider → CommerceProvider → MembershipProvider` around the shared header, consent banner, current page, footer, and inspector. Client navigation preserves these providers; a refresh or new tab creates new instances and restores saved browser records.

| File or area | Responsibility |
| --- | --- |
| [`src/app/layout.tsx`](./src/app/layout.tsx) | Shared page shell, providers, and public Pixel ID configuration. |
| [`commerce-provider.tsx`](./src/components/commerce-provider.tsx) | Cart, checkout, order state/actions, persistence, and measurement callbacks. |
| [`membership-provider.tsx`](./src/components/membership-provider.tsx) | Enrollment state/actions, persistence, and measurement callback. |
| [`measurement-provider.tsx`](./src/components/measurement-provider.tsx) | Consent, SDK readiness, route observation, event dispatch, and local diagnostics. |
| [`src/data`](./src/data), [`commerce/model.ts`](./src/lib/commerce/model.ts), [`membership/model.ts`](./src/lib/membership/model.ts) | Catalog/plan definitions, business records, validation, and calculations. |
| [`measurement/types.ts`](./src/lib/measurement/types.ts), [`event-builders.ts`](./src/lib/measurement/event-builders.ts) | TypeScript event contracts and validated standard payloads. |
| [`openai-pixel.ts`](./src/lib/measurement/openai-pixel.ts) | Loads the official SDK and calls its `init`, `consent`, and `measure` commands. |
| [`measurement-inspector.tsx`](./src/components/measurement-inspector.tsx) | Floating Interaction log for inspecting local observations. |

Business actions commit their outcomes and attempt persistence before calling measurement. The measurement provider uses event builders, checks consent/readiness, then calls the Pixel adapter. Builders never call the SDK. The SDK owns attribution cookies, batching, and network transport; the app implements no batch timer or direct measurement API requests. Measurement failures do not undo shopping actions.

## Measurement plan

`order_created` is the primary sales outcome; `subscription_created` measures membership acquisition separately. Supporting events reveal product interest and funnel drop-off. Their values represent intent, not additional revenue to sum with orders. Initial enrollment value is not lifetime value or recurring revenue.

| Standard event | Trigger and captured information | Business use |
| --- | --- | --- |
| `page_viewed` | Recognized general route; page ID/name. | Funnel entry and navigation. |
| `contents_viewed` | Product visit; product ID/name, quantity 1, price/currency. | Product interest. |
| `items_added` | Successful add; added quantity and its value. | Shopping intent. |
| `checkout_started` | New nonempty attempt; purchase snapshot and total. | Checkout intent/drop-off. |
| `order_created` | New simulated order; purchase snapshot and total. | Sales conversion/value. |
| `subscription_created` | New enrollment; plan ID and initial `1900` USD-cent value. | Membership acquisition. |

Product visits use `contents_viewed` instead of `page_viewed`. Committed pathname changes count as visits; rerenders and query/hash changes do not. Unknown routes send neither event.

Commerce/view payloads use `type: "contents"`; membership uses `type: "plan_enrollment"`. Amounts are integer currency minor units: two $148 jackets produce `amount: 29600`, `currency: "USD"`, and quantity `2`. Add events capture the added quantity, not the resulting cart. Optional per-item monetary fields are omitted. Checkout, order, and enrollment events carry stable `event_id` options in the fourth SDK argument, derived from saved outcome IDs.

## Consent and SDK lifecycle

1. Restore the saved preference after hydration. Unknown or declined consent does not load the SDK.
2. Accepted consent creates a temporary `window.oaiq` command queue, queues `consent(false)` then `init({pixelId, debug})`, and inserts the asynchronous [SDK script](https://bzrcdn.openai.com/sdk/oaiq.min.js) into the document's `<head>`.
3. Once the SDK replaces the stub, apply the current consent and measure the current eligible view once. Initial view observation waits for preference restoration and accepted SDK readiness.
4. Initialize once per browser document. A failed load or 12-second timeout leaves shopping functional; refresh to retry.

The queue holds startup/consent commands. Measurement events for business actions before acceptance or during loading are suppressed without retention or replay. Revocation/reset immediately closes dispatch, applies SDK consent false, and clears diagnostics. Cross-tab preference changes are observed; already sent requests cannot be retracted.

**Attribution limitation:** startup `consent(false)` can clear SDK `__obref`/`__oppref` cookies. Restoring accepted consent on a new document without `oppref` in the URL may lose a saved ad reference. Production startup and real ad-click persistence require correction/validation before attribution claims.

## Persistence and duplicate safeguards

Local Storage holds versioned `nano-motion:commerce:v1`, `nano-motion:membership:v1`, and `nano-motion:consent:v1` records. Records are validated on restoration; corrupt data yields safe empty/unknown states. Unavailable storage retains state in memory and warns that refresh may lose it.

Cart edits invalidate checkout attempts. Completed attempts and existing enrollments are reused; confirmation pages only read saved outcomes. Refresh/restoration creates no new conversions. Immutable purchase/plan snapshots and stable event IDs support duplicate prevention, with business guards scoped to the current document rather than cross-tab transactions.

## Demo and validation

In production, add `?measurementDebug=true` to open the bottom-right Interaction log launcher; internal navigation preserves the flag until removed. Development enables it automatically. The latest 100 observations stay in memory and show event payloads/options, consent, readiness, and `suppressed`, `handed_to_sdk`, or `failed` status. There are no HTTP badges; inspect SDK batch requests in DevTools Network.

[TESTING.md](./TESTING.md) documents lint, TypeScript/build checks, 41 unit tests, and 16 browser tests. Browser tests use a controlled SDK fixture. SDK handoff/request generation does not establish live OpenAI receipt, reporting, attribution, or advertising return.

## Recommended next steps

- Run a controlled campaign and reconcile confirmed outcomes, account reporting, spend, and return before scaling.
- Add authoritative backend purchase/billing outcomes and consider the Conversions API, keeping credentials server-side and reusing event IDs for browser/server deduplication.
- Extend currency handling and regional consent for international rollout; implement real membership billing and renewals with appropriate outcome measurement.

**Official references:** [Measurement Pixel](https://developers.openai.com/ads/measurement-pixel), [Supported Events](https://developers.openai.com/ads/supported-events), [Conversion Tracking](https://developers.openai.com/ads/conversion-tracking), and [Conversions API](https://developers.openai.com/ads/conversions-api). The latter informs future server measurement; it is not called by this demo.
