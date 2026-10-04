# Nano Motion

A fictional activewear storefront for the OpenAI Measurement Pixel demo. This release implements **Phase 1 — Scaffold**, **Phase 2 — Commerce**, and **Phase 3 — Membership** from [the technical design](./Nano%20Motion%20%E2%80%94%20Technical%20Design.md).

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

Consent, Pixel integration, and the event inspector belong to later phases. Confirmation routes do not fabricate a successful outcome. No measurement SDK is loaded, and no measurement requests are sent in this release. Demo checkout and membership collect no personal or payment information and charge nothing.

## Develop

Use Node.js 24.19.0 (`.nvmrc`) and npm. This project requires Node.js 24 or newer so its domain tests can run TypeScript using Node's native type stripping.

```sh
cd /workspace/nano-motion-pixel-demo # or your local checkout
npm ci
npm run dev
```

The development server uses port 3000. No environment variables, API keys, database, authentication, or payment service are needed. `.env.example` reserves the public Pixel ID for Phase 4; setting it does not enable measurement in this release.

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

`typecheck` generates Next.js route types before running TypeScript, so it works before the first build. Browser tests start and stop their own **production** server on port 3100 and require a successful build. They cover both desktop and mobile Chromium. The cloud machine's `/usr/bin/chromium` is used automatically. Elsewhere, install a browser with `npx playwright install chromium` or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing compatible executable. Linux may additionally need Playwright's documented browser system dependencies.

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

A React context supplies a per-document commerce store through `useSyncExternalStore`. It restores browser data after hydration and never reads storage during server rendering. Domain behavior lives in `src/lib/commerce`; storage access is isolated in `src/lib/browser-storage.ts`. Native Node tests are in `tests/unit`.

The versioned `nano-motion:commerce:v1` record contains the cart, current checkout attempt, and latest completed order. Quantities, prices, per-line products, and summed totals must be positive safe integers. Cart restoration uses the current catalog; completed orders preserve their own price/quantity snapshot. Two jackets total `29600` cents ($296.00).

Direct checkout with a valid cart creates an attempt. Refresh and back/forward reuse it; explicitly beginning checkout again from the cart creates a new one. Cart edits invalidate the active attempt. Completion validates the attempt, guards submission synchronously, saves an immutable order, closes the attempt, and clears the cart in one storage write. Reprocessing the same attempt reuses its order. A new independent order needs a new valid cart and attempt.

Corrupt records restore safe empty states. Storage denial or quota failure leaves the journey functional in memory and displays a notice that refresh may lose the data. The saved state is a browser demo, with submission guards scoped to one document; it is not a backend order system or a cross-tab transaction service. Confirmation routes only read existing outcomes.

## Demo membership

The typed `nano-motion-plus-monthly` plan costs `1900` USD cents per month. Its benefits are fictional; joining does not change cart prices or shipping. The saved amount represents the simulated first monthly enrollment, without real billing or renewals.

A separate context and `nano-motion:membership:v1` storage record hold the enrollment ID, creation time, active status, and immutable plan snapshot. Domain behavior lives in `src/lib/membership`; commerce and membership share primitive validators in `src/lib/validation.ts`. Enrollment never changes the cart or order record.

Joining saves the outcome before navigating to confirmation. Repeated clicks, returning to the plan page, and refresh reuse the existing enrollment. Confirmation only reads saved state. Corrupt records restore a safe empty state; storage denial and quota failure retain the enrollment in memory and disclose that refresh may lose it. These guards apply within the current document, as with commerce.

## Design and OpenAI documentation review

The complete design and these official pages were reviewed on **October 3, 2026 (America/Los_Angeles)**:

- [Measurement Pixel](https://developers.openai.com/ads/measurement-pixel)
- [Supported Events](https://developers.openai.com/ads/supported-events)
- [Conversions API](https://developers.openai.com/ads/conversions-api)
- [Conversion Tracking](https://developers.openai.com/ads/conversion-tracking)

The six proposed events are supported: `page_viewed`, `contents_viewed`, `items_added`, `checkout_started`, `order_created`, and `subscription_created`. Commerce/view payloads use `type: "contents"`; subscription payloads use `type: "plan_enrollment"` and may include `plan_id`. Amounts and quantities are integers; an amount requires a currency. Pixel `event_id` belongs in the fourth argument, separate from the data object. Browser content items may use `id`, `name`, `content_type`, `quantity`, `amount`, and `currency`; `group_id` and `variant_dict` are server-only fields.

The docs still describe item-level `amount` without distinguishing unit price from line total. The design's decision to omit that optional field remains appropriate. The documented consent API is `oaiq("consent", false)` before initialization and `oaiq("consent", true)` after acceptance. Blocked events are not replayed; batching means loading/revocation behavior still needs runtime testing in Phase 4. The SDK source is `https://bzrcdn.openai.com/sdk/oaiq.min.js`; transport uses `https://bzr.openai.com`. Neither destination is accessed by this release.

**Repository/design discrepancy:** the design's opening implementation note describes a completed browser integration and references README/TESTING files that were absent from the starting repository. This scaffold does not treat that note as proof of implemented functionality. The original design is preserved unchanged.

## Deployment and next phases

To deploy this scaffold on Vercel, import this repository, choose the Next.js framework preset, use `npm ci` for installation and `npm run build` for the build, and use a Node.js version supported by the manifest. No custom output directory or secrets are required. Deployment has not been performed or validated.

Phase 4 adds consent and the centralized Pixel adapter; Phase 5 adds the local event inspector. Stable order and enrollment IDs are retained now so later conversion event IDs can be derived from the persisted outcomes. The full design's acceptance criteria apply to the complete project, including its later measurement phases.

Future server-side measurement would send confirmed outcomes through the Conversions API and reuse the Pixel ID, event name, and stable event ID for deduplication. It requires a backend and a server-held Conversions API key; browser code must never contain that key. No server integration is required for this demo.
