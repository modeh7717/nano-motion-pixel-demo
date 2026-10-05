# Nano Motion

A fictional activewear storefront for the OpenAI Measurement Pixel demo. This release implements **Phases 1–5: Scaffold, Commerce, Membership, Consent and measurement, and Debugging and presentation** from [the technical design](./Nano%20Motion%20%E2%80%94%20Technical%20Design.md).

## What works

- Next.js App Router with TypeScript and plain responsive CSS.
- A home page, catalog, and three statically generated product detail pages.
- Product-to-cart actions, editable quantities, removal, and a persistent cart with a navigation count.
- Simulated checkout with persistent attempts, guarded submission, and immutable order snapshots.
- Order confirmation that restores the latest completed order without recreating it.
- A simulated $19/month membership with a saved enrollment, immutable plan snapshot, and guards that reuse the existing enrollment.
- Safe empty states for direct entry and in-memory fallbacks when browser storage is unavailable.
- Shared navigation, route metadata, branded 404s, keyboard focus styles, and a skip link.
- Local illustrations: SVG product artwork and a PNG runner illustration, with no external image or font dependency.
- Stable product IDs and prices stored as integer USD cents: `14800`, `11800`, and `6800`.
- Persisted measurement choices, a consent banner, footer revocation/reset, and cross-tab preference updates.
- A centralized, consent-gated OpenAI Pixel adapter and all six standard events with validated amounts and stable conversion IDs.
- A bounded local instrumentation inspector with payload details, suppression reasons, and SDK status.

Confirmation routes do not fabricate a successful outcome or resend conversions. Demo checkout and membership collect no personal or payment information and charge nothing.

## Develop

Use Node.js 24.19.0 (`.nvmrc`) and npm. This project requires Node.js 24 or newer so its domain tests can run TypeScript using Node's native type stripping.

```sh
cd /workspace/nano-motion-pixel-demo # or your local checkout
npm ci
npm run dev
```

The development server uses port 3000. No API keys, database, authentication, or payment service are needed. The supplied public demo Pixel ID is the default. To override it, copy `.env.example` to `.env.local`, edit `NEXT_PUBLIC_OPENAI_PIXEL_ID`, and restart/rebuild; Next.js inlines public configuration at build time. An explicitly empty ID disables initialization and records a local configuration error. Measurement requires acceptance of the on-page choice.

For the cloud machine, keep npm's cache in a writable directory:

```sh
npm ci --cache /workspace/.npm-cache
```

Use this task's existing checkout. Cloud tasks are already isolated; a separate Git worktree is unnecessary.

## Validate

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

`typecheck` generates Next.js route types before running TypeScript, so it works before the first build. Browser tests start and stop their own **production** server on port 3100 and require a successful build. They run 13 desktop scenarios and 2 focused mobile Chromium smoke tests; fast unit tests cover business edge cases. The cloud machine's `/usr/bin/chromium` is used automatically. Elsewhere, install a browser with `npx playwright install chromium` or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing compatible executable. Linux may additionally need Playwright's documented browser system dependencies.

ESLint is pinned to version 9 because the React rules bundled with the current `eslint-config-next` fail on ESLint 10. The lockfile pins the complete dependency tree.

See [TESTING.md](./TESTING.md) for the checks and remaining validation scope.

## Routes and structure

| Route                      | Current behavior                                                     |
| -------------------------- | -------------------------------------------------------------------- |
| `/`                        | Brand introduction, featured products, membership link               |
| `/shop`                    | Three-product catalog with USD prices                                |
| `/product/[slug]`          | Product information and related essentials; unknown slugs return 404 |
| `/cart`                    | Editable, persistent cart and exact USD totals                       |
| `/checkout`                | Simulated checkout; empty entry creates no attempt                   |
| `/order-confirmation`      | Latest saved order, or a safe no-order state                         |
| `/membership`              | Fictional $19/month plan; join or view the active demo membership    |
| `/membership-confirmation` | Saved enrollment, or a safe no-enrollment state                      |

`src/app` contains routes and global styles, `src/components` holds reusable UI, `src/data/products.ts` defines the typed catalog, and `src/lib/money.ts` handles USD presentation. All artwork is in `public/images`. Browser checks are in `tests/e2e`.

## Commerce state and persistence

A React context supplies a per-document commerce store through `useSyncExternalStore`. It restores browser data after hydration and never reads storage during server rendering. Shared state, shopping actions, and measurement connections live together in `src/components/commerce-provider.tsx`; record validation and calculations stay in `src/lib/commerce/model.ts`. Storage access is isolated in `src/lib/browser-storage.ts`. Native Node tests are in `tests/unit`.

