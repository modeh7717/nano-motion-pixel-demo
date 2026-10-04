# Phases 1–3 validation

## Reproduce

From the repository root, with Node.js 24 and npm:

```sh
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Use `--cache /workspace/.npm-cache` with npm installation commands in the cloud machine. If Chromium is absent, run `npx playwright install chromium` first. The test config also accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and automatically uses `/usr/bin/chromium` when present.

The browser suite launches a production server on port 3100, runs twenty-one scenarios at each of two viewport sizes (1440 × 1000 desktop and 390 × 844 mobile), then stops that server. It uses two workers and no automatic retries. A successful run executes **42 browser tests**. The domain suite runs **23 Node tests**. No tests are skipped.

## Automated coverage

- Home-to-catalog navigation and the three design-specified names, IDs, prices, and product links.
- Each product's detail route, local illustration, related products, and active navigation.
- The fictional $19/month membership with enabled enrollment, a stable ID, and an immutable `1900`-cent monthly plan snapshot.
- Direct access to cart, checkout, and both confirmation routes without fake success or data-collection forms.
- Unknown routes and product slugs returning an HTTP 404 with a usable return link.
- Every planned route loading its artwork and fitting the desktop/mobile viewport without horizontal overflow.
- No uncaught browser exceptions, external resource requests, Pixel global, or localStorage writes while browsing.
- Keyboard access to the skip link and main content.
- Add-to-cart, quantity edits, removal, persistence, invalid-quantity rejection, and exact multi-product totals.
- The quantity-two contract: two jackets retain unit price `14800`, quantity `2`, and total `29600` cents.
- Direct checkout, refresh/history reuse, explicit attempt restarts, and invalidation after cart edits.
- Rapid double submission, order persistence, cart clearing, immutable snapshots, and new independent orders.
- Corrupt, denied, and quota-limited browser storage; outcomes survive client navigation in memory and are not invented on refresh.
- Safe-integer arithmetic, including unsafe individual products and overflow when summing otherwise valid lines.
- Rapid double joins, return to the plan page, and confirmation refresh all reusing the same enrollment.
- Invalid enrollment schemas and amounts, denied storage, and quota failure restoring safe states with accurate persistence notices.
- Enrollment leaving existing cart and order data unchanged, without measurement requests.

The tests save full-page home, cart, checkout, order, membership, and enrollment confirmation screenshots in their per-test `test-results` directories. Failures additionally produce screenshots and traces. These generated files are ignored by Git.

## Manual review

1. Start `npm run dev`, open the application using your development environment's normal access method, and inspect the home, shop, and all three product pages.
2. Review at desktop and mobile widths: readable text, usable navigation, artwork, product prices, and footer demo disclosure.
3. Tab through navigation, product cards, and links. Confirm visible focus and that “Skip to content” moves focus into main content.
4. In a fresh browser profile, open cart, checkout, order confirmation, and membership confirmation directly. Each should show the appropriate empty state.
5. Add two jackets and one tee. Verify $364.00, change jacket quantity to three ($512.00), refresh, and verify the restored quantities. Remove the tee ($444.00).
6. Begin demo checkout, refresh, return to cart, and explicitly restart. Confirm totals and that no personal/payment form appears.
7. Complete a demo order, click rapidly twice, then refresh confirmation. Confirm the same order ID, correct quantities/total, and an empty cart.
8. Use browser storage restrictions to repeat the journey. Confirm the warning and that confirmation refresh shows no invented outcome when the order could not be saved.
9. Open membership, join, and click rapidly twice. Confirm one enrollment ID, $19.00 initial monthly value, fictional benefits, and no real billing.
10. Refresh confirmation, revisit membership, and use “View your membership.” Confirm the same enrollment. Repeat with blocked or full storage and verify the warning and safe empty state after refresh.
11. Enroll while a cart and completed order exist. Confirm both remain unchanged and no measurement requests are sent.
12. Visit an unknown product slug and an unknown route. Confirm the branded 404 and collection link.

## Verified in this cloud instance

Before its separate commit, Phase 2 passed the production build, ESLint, TypeScript, 15 domain tests, and 28 Chromium tests. The combined Phases 1–3 passed the production build, ESLint, TypeScript, 23 domain tests, and 42 Chromium tests. Desktop and mobile journey screenshots were visually reviewed. Node.js was 24.19.0 and npm was 11.9.0.

## Documentation review and future measurement checks

Official Pixel, Supported Events, Conversions API, and Conversion Tracking documentation was read on **October 3, 2026 (America/Los_Angeles)**. The event names and schemas in the design agree with the current documentation; see README for the verification notes and the discrepancy in the design's opening implementation claim.

The quantity-two domain/browser tests verify unit price `14800`, quantity `2`, and checkout/order total `29600` with currency `USD`. The intended future measurement contents item is `{ id: "NM-RUN-001", name: "Aero Run Jacket", content_type: "product", quantity: 2 }`. Omit optional item-level `amount` and `currency` while their unit-versus-total meaning is unspecified. An add-one action will report quantity `1` and event amount `14800`, even when it produces a cart quantity of two. These measurement payloads remain a Phase 4 contract; no SDK calls are made now.

Membership tests verify a stable enrollment ID and the initial `1900` USD cents with the `nano-motion-plus-monthly` plan. Future `subscription_created` payloads will use `type: "plan_enrollment"` and that saved outcome; the current journey sends no SDK events.

Consent, event builders, Pixel loading/revocation, SDK transport, conversion receipt, and deployment are **not yet implemented or validated**. The complete design's unit, integration, and manual measurement checklist must be applied in those phases. Cross-tab and backend transaction guarantees are outside this browser demo; submission guards apply within the current document. No attribution, campaign reporting, or ROAS result is claimed.
