# Testing

## Run the checks

Use Node.js 24 or newer. From the repository root:

```sh
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

If Chromium is absent, run `npx playwright install chromium`. The config uses `/usr/bin/chromium` when available and accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. In the cloud, use `--cache /workspace/.npm-cache` with installation commands.

Browser tests start and stop a production server on port 3100. Run a build first, including after changing application code. The suite runs **13 desktop scenarios and 2 mobile smoke tests**, with two workers and no retries or skipped tests. Screenshots and traces are saved only on failure in the ignored `test-results` directory.

To run just one browser group:

```sh
npm run test:e2e -- --project=desktop
npm run test:e2e -- --project=mobile
```

## Coverage

The **41 fast unit tests** cover money and quantity validation, cart/checkout persistence, immutable order and membership snapshots, duplicate prevention, invalid or unavailable storage, event payloads, consent state transitions, and bounded diagnostics. These edge cases stay at the unit level rather than being repeated for each viewport.

The desktop browser suite covers:

- Catalog names/prices/IDs, product routes, keyboard skip navigation, empty states, and branded 404s.
- Cart quantity editing, removal, exact totals, persistence, and one blocked-storage journey with an accurate warning.
- A combined checkout and membership journey: all six measurement events, a quantity-two $296 order, $19 enrollment, persisted conversion IDs, double-submission guards, and no new conversions on confirmation refresh.
- No SDK load while consent is unknown/declined, no historical backfill, one initialization after acceptance, route/history visits, delayed-load revocation, cross-tab revocation, and working checkout/membership when SDK loading fails.
- Production inspector flag gating, open/minimize/Escape controls and focus return, payload/value/ID display, absence of HTTP labels for suppressed and handed-off events, loading/failure labels, and clearing the log without changing commerce or resending events.

The two mobile smoke tests cover artwork, consent, navigation and inspector layout at 390 × 844, plus home → catalog → product → cart → checkout → order and confirmation refresh. Business edge cases run once on desktop or in unit tests, rather than repeating the entire suite on mobile.

Measurement tests intercept the documented SDK URL with a controlled fixture. It retains the real SDK's `.q` compatibility array so the readiness regression remains covered. These checks prove application command ordering and handoff, not live OpenAI receipt.

## Manual review

1. Run `npm run dev` and use `localhost` locally; this Next.js version blocks HMR from an unconfigured alternate origin. Review all pages at desktop and mobile widths for readable text, usable navigation, focus indicators, and artwork.
2. Add two jackets and one tee: verify $364.00. Change jackets to three: $512.00. Remove the tee: $444.00. Refresh and verify the saved cart.
3. Test direct checkout, history navigation, explicit attempt restart, cart edits, and a new independent order. Try blocked or full storage and verify the warning and safe empty state after refresh.
4. Join membership, refresh confirmation, and revisit the plan. Confirm the same enrollment ID and no real billing. Check membership with an existing cart/order and restricted storage.
5. Open `?measurementDebug=true` in production. Open the bottom-right Interaction log window. Inspect payloads, values and IDs; clear, refresh, revoke and reset the local log. Follow [PRESENTATION.md](./PRESENTATION.md) for the demo walkthrough.

## Live SDK validation

The official SDK downloaded with verified HTTPS on October 4, 2026 reported version `0.1.41`. A separate smoke check executed that downloaded script with locally intercepted transport responses: the adapter became ready and the SDK generated a `page_viewed` POST to `/v1/sdk/events`. The SDK sent a startup POST before the batched page-view event. This was request-generation evidence, not live receipt.

The initial downloader received HTTP 403 (Cloudflare error 1010); a browser-style user agent received HTTP 200. Direct cloud Chromium loading separately failed with `ERR_CERT_AUTHORITY_INVALID`. Live transport, SDK batching/revocation, and Ads account receipt remain unverified. TLS verification was not disabled.

From a browser/network that can load the official SDK:

1. Open DevTools Console and Network with preserve log. Browse and complete shopping with unknown/declined consent; verify no SDK or measurement requests.
2. Accept and follow product → add → checkout → order, then membership. Compare all six events with the inspector and actual network payloads. Two jackets use quantity `2` and total `29600` USD cents; an add-one action uses quantity `1` and `14800`. Membership uses `1900` cents. Conversion IDs use `checkout_`, `order_`, and `subscription_` plus the saved outcome ID.
3. Refresh confirmations and revisit enrollment; verify page views without new conversions. Throttle/block loading, revoke, unblock, and reaccept; confirm suppressed actions never replay.
4. With the real SDK loaded, revoke before its batch flushes. Verify no queued measurements send while declined or replay on reacceptance. Already sent requests cannot be retracted.

A successful response demonstrates transport, not attribution, reporting inclusion, optimization, or ROAS. Ads receipt/reporting needs authorized account evidence. Cross-tab transaction guarantees for commerce are outside this browser demo.