The versioned `nano-motion:commerce:v1` record contains the cart, current checkout attempt, and latest completed order. Quantities, prices, per-line products, and summed totals must be positive safe integers. Cart restoration uses the current catalog; completed orders preserve their own price/quantity snapshot. Two jackets total `29600` cents ($296.00).

Direct checkout with a valid cart creates an attempt. Refresh and back/forward reuse it; explicitly beginning checkout again from the cart creates a new one. Cart edits invalidate the active attempt. Completion validates the attempt, guards submission synchronously, saves an immutable order, closes the attempt, and clears the cart in one storage write. Reprocessing the same attempt reuses its order. A new independent order needs a new valid cart and attempt.

Corrupt records restore safe empty states. Storage denial or quota failure leaves the journey functional in memory and displays a notice that refresh may lose the data. The saved state is a browser demo, with submission guards scoped to one document; it is not a backend order system or a cross-tab transaction service. Confirmation routes only read existing outcomes.

## Demo membership

The typed `nano-motion-plus-monthly` plan costs `1900` USD cents per month. Its benefits are fictional; joining does not change cart prices or shipping. The saved amount represents the simulated first monthly enrollment, without real billing or renewals.

A separate context and `nano-motion:membership:v1` storage record hold the enrollment ID, creation time, active status, and immutable plan snapshot. Shared state, enrollment actions, and the measurement connection live together in `src/components/membership-provider.tsx`; record validation stays in `src/lib/membership/model.ts`. Commerce and membership share primitive validators in `src/lib/validation.ts`. Enrollment never changes the cart or order record.

Joining saves the outcome before navigating to confirmation. Repeated clicks, returning to the plan page, and refresh reuse the existing enrollment. Confirmation only reads saved state. Corrupt records restore a safe empty state; storage denial and quota failure retain the enrollment in memory and disclose that refresh may lose it. These guards apply within the current document, as with commerce.

## Consent and measurement

`src/components/measurement-provider.tsx` contains the shared consent/dispatch state, route observer, and local observation log. `src/lib/measurement` keeps event types, pure payload builders, and the browser SDK driver in separate files. Commerce and membership announce successful new actions after committing their outcomes and attempting persistence, then call the shared measurement actions. UI components never call `oaiq` directly. Optional instrumentation failures cannot roll back shopping.

Consent is restored after hydration from `nano-motion:consent:v1`. Missing, corrupt, or unreadable preferences become `unknown`. Unknown and declined choices do not load the SDK. Accept/Decline controls have equal prominence; the footer can revoke consent or reset it to unknown. Storage failures retain the choice for this visit and display a notice. Changes in another tab close the measurement gate in this tab too.

On first acceptance, install the official queue stub, enqueue `consent(false)` before one `init`, and load the documented SDK URL. Only after successful loading, and while acceptance still holds, call `consent(true)` and measure the current eligible view once. The stub never receives measure calls during loading. Shopping actions and conversions before acceptance or during loading are suppressed without retention or replay. A script failure/timeout keeps shopping usable and disables dispatch for that document; refresh to retry. Revocation immediately closes the local gate and calls `consent(false)`. Already sent requests cannot be retracted; SDK batching and live revocation behavior still require the live checks in TESTING.

The route observer uses committed pathname changes. Returning through history creates a legitimate visit; rerenders, effect replay, and query/hash changes do not. Product routes use `contents_viewed`; the seven configured generic routes use `page_viewed`; unknown routes send neither. Direct checkout creates a business attempt once, but its event is suppressed if the SDK is still loading. Refresh and reused attempts never backfill or resend it.

| Event                  | Trigger                       | Value                                                |
| ---------------------- | ----------------------------- | ---------------------------------------------------- |
| `page_viewed`          | Eligible generic route visit  | Page ID/name; no amount                              |
| `contents_viewed`      | Resolved product visit        | One product and unit price                           |
| `items_added`          | Successful cart addition      | Added quantity delta and its value                   |
| `checkout_started`     | New nonempty checkout attempt | Complete attempt snapshot and total                  |
| `order_created`        | Newly saved simulated order   | Complete order snapshot and total                    |
| `subscription_created` | Newly saved enrollment        | `plan_enrollment`, plan ID, initial `1900` USD cents |

Checkout IDs use `checkout_<attempt ID>`, order IDs `order_<order ID>`, and membership IDs `subscription_<enrollment ID>` in the fourth argument's `event_id`. Two jackets report `29600` USD cents and quantity `2`; an add-one action reports `14800` and quantity `1`. Per-content amounts are omitted. No advanced matching, synthetic attribution identifiers, server conversions, or application replay queue are added. SDK debug logging is enabled in development.

## Local instrumentation inspector

