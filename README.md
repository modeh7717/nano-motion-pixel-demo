# Nano Motion

A fictional activewear storefront for the OpenAI Measurement Pixel demo. This release implements **Phase 1 — Scaffold** from [the technical design](./Nano%20Motion%20%E2%80%94%20Technical%20Design.md).

## What works

- Next.js App Router with TypeScript and plain responsive CSS.
- A home page, catalog, and three statically generated product detail pages.
- All planned commerce and membership routes, with honest empty states and a disabled enrollment control.
- Shared navigation, route metadata, branded 404s, keyboard focus styles, and a skip link.
- Original SVG illustrations served locally, with no external image or font dependency.
- Stable product IDs and prices stored as integer USD cents: `14800`, `11800`, and `6800`.

Cart actions, persistence, simulated orders, membership enrollment, consent, Pixel integration, and the event inspector belong to later phases. Confirmation routes do not fabricate a successful outcome. No measurement SDK is loaded, and no measurement requests are sent in Phase 1.

## Develop

Use Node.js 24.19.0 (`.nvmrc`) and npm. Next.js requires Node.js 20.9 or newer.

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
npm run build
npm run test:e2e
```

`typecheck` generates Next.js route types before running TypeScript, so it works before the first build. Browser tests start and stop their own **production** server on port 3100 and require a successful build. They cover both desktop and mobile Chromium. The cloud machine's `/usr/bin/chromium` is used automatically. Elsewhere, install a browser with `npx playwright install chromium` or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing compatible executable. Linux may additionally need Playwright's documented browser system dependencies.

ESLint is pinned to version 9 because the React rules bundled with the current `eslint-config-next` fail on ESLint 10. The lockfile pins the complete dependency tree.

See [TESTING.md](./TESTING.md) for the checks and remaining validation scope.

## Routes and structure

| Route                      | Phase 1 behavior                                                     |
| -------------------------- | -------------------------------------------------------------------- |
| `/`                        | Brand introduction, featured products, membership link               |
| `/shop`                    | Three-product catalog with USD prices                                |
| `/product/[slug]`          | Product information and related essentials; unknown slugs return 404 |
| `/cart`                    | Empty cart and collection link                                       |
| `/checkout`                | Empty checkout; no form or submission                                |
| `/order-confirmation`      | No-order state                                                       |
| `/membership`              | Fictional $19/month plan; enrollment disabled                        |
| `/membership-confirmation` | No-enrollment state                                                  |

`src/app` contains routes and global styles, `src/components` holds reusable UI, `src/data/products.ts` defines the typed catalog, and `src/lib/money.ts` handles USD presentation. All original artwork is in `public/images`. Browser checks are in `tests/e2e`.

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

Phase 2 adds cart state, safe localStorage restoration, checkout attempts, and simulated orders. Phase 3 adds demo enrollment. Phase 4 adds consent and the centralized Pixel adapter; Phase 5 adds the local event inspector. The full design's acceptance criteria apply to the complete project, not to this initial scaffold.

Future server-side measurement would send confirmed outcomes through the Conversions API and reuse the Pixel ID, event name, and stable event ID for deduplication. It requires a backend and a server-held Conversions API key; browser code must never contain that key. No server integration is required for this demo.
