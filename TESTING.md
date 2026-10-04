# Phase 1 validation

## Reproduce

From the repository root, with Node.js 24 and npm:

```sh
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Use `--cache /workspace/.npm-cache` with npm installation commands in the cloud machine. If Chromium is absent, run `npx playwright install chromium` first. The test config also accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and automatically uses `/usr/bin/chromium` when present.

The suite launches a production server on port 3100, runs eight scenarios at each of two viewport sizes (1440 × 1000 desktop and 390 × 844 mobile), then stops that server. It uses two workers and no automatic retries. A successful run executes **16 tests**; no tests are skipped.

## Automated coverage

- Home-to-catalog navigation and the three design-specified names, IDs, prices, and product links.
- Each product's detail route, local illustration, related products, and active navigation.
- The fictional $19/month membership with enrollment explicitly disabled.
- Direct access to cart, checkout, and both confirmation routes without fake success or data-collection forms.
- Unknown routes and product slugs returning an HTTP 404 with a usable return link.
- Every planned route loading its artwork and fitting the desktop/mobile viewport without horizontal overflow.
- No uncaught browser exceptions, external resource requests, Pixel global, or localStorage writes while browsing.
- Keyboard access to the skip link and main content.

The home-page tests save full-page desktop and mobile screenshots in their per-test `test-results` directories. Failures additionally produce screenshots and traces. These generated files are ignored by Git.

## Manual review

1. Start `npm run dev`, open the application using your development environment's normal access method, and inspect the home, shop, and all three product pages.
2. Review at desktop and mobile widths: readable text, usable navigation, artwork, product prices, and footer demo disclosure.
3. Tab through navigation, product cards, and links. Confirm visible focus and that “Skip to content” moves focus into main content.
4. Open cart, checkout, order confirmation, and membership confirmation directly. Each should show the appropriate empty state.
5. Open membership. Confirm enrollment is disabled and the plan is clearly fictional.
6. Visit an unknown product slug and an unknown route. Confirm the branded 404 and collection link.

## Verified in this cloud instance

The production build, ESLint, TypeScript, and all 16 Chromium scenarios passed. Desktop and mobile home-page screenshots were visually reviewed. Node.js was 24.19.0 and npm was 11.9.0. Development-server startup and representative route responses are also checked as part of environment setup.

## Documentation review and future measurement checks

Official Pixel, Supported Events, Conversions API, and Conversion Tracking documentation was read on **October 3, 2026 (America/Los_Angeles)**. The event names and schemas in the design agree with the current documentation; see README for the verification notes and the discrepancy in the design's opening implementation claim.

For the future quantity-two test: unit price is `14800`, quantity is `2`, and the event-level checkout/order amount is `29600` with `currency: "USD"`. The intended browser contents item is `{ id: "NM-RUN-001", name: "Aero Run Jacket", content_type: "product", quantity: 2 }`. Omit optional item-level `amount` and `currency` while their unit-versus-total meaning is unspecified. An add-one action reports quantity `1` and event amount `14800`, even when it produces a cart quantity of two. This describes the reviewed future contract; it is not an implemented or tested measurement payload in Phase 1.

Cart persistence, monetary-input validation, checkout-attempt boundaries, double-submit guards, order/enrollment persistence, consent, event builders, Pixel loading/revocation, SDK transport, conversion receipt, and deployment are **not yet implemented or validated**. The complete design's unit, integration, and manual measurement checklist must be applied in those phases. This release's browser checks establish scaffold behavior only. No attribution, campaign reporting, or ROAS result is claimed.