The **Interaction log** launcher appears in the bottom-right corner in development or when the current production URL contains exactly `?measurementDebug=true`. Query changes do not create another route view. Storefront links and checkout/membership navigation retain the flag until you manually remove it from the current URL. The URL alone controls this behavior; no cookie or saved preference is added. SDK `debug: true` is selected in development or if the flag is present when the SDK initializes; later flag changes do not reinitialize it.

Open the launcher to show a floating, scrollable window; minimize it with its header button, the launcher, or Escape. It starts minimized and keeps observing while closed. The inspector shows timestamps, event names, IDs/names/quantities, amount/currency, stable event IDs, payload/options, consent, SDK status, and local failure messages. Its statuses are `suppressed`, `handed_to_sdk`, and `failed`, with a reason. There is no `queued` measurement status because loading-time actions are withheld rather than queued. The interaction log displays no HTTP badges. The official SDK batches events, uses opaque `no-cors` fetches or beacons, and exposes no per-event response callback. The app cannot read a trustworthy numeric response code; inspect actual batch responses in DevTools Network. SDK handoff is not receipt acknowledgment.

`src/components/measurement-provider.tsx` retains only the latest 100 validated observations in memory across client navigation, including while the panel is hidden. Invalid inputs are represented by event name/reason without raw data. Nothing is written to storage or used for retry/replay. Clear only clears diagnostics; refresh, revocation, or consent reset also clears them. Initial route observations wait until the saved consent preference is restored. With accepted consent, the current view waits for SDK readiness and is handed off once without a startup suppression entry. With unknown or declined consent, a current view may appear once as suppressed and later as handed off after acceptance; only the latter represents an SDK call. Payload disclosure belongs solely to this opt-in developer/demo UI.

## Design and OpenAI documentation review

The complete design and these official pages were reviewed on **October 3, 2026 (America/Los_Angeles)** and checked again on **October 4, 2026 (UTC)** for Phase 4:

- [Measurement Pixel](https://developers.openai.com/ads/measurement-pixel)
- [Supported Events](https://developers.openai.com/ads/supported-events)
- [Conversions API](https://developers.openai.com/ads/conversions-api)
- [Conversion Tracking](https://developers.openai.com/ads/conversion-tracking)

The six proposed events are supported: `page_viewed`, `contents_viewed`, `items_added`, `checkout_started`, `order_created`, and `subscription_created`. Commerce/view payloads use `type: "contents"`; subscription payloads use `type: "plan_enrollment"` and may include `plan_id`. Amounts and quantities are integers; an amount requires a currency. Pixel `event_id` belongs in the fourth argument, separate from the data object. Browser content items may use `id`, `name`, `content_type`, `quantity`, `amount`, and `currency`; `group_id` and `variant_dict` are server-only fields.

The docs still describe item-level `amount` without distinguishing unit price from line total. The design's decision to omit that optional field remains appropriate. The documented consent API is `oaiq("consent", false)` before initialization and `oaiq("consent", true)` after acceptance. Blocked events are not replayed. The SDK source is `https://bzrcdn.openai.com/sdk/oaiq.min.js`; transport uses `https://bzr.openai.com`. The application accesses the SDK only after acceptance.

**Loading decision:** the design describes queueing consented actions in section 6, but section 8 permits suppressing loading-time actions to avoid replay across revocation. This implementation follows that cautious alternative. Official docs confirm batching and blocked-event suppression but do not provide a queue-discard API. Automated integration checks use a controlled SDK response, so they prove application command ordering and payloads rather than actual SDK transport or receipt. The initial default-user-agent download returned HTTP 403 (Cloudflare error 1010); a browser-style user agent subsequently fetched the SDK with HTTP 200. Cloud Chromium separately fails direct SDK loading with `ERR_CERT_AUTHORITY_INVALID`. The downloaded official SDK was executed locally with intercepted transport responses, confirming readiness and page-view request generation; live receipt and SDK batch behavior across revocation remain unverified.

**Repository/design discrepancy:** the design's opening implementation note describes a completed browser integration and references README/TESTING files that were absent from the starting repository. This scaffold does not treat that note as proof of implemented functionality. The original design is preserved unchanged.

## Deployment and next phases

To deploy this scaffold on Vercel, import this repository, choose the Next.js framework preset, use `npm ci` for installation and `npm run build` for the build, and use a Node.js version supported by the manifest. No custom output directory or secrets are required. Deployment has not been performed or validated.

Phases 6–7 cover final QA and public deployment, including live SDK/network verification. The full design's acceptance criteria apply to the complete project.

Future server-side measurement would send confirmed outcomes through the Conversions API and reuse the Pixel ID, event name, and stable event ID for deduplication. It requires a backend and a server-held Conversions API key; browser code must never contain that key. No server integration is required for this demo.
