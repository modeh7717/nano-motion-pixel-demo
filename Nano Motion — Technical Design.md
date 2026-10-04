\# Nano Motion — Technical Design Document  
\#\# OpenAI Solutions Engineer, Ads Take‑Home

\*\*Primary deliverable:\*\* A simple, polished public website that demonstrates a correct, thoughtful, scalable OpenAI Measurement Pixel implementation.    
\*\*Pixel ID:\*\* \`T8bLgKF4RsYWhHwHnPDJWg\`  

\*\*Implementation note:\*\* The SDK installation, consent commands, all six event names/shapes, and fourth-argument \`event\_id\` placement were checked against official documentation supplied by the user. The browser integration is implemented. Optional per-item monetary fields are omitted because the docs do not specify unit versus line-total semantics; event-level totals and item quantities are sent. Actions during script loading are suppressed without replay, and the current eligible view is measured once after readiness and acceptance. Actual SDK/network receipt and public deployment remain to be validated; see \`README.md\` and \`TESTING.md\`.

\---

\#\# 1\. Assignment context

Solutions Engineering engagement with a fictional advertiser, \*\*Nano Motion\*\*, a premium activewear e-commerce company selling categories such as running gear, training apparel, outerwear, accessories, and yoga essentials.

The prompt specifically asks for:

\- A simple public-facing Nano Motion website.  
\- Public hosting using a provider such as Vercel, GitHub Pages, or another static hosting option.  
\- Correct implementation of the \*\*OpenAI Measurement Pixel\*\* using the provided Pixel ID.  
\- Thoughtful selection of meaningful measurement events.  
\- An implementation that is practical and scalable rather than a one-off demo hack.  
\- A live demonstration of the user journey and the measurement points.  
\- A clear explanation of what each event captures and why it matters.  
\- Technical decisions that connect back to business objectives such as:  
  \- e-commerce growth,  
  \- international expansion,  
  \- future membership/subscription growth,  
  \- attribution,  
  \- signal coverage,  
  \- optimization,  
  \- return on advertising spend.

The presentation will ultimately be shown to a CMO/CTO audience, so the technical design should be easy to explain and visibly connected to business value.

\---

\#\# 2\. Design principles

\#\#\# 2.1 Build the smallest realistic commerce journey that proves the measurement strategy

The assignment is primarily about \*\*measurement implementation and Solutions Engineering judgment\*\*, not building a production commerce platform.

The website should therefore include enough functionality to create a believable customer funnel without adding unrelated engineering complexity.

\*\*Decision:\*\* Build a small activewear storefront with:  
\- homepage,  
\- product catalog,  
\- product detail pages,  
\- cart,  
\- simulated checkout,  
\- order confirmation,  
\- membership page,  
\- membership confirmation.

\*\*Reason:\*\* This creates all of the important behavioral and conversion moments needed to demonstrate measurement while keeping the implementation understandable during a 20-minute presentation.

\---

\#\#\# 2.2 Use OpenAI standard events whenever a standard event exists

\*\*Decision:\*\* Do not invent custom names for normal commerce actions.

Use the current OpenAI standard taxonomy:  
\- \`page\_viewed\`  
\- \`contents\_viewed\`  
\- \`items\_added\`  
\- \`checkout\_started\`  
\- \`order\_created\`  
\- \`subscription\_created\`

\*\*Reason:\*\* Standard events give OpenAI a known semantic meaning for the action and directly match Nano Motion's commerce and membership use cases. Custom events should be reserved for actions that do not fit the documented taxonomy.

Official reference:  
https\://developers.openai.com/ads/supported-events

\---

\#\#\# 2.3 Separate business events from OpenAI-specific implementation

\*\*Decision:\*\* All OpenAI measurement calls must go through a dedicated measurement module rather than being written directly throughout React components.

Suggested interface:

\`\`\`ts  
trackPageViewed(...)  
trackProductViewed(...)  
trackItemAdded(...)  
trackCheckoutStarted(...)  
trackOrderCreated(...)  
trackSubscriptionCreated(...)  
\`\`\`

Internally, those functions call the OpenAI Pixel.

\*\*Reason:\*\* This is a more scalable customer implementation. UI components communicate business intent ("an order was created") instead of knowing the vendor-specific event payload. It makes the code easier to test, audit, change, and extend later to server-side measurement.

\---

\#\#\# 2.4 Do not build technology that the prompt does not require

\*\*Decision:\*\* The required implementation will use the browser Measurement Pixel. Do not make the OpenAI Conversions API or Advertiser API a dependency of the take-home.

\*\*Reason:\*\* The recruiter supplied a \*\*Pixel ID\*\*, but did not supply an Advertiser API key or a Conversions API key. The correct implementation is therefore to build the required browser integration and explain server-side measurement as a production enhancement.

A future production design may send confirmed orders server-side using the Conversions API and reuse the same \`event\_id\` as the browser event for deduplication.

Official references:  
\- https\://developers.openai.com/ads/measurement-pixel  
\- https\://developers.openai.com/ads/conversions-api  
\- https\://developers.openai.com/ads/conversion-tracking

\---

\#\# 3\. Proposed technology stack

\#\#\# Framework: Next.js \+ TypeScript

\*\*Decision:\*\* Use Next.js with TypeScript.

\*\*Reasons:\*\*  
1\. It is simple for Codex to scaffold and maintain.  
2\. It creates a production-like frontend without requiring a separate backend.  
3\. It deploys cleanly to Vercel, one of the hosting approaches explicitly suggested by the assignment.  
4\. TypeScript lets us strongly type product, cart, and measurement payload construction.  
5\. The application can remain mostly client-side while still having a clean route structure.

Do not add a database.

Do not add authentication.

Do not add a real payment provider.

\---

\#\#\# Hosting: Vercel

\*\*Decision:\*\* Deploy the GitHub repository to Vercel.

\*\*Reasons:\*\*  
\- Public URL is required for the assignment.  
\- Vercel is optimized for Next.js.  
\- Deployments are easy to reproduce.  
\- Preview deployments are useful while iterating.  
\- It minimizes infrastructure work that does not contribute to the assignment.

\---

\#\#\# State management: React context \+ localStorage

Use local state / React context for cart state and persist the cart in \`localStorage\`.

Read browser storage only on the client after hydration. Validate restored data and handle unavailable or corrupt storage without crashing. Persist completed order and membership snapshots so confirmation routes can display the existing outcome after refresh. Direct navigation to a confirmation route without a valid saved outcome must show an empty-state message and must not create an outcome or emit a conversion.

\*\*Reason:\*\* The demo needs state across routes, but Redux or a database would be unnecessary complexity for a three-product demo.

\---

\#\#\# Styling: simple responsive CSS or Tailwind

Either is acceptable. Prefer the approach already scaffolded in the repo.

Visual direction:  
\- premium activewear brand,  
\- clean typography,  
\- large product imagery/placeholders,  
\- minimal navigation,  
\- polished mobile layout.

\*\*Reason:\*\* The site must feel credible to CMO/CTO interviewers, but visual design should not overshadow the measurement implementation.

\---

\#\# 4\. Proposed site architecture

\`\`\`text  
/  
├── /shop  
├── /product/\[slug\]  
├── /cart  
├── /checkout  
├── /order-confirmation  
├── /membership  
└── /membership-confirmation  
\`\`\`

\#\#\# Home \`/\`  
Purpose:  
\- introduce Nano Motion,  
\- featured products,  
\- membership CTA.

Measurement:  
\- \`page\_viewed\`

\#\#\# Shop \`/shop\`  
Purpose:  
\- product discovery.

Measurement:  
\- \`page\_viewed\`

\#\#\# Product \`/product/\[slug\]\`  
Purpose:  
\- product-specific interest.

Measurement:  
\- \`contents\_viewed\`

\#\#\# Cart \`/cart\`  
Purpose:  
\- review purchase intent.

Measurement:  
\- \`page\_viewed\`, once per eligible route visit under the centralized route-view rules.

\#\#\# Checkout \`/checkout\`  
Purpose:  
\- simulated checkout.

Measurement:  
\- \`checkout\_started\` should fire when the user intentionally enters checkout, not merely every time the component re-renders.

\#\#\# Order confirmation \`/order-confirmation\`  
Purpose:  
\- display a completed simulated order.

Measurement:  
\- \*\*Do not fire \`order\_created\` merely because this page renders.\*\*  
\- Fire \`order\_created\` at the moment the application creates the simulated order.  
\- The confirmation page reads the already-created order.

This prevents duplicate purchases when the user refreshes the confirmation page.

\#\#\# Membership \`/membership\`  
Purpose:  
\- explain the future Nano Motion membership program.

Measurement:  
\- \`page\_viewed\`

\#\#\# Membership confirmation \`/membership-confirmation\`  
Purpose:  
\- show successful membership enrollment.

Measurement:  
\- \`subscription\_created\` at successful enrollment, not on every render.

\---

\#\# 5\. Demo product catalog

Keep the catalog intentionally small.

Suggested products:

\`\`\`text  
NM-RUN-001   Aero Run Jacket        \$148.00  
NM-TRN-002   Velocity Legging       \$118.00  
NM-YGA-003   Motion Performance Tee  \$68.00  
\`\`\`

Each product should have:  
\- stable internal ID,  
\- slug,  
\- name,  
\- category,  
\- description,  
\- price stored in integer cents,  
\- local image or simple local visual asset.

\*\*Reason for integer cents:\*\* OpenAI's documented event schema expects monetary values as integers in the standard minor currency unit. For example, \`\$148.00\` should be represented as \`14800\` with currency \`USD\`.

\*\*Demo currency scope:\*\* USD only. Store positive safe-integer prices in cents and positive integer cart quantities. The demo has no shipping charges, taxes, or discounts, so order value is the sum of item subtotals. Future international support must use each supported currency's minor-unit exponent; do not multiply every currency by 100\.

\*\*Quantity-two contract:\*\* Two Aero Run Jackets have a unit price of \`14800\`, quantity \`2\`, line subtotal \`29600\`, and cart/order total \`29600\` USD. Send the event-level total and quantity in the SDK payload. Omit optional per-content monetary fields while unit-versus-line-total semantics remain unspecified in the documentation; include the documented quantity-two example in the tests. \`items\_added\` reports only the quantity added by that action: adding one jacket to a cart that already contains one reports a delta of one and an event value of \`14800\`, not the resulting cart total. Checkout and order payloads report the complete snapshot and its total.

\---

\#\# 6\. Measurement architecture

Suggested module layout:

\`\`\`text  
src/  
  lib/  
    measurement/  
      openaiPixel.ts  
      types.ts  
      eventBuilders.ts  
  components/  
  app/  
\`\`\`

\#\#\# \`openaiPixel.ts\`

Responsibilities:  
\- expose safe wrapper functions,  
\- verify browser environment,  
\- call \`window.oaiq\`,  
\- manage consent and initialization explicitly,  
\- hand consented events to the official SDK queue while its script loads, using the documented installation stub,  
\- handle script-loading failure without throwing into commerce or enrollment actions,  
\- optionally record events in a local demo/debug log,  
\- prevent measurement code from leaking across UI components.

\#\#\# \`eventBuilders.ts\`

Responsibilities:  
\- convert Nano Motion product/cart/order objects into OpenAI-compatible payloads,  
\- calculate total value,  
\- enforce integer amount and quantity types,  
\- centralize currency behavior.

\#\#\# \`types.ts\`

Include TypeScript definitions for:  
\- Nano Motion product,  
\- cart item,  
\- order,  
\- membership plan,  
\- locally-used OpenAI event payload structures.

Do not invent undocumented OpenAI payload fields.

Keep domain unit price, quantity, line subtotal, and order total distinct. The supplied Supported Events documentation defines top-level \`amount\` as event-level monetary value. It calls per-content \`amount\` item-level value without specifying unit versus line total, so the implementation omits that optional field. Record the checked documentation date and final quantity-two payload in \`TESTING.md\`.

\---

\#\# 7\. Pixel installation

Install the official OpenAI Measurement Pixel in the application root so it is available across the site.

Use Pixel ID:

\`\`\`text  
T8bLgKF4RsYWhHwHnPDJWg  
\`\`\`

Keep the value configurable via:

\`\`\`text  
NEXT\_PUBLIC\_OPENAI\_PIXEL\_ID  
\`\`\`

and provide it in \`.env.example\`.

The Pixel ID is not a server secret, but configuration is preferable to scattering it in application code.

During development, enable Pixel debug logging.

Install the documented queue stub before any consented event can be handed to the SDK. Set consent to false before initialization whenever the preference is unknown or declined; initialize once per browser document, then apply the resolved preference using the documented consent API. If the current SDK requires a different ordering, follow its documentation and record the change. Never rely on a late consent update to prevent an initial measurement ping.

Use the official SDK queue rather than introducing a second persistent event queue. If script loading fails, keep commerce functional and report the failure locally. Do not promise delivery or replay conversions on a later page load. Any later delivery attempt must retain the original event ID and must remain consent-gated; conversion pages must never reconstruct events merely to retry them.

Before implementing the script, Codex should verify the current installation snippet in the official documentation:

https\://developers.openai.com/ads/measurement-pixel

\---

\#\# 8\. Consent handling

Implement a lightweight \*\*demo measurement-consent banner\*\*.

Behavior:  
1\. Model the preference explicitly as \`unknown\`, \`accepted\`, or \`declined\`. Treat missing, corrupt, or unreadable stored preferences as \`unknown\`.  
2\. Before Pixel initialization, set consent false unless a valid accepted preference has been resolved. No measurement events may be submitted while consent is unknown or declined.  
3\. For unknown consent, show equally accessible "Accept measurement" and "Decline" controls.  
4\. On acceptance, update SDK consent using its documented API and persist the choice where storage is available. Emit one applicable view event for the currently visible route after consent is enabled; subsequent actions may be measured.  
5\. Never retain or replay shopping actions or conversions performed before consent. The current-route view on acceptance represents the newly measurable view, not a replay of prior history.  
6\. On decline, keep consent false and persist the choice. The storefront and checkout remain usable.  
7\. Provide a footer control to change the preference or reset it to unknown. Revocation/reset immediately sets SDK consent false, stops new measurement submissions, and clears any application-held pending measurement data. Reset reopens the banner.  
8\. Revocation cannot retract requests already sent. Verify the SDK's handling of queued events at revocation against the current documentation and test that no queued event is transmitted while consent is false. Do not resume previously queued events merely because consent is granted again; if the SDK cannot safely discard pending events, defer script loading until acceptance and submit events only once the SDK is loaded and consent remains accepted. Suppress actions during loading rather than retain them for replay, and document this coverage tradeoff.

Consent handling belongs in the initial measurement implementation phase, before live events are enabled.

\*\*Reason:\*\* Nano Motion plans international expansion. Consent-aware measurement demonstrates that the implementation was designed with real deployment conditions in mind rather than assuming one market.

This is a technical demonstration, not a claim that the sample banner is a complete legal/CMP implementation.

The official Pixel supports setting consent before initialization and prevents measurement-event pings while consent is false.

Reference:  
https\://developers.openai.com/ads/measurement-pixel

\---

\#\# 9\. Event design

\#\#\# 9.1 \`page\_viewed\`

Trigger:  
\- homepage,  
\- shop,  
\- membership,  
\- other important generic pages where product-specific \`contents\_viewed\` is not more meaningful.

Example conceptual payload:

\`\`\`ts  
{  
  type: "contents",  
  contents: \[  
    {  
      id: "home",  
      name: "Nano Motion Home",  
      content\_type: "page"  
    }  
  \]  
}  
\`\`\`

\*\*Reason:\*\* Gives visibility into meaningful landing/page engagement without treating every component interaction as a conversion.

\*\*Route-view boundaries:\*\* Use a centralized route observer. Initial document loads, committed client-side route changes, and back/forward navigation each establish a new visit. A hard refresh establishes a new view visit; rerenders and React Strict Mode effect replay do not. Query/hash changes alone do not create another view, including changes to \`measurementDebug\`. Use \`contents\_viewed\` for a valid product detail visit and \`page\_viewed\` for the configured generic routes; do not emit both for the same visit. Fix the generic route list to home, shop, cart, checkout, order confirmation, membership, and membership confirmation. Confirmation page views remain distinct from conversion events.

If consent is accepted during a visit, emit its applicable view once at that point. Restoring accepted consent must wait for route and storage hydration so initialization and route observation do not duplicate it. Navigate away and return to the same product to create a new legitimate view; do not deduplicate by pathname for the entire session.

\---

\#\#\# 9.2 \`contents\_viewed\`

Trigger:  
\- once per eligible product detail route visit, after consent is accepted and the product is resolved.

Example:

\`\`\`ts  
{  
  type: "contents",  
  amount: 14800,  
  currency: "USD",  
  contents: \[  
    {  
      id: "NM-RUN-001",  
      name: "Aero Run Jacket",  
      content\_type: "product",  
      quantity: 1  
    }  
  \]  
}  
\`\`\`

\*\*Reason:\*\* This represents explicit product interest and is more informative than a generic page view for product pages.

\---

\#\#\# 9.3 \`items\_added\`

Trigger:  
\- after the cart successfully accepts the user's add-to-cart action.

Example:

\`\`\`ts  
{  
  type: "contents",  
  amount: 14800,  
  currency: "USD",  
  contents: \[  
    {  
      id: "NM-RUN-001",  
      name: "Aero Run Jacket",  
      content\_type: "product",  
      quantity: 1  
    }  
  \]  
}  
\`\`\`

\*\*Reason:\*\* Add-to-cart is a strong intent signal and helps distinguish product interest from shopping intent. It also provides a useful funnel stage between product view and checkout.

\---

\#\#\# 9.4 \`checkout\_started\`

Trigger:  
\- when the user intentionally begins checkout from the cart, or directly enters checkout with a valid nonempty cart, under the attempt rules below.

Payload:  
\- cart total,  
\- currency,  
\- all cart contents.

\*\*Checkout attempt boundaries:\*\* Create and persist a checkout-attempt ID when entering checkout with a nonempty valid cart. Direct entry to \`/checkout\` with a valid cart also creates an attempt. Empty-cart entry creates no attempt and sends no checkout event. Track once at attempt creation if consent allows; refresh, rerenders, and back/forward navigation reuse the active attempt and must not resend. Returning from checkout and explicitly starting again creates a new attempt. Completing an order closes the attempt. Never backfill a pre-consent checkout attempt after acceptance.

\*\*Important:\*\* Avoid firing this repeatedly due to component renders or route refreshes.

\*\*Reason:\*\* This marks a high-intent step and makes it possible to diagnose abandonment between cart, checkout, and purchase.

\---

\#\#\# 9.5 \`order\_created\`

Trigger:  
\- when simulated checkout succeeds and an order object is created.

Payload:  
\- complete order value,  
\- currency,  
\- purchased contents.

Required:  
\- include a stable \`event\_id\`, for example \`order\_NM-10482\`, derived from the persisted order ID and reused for any delivery attempt for that outcome.

\*\*Reason:\*\* This is the primary e-commerce business outcome and should represent an actual completed order in the demo.

\*\*Duplicate prevention requirement:\*\* A refresh of \`/order-confirmation\` must not create or re-send a new purchase event.

\---

\#\#\# 9.6 \`subscription\_created\`

Trigger:  
\- when the user successfully enrolls in the paid Nano Motion membership.

Use the documented \`plan\_enrollment\` data shape.

Example:

\`\`\`ts  
{  
  type: "plan\_enrollment",  
  plan\_id: "nano-motion-plus-monthly",  
  amount: 1900,  
  currency: "USD"  
}  
\`\`\`

Required:  
\- include a stable membership \`event\_id\`, derived from the persisted enrollment ID and reused for any delivery attempt for that outcome.

\*\*Reason:\*\* The assignment explicitly says Nano Motion is launching a membership/subscription program. Instrumenting this separately shows that the measurement design covers both immediate retail revenue and recurring-revenue strategy.

\---

\#\# 10\. Why intermediate funnel events are included

Do not instrument events only because they are available.

The intended funnel is:

\`\`\`text  
page/product view  
      ↓  
contents\_viewed  
      ↓  
items\_added  
      ↓  
checkout\_started  
      ↓  
order\_created  
\`\`\`

Each event answers a different question:

\- \`contents\_viewed\`: Are visitors engaging with products?  
\- \`items\_added\`: Are interested visitors showing purchase intent?  
\- \`checkout\_started\`: Are cart users advancing toward payment?  
\- \`order\_created\`: Are they completing the transaction?

\*\*Reason:\*\* Prompt not only for measurement, but for the business value of measurement, signal coverage, attribution, and optimization. A full but concise funnel gives the CMO/CTO something actionable beyond a final conversion count.

\---

\#\# 11\. \`event\_id\` strategy

Generate mandatory stable IDs for the two definitive outcomes:

\`\`\`text  
order\_created        \-\> order\_\<order-id\>  
subscription\_created \-\> subscription\_\<membership-id\>  
\`\`\`

Stable event IDs support delivery deduplication; they do not stop the application from creating two different orders or enrollments. Guard each submit operation synchronously, disable its button while processing, and reuse the persisted outcome for repeated handling of the same operation. Membership Join must return the existing active demo enrollment rather than create another enrollment. A new independent order may be created only from a new valid checkout attempt.

The browser implementation does not require a server duplicate today, but keeping stable event IDs makes the integration ready for a future Pixel \+ Conversions API setup.

If the same event is later sent from browser and server, OpenAI supports deduplication by reusing the same event ID with the same Pixel/event identity.

Reference:  
https\://developers.openai.com/ads/measurement-pixel

\---

\#\# 12\. Attribution behavior

Do not manually invent or generate an OpenAI attribution identifier.

The official Pixel automatically handles the OpenAI \`oppref\` attribution value when one is present on a real ad landing URL.

For the demo:  
\- allow the Pixel to handle this behavior naturally;  
\- do not create a fake \`oppref\` and claim it represents an actual OpenAI ad click.

\*\*Reason:\*\* The take-home is about correct measurement implementation. Simulating a fake attribution token could make the demo less accurate.

In the presentation, explain that on real ChatGPT Ads traffic the Pixel captures and persists the attribution identifier automatically.

\---

\#\# 13\. No PII / advanced matching in the take-home

Do not collect names, emails, phone numbers, or other identity fields purely for this demo.

\*\*Reason:\*\* They are not necessary to prove the assignment and would add unnecessary privacy and implementation concerns.

Future production work can evaluate advanced matching based on Nano Motion's consent model, data policies, and customer architecture.

\---

\#\# 14\. Debug experience

Create a lightweight development/demo event inspector.

Enable it only when:

\`\`\`text  
?measurementDebug=true  
\`\`\`

or in development mode.

Display:  
\- timestamp,  
\- event name,  
\- product/content IDs,  
\- amount,  
\- currency,  
\- event ID when present,  
\- local dispatch status: \`suppressed\` (consent or validation), \`queued\` (handed to the documented stub while loading), \`handed\_to\_sdk\` (SDK loaded), or \`failed\` (local dispatch or loading failure).

These statuses describe local observations only. \`handed\_to\_sdk\` is not an acknowledgment of receipt; script load success is not conversion receipt. If suppressed actions are displayed for demonstration, keep only a bounded in-memory diagnostic log and never use it as a replay queue.

Example:

\`\`\`text  
14:02:11  contents\_viewed  
           NM-RUN-001 / Aero Run Jacket / \$148.00

14:02:17  items\_added  
           NM-RUN-001 / qty 1 / \$148.00

14:02:25  checkout\_started  
           2 items / \$266.00

14:02:39  order\_created  
           order\_NM-10482 / \$266.00  
\`\`\`

\*\*Important:\*\* Label this as \*\*Local instrumentation log\*\*.

It must not claim that an event was received by OpenAI.

\*\*Reason:\*\* It makes the live presentation easy to follow while preserving technical accuracy.

\---

\#\# 15\. Pixel validation

During implementation, verify events in two ways.

\#\#\# A. Browser console  
Enable the Pixel's documented \`debug\` option during testing and inspect SDK activity.

\#\#\# B. Browser network panel  
Use DevTools to verify requests to the documented OpenAI measurement endpoints and inspect payloads and available responses. Network activity demonstrates browser transport attempts; a successful transport response alone does not establish attribution, reporting inclusion, or optimization eligibility.

Do not rely only on the custom local debug panel.

\#\#\# Optional, only if credentials become available  
OpenAI documents an Advertiser API conversion event stream that can show recent Pixel events for enabled accounts. Do not make this a required part of the project because the recruiter did not provide an Ads API key.

Reference:  
https\://developers.openai.com/ads/api-reference/conversion-setup

\---

\#\#\# Presentation and business-result boundaries

Use this short presentation sequence:  
1\. Show consent acceptance, a product view, add-to-cart, checkout, and a simulated order; explain the business question each signal addresses.  
2\. Show the local instrumentation log alongside SDK debug output and browser requests; identify each as local intent, SDK activity, or transport evidence.  
3\. Refresh confirmation to demonstrate no additional conversion, then show paid demo membership enrollment.  
4\. Decline/revoke consent and demonstrate that shopping still works while new measurement submissions stop.  
5\. Explain that this demo validates instrumentation and event values. Actual attribution and ROAS require real campaign traffic, conversion reporting, and spend data; optimization impact requires campaign delivery and evaluation. Do not claim these outcomes from simulated purchases or local logs.

For production, assess funnel progression using appropriately scoped sessions/users or checkout attempts rather than dividing raw event counts, since repeated legitimate views and add actions can occur. Explain the membership amount as the initial monthly enrollment value, not lifetime value or evidence of subsequent renewals.

\---

\#\# 16\. Testing strategy

\#\#\# Unit tests

Test event builders independently.

Required examples:  
\- product price \`\$148.00\` becomes \`14800\`;  
\- cart quantity remains an integer;  
\- order total is correct;  
\- \`contents\[\]\` contains only documented browser-supported fields;  
\- membership uses \`plan\_enrollment\`;  
\- stable \`event\_id\` is generated from the order/subscription ID;  
\- quantity-two unit price, line subtotal, event total, and added-quantity delta agree with the verified schema;  
\- fractional, negative, non-finite, or unsafe monetary/quantity inputs are rejected rather than silently emitted; zero is allowed only where the domain and documented schema permit it.

\---

\#\#\# Integration tests

Mock \`window.oaiq\` and verify:  
\- product view triggers \`contents\_viewed\`;  
\- add-to-cart triggers exactly one \`items\_added\`;  
\- checkout entry triggers exactly one \`checkout\_started\`;  
\- successful checkout triggers exactly one \`order\_created\`;  
\- order confirmation refresh does not create a second order event;  
\- membership enrollment triggers exactly one \`subscription\_created\`;  
\- declining consent prevents measurement calls;  
\- accepting consent allows subsequent events and exactly one applicable current-route view;  
\- unknown consent emits no measurement, including during initialization;  
\- consent revocation/reset stops new submissions and does not replay earlier actions on reacceptance;  
\- delayed script loading uses the official queue only after consent;  
\- blocked/failed script loading does not interrupt order or enrollment creation;  
\- rapid double-submit creates one persisted order/enrollment and one conversion dispatch;  
\- persisted membership confirmation refresh does not resend enrollment;  
\- route changes, back/forward, and Strict Mode do not duplicate a visit event;  
\- direct checkout with a valid cart creates one attempt, refresh reuses it, and empty checkout emits none;  
\- unavailable/corrupt storage produces safe empty states or unknown consent.

\---

\#\#\# Manual QA checklist

Run this exact journey before submission:

\`\`\`text  
1\. Open site  
2\. Accept measurement consent  
3\. Open a product  
4\. Add product to cart  
5\. Open cart  
6\. Start checkout  
7\. Complete simulated checkout  
8\. Confirm order page  
9\. Refresh order confirmation  
10\. Verify no duplicate purchase  
11\. Open membership  
12\. Join membership  
13\. Verify subscription event  
\`\`\`

For every step:  
\- inspect local event log,  
\- inspect Pixel debug output,  
\- inspect browser network activity,  
\- verify amount/currency/item values.

Also test:  
\- desktop,  
\- mobile,  
\- empty cart,  
\- multiple quantities,  
\- two different products,  
\- consent decline,  
\- consent reset,  
\- direct navigation to order confirmation,  
\- hard refresh,  
\- blocked measurement script and delayed loading,  
\- revoke consent while the script is loading,  
\- rapid double-click on order and membership submission,  
\- membership confirmation refresh and direct navigation,  
\- client navigation and back/forward between products,  
\- storage unavailable or corrupt.

\---

\#\# 17\. Simulated checkout rules

The site must clearly be a demo.

Checkout should:  
\- use fake form fields or a simple "Complete demo order" button;  
\- never submit a real payment;  
\- never collect or store real payment-card data.

On success:  
1\. acquire a synchronous submission guard for the active checkout attempt and disable repeat submission;  
2\. validate a nonempty cart and integer quantities/prices;  
3\. create one order ID and freeze the cart snapshot;  
4\. persist the order and close the checkout attempt before conversion dispatch; repeated processing must reuse that outcome;  
5\. submit \`order\_created\` once with mandatory stable \`event\_id\`, only if consent permits;  
6\. clear the cart;  
7\. navigate to confirmation even if measurement fails.

If storage cannot persist the outcome, retain it in application memory for the current journey and disclose that confirmation persistence is unavailable. Do not claim reload-safe persistence or recreate a lost outcome on confirmation entry. Measurement errors must never roll back the simulated order.

\*\*Reason:\*\* The assignment needs a conversion event, not a payment integration.

\---

\#\# 18\. Membership demo rules

Create one simple paid membership plan, for example:

\`\`\`text  
Nano Motion Plus  
\$19/month  
\- member pricing  
\- early product access  
\- free standard shipping  
\`\`\`

The exact benefits are fictional and should be clearly positioned as demo content.

Enrollment:  
1\. user clicks "Join"; acquire a synchronous submission guard and disable repeat submission;  
2\. reuse any existing active enrollment, otherwise create one enrollment ID and snapshot the plan;  
3\. persist the enrollment before conversion dispatch, with the same storage-failure fallback as orders;  
4\. submit \`subscription\_created\` once for a newly created enrollment with mandatory stable \`event\_id\`, only if consent permits;  
5\. navigate to confirmation even if measurement fails.

Repeated Join actions and confirmation refresh must display the existing enrollment without creating or sending another subscription event. The \$19 amount represents the first monthly enrollment charge in the simulation, not projected lifetime revenue.

Do not build recurring billing.

\---

\#\# 19\. Production extension: Conversions API

This is intentionally \*\*not required for the take-home implementation\*\*.

Add a small README/design section showing how the architecture would evolve:

\`\`\`text  
Browser                    Server  
   |                         |  
OpenAI Pixel             Order backend  
   |                         |  
   |                  Conversions API  
   |                         |  
   \+------ same event\_id \----+  
              |  
            OpenAI  
\`\`\`

Production benefits:  
\- confirmed backend purchase source,  
\- less dependence on browser execution,  
\- more resilient measurement,  
\- browser/server event deduplication.

Requirements before implementing:  
\- Conversions API key,  
\- server-side secret storage,  
\- server access to confirmed order/subscription events,  
\- capture and forwarding of relevant attribution information.

Never put a Conversions API key in browser code.

\---

\#\# 20\. Non-goals

Codex should \*\*not\*\* build any of the following unless explicitly requested later:

\- real ChatGPT UI clone,  
\- real OpenAI ad-serving flow,  
\- real campaign creation,  
\- fake Ads Manager,  
\- Advertiser API integration without credentials,  
\- Conversions API calls from browser code,  
\- real Stripe/payment processing,  
\- user accounts,  
\- production database,  
\- analytics warehouse,  
\- complex inventory system,  
\- PII collection solely for the demo,  
\- large product catalog.

\*\*Reason:\*\* These do not materially improve the assignment's core demonstration and create unnecessary failure points.

\---

\#\# 21\. Suggested repository structure

\`\`\`text  
nano-motion/  
├── DESIGN.md  
├── README.md  
├── TESTING.md  
├── .env.example  
├── package.json  
├── src/  
│   ├── app/  
│   │   ├── page.tsx  
│   │   ├── shop/  
│   │   ├── product/\[slug\]/  
│   │   ├── cart/  
│   │   ├── checkout/  
│   │   ├── order-confirmation/  
│   │   ├── membership/  
│   │   └── membership-confirmation/  
│   ├── components/  
│   ├── data/  
│   │   └── products.ts  
│   ├── lib/  
│   │   ├── cart/  
│   │   └── measurement/  
│   │       ├── openaiPixel.ts  
│   │       ├── eventBuilders.ts  
│   │       └── types.ts  
│   └── hooks/  
└── public/  
\`\`\`

\---

\#\# 22\. Acceptance criteria

The implementation is complete when all of the following are true:

\- \[ \] Site is publicly accessible.  
\- \[ \] Nano Motion branding is present and credible.  
\- \[ \] At least three products exist.  
\- \[ \] User can view a product.  
\- \[ \] User can add products to a cart.  
\- \[ \] User can begin a simulated checkout.  
\- \[ \] User can complete a simulated purchase.  
\- \[ \] User can enroll in the sample membership.  
\- \[ \] OpenAI Pixel initializes once with the provided Pixel ID.  
\- \[ \] \`page\_viewed\` is implemented intentionally.  
\- \[ \] \`contents\_viewed\` is implemented.  
\- \[ \] \`items\_added\` is implemented.  
\- \[ \] \`checkout\_started\` is implemented.  
\- \[ \] \`order\_created\` is implemented.  
\- \[ \] \`subscription\_created\` is implemented.  
\- \[ \] Monetary values are sent in integer minor units.  
\- \[ \] Event payloads use only fields supported by the current Pixel documentation.  
\- \[ \] Purchase refresh does not double-fire.  
\- \[ \] Subscription confirmation refresh does not double-fire.  
\- \[ \] Consent is disabled while unknown or declined, including during initialization.  
\- \[ \] Acceptance emits one applicable current-route view without replaying prior actions.  
\- \[ \] Revocation/reset disables subsequent measurement and prevents historical replay.  
\- \[ \] Blocked or delayed script loading does not break commerce.  
\- \[ \] Double-submit cannot create duplicate orders or memberships.  
\- \[ \] Orders and memberships persist before conversion dispatch and use mandatory stable event IDs.  
\- \[ \] Route and checkout-attempt boundaries are tested.  
\- \[ \] Quantity-two payload semantics are verified against current documentation.  
\- \[ \] Debug mode is available for testing.  
\- \[ \] Local demo event inspector is clearly labeled as local.  
\- \[ \] Browser console/network validation is documented.  
\- \[ \] No API keys or secrets are exposed.  
\- \[ \] README explains setup and deployment.  
\- \[ \] TESTING.md contains reproducible QA steps.  
\- \[ \] Project deploys successfully to Vercel.

\---

\#\# 23\. Prompt-to-design traceability

| Assignment need | Technical design response |  
|---|---|  
| Build a simple public website | Small Next.js activewear storefront |  
| Host it publicly | Vercel deployment |  
| Implement provided Pixel | Root-level OpenAI Pixel integration using supplied Pixel ID |  
| Choose meaningful measurements | Six standard events tied to commerce \+ membership |  
| Explain event rationale | Event design section documents trigger and business reason |  
| Show user journey | Product → cart → checkout → order, plus membership |  
| Demonstrate measurement points | Local event inspector \+ browser Pixel/network validation |  
| Show scalable integration | Central measurement abstraction and event builders |  
| Address international expansion | USD-scoped demo, documented currency-unit extension \+ consent-aware architecture |  
| Address membership strategy | \`subscription\_created\` with \`plan\_enrollment\` |  
| Address attribution | Rely on documented automatic \`oppref\` handling |  
| Address signal coverage | Product, intent, checkout, order, subscription funnel |  
| Discuss production next steps | Optional future server-side Conversions API architecture |

\---

\#\# 24\. Instructions to Codex

Before writing code:

1\. Read this entire document.  
2\. Read the latest official OpenAI documentation:  
   \- https\://developers.openai.com/ads/measurement-pixel  
   \- https\://developers.openai.com/ads/supported-events  
   \- https\://developers.openai.com/ads/conversions-api  
   \- https\://developers.openai.com/ads/conversion-tracking  
3\. Verify that the event names and payload fields in this design still match the current docs.  
4\. Do not invent OpenAI APIs, fields, event names, or attribution behavior.  
5\. If the docs conflict with this document, follow the current official docs and record the difference in \`README.md\`.  
6\. Implement in small phases and run tests after each phase.  
7\. Keep the measurement layer isolated from UI code.  
8\. Do not add scope that is listed under Non-goals.  
9\. Keep the site polished but prioritize correctness, testability, and presentation clarity.  
10\. Produce \`README.md\` and \`TESTING.md\` before declaring the project complete.

\#\#\# Recommended build order

\*\*Phase 1 — Scaffold\*\*  
\- Next.js \+ TypeScript  
\- routes  
\- static product data  
\- styling

\*\*Phase 2 — Commerce\*\*  
\- product pages  
\- cart  
\- checkout  
\- simulated order creation

\*\*Phase 3 — Membership\*\*  
\- membership page  
\- simulated enrollment

\*\*Phase 4 — Consent and measurement\*\*  
\- consent state, persistence, acceptance, and revocation  
\- consent-safe Pixel installation  
\- measurement abstraction  
\- event builders  
\- six events  
\- event IDs

\*\*Phase 5 — Debugging and presentation\*\*  
\- presentation sequence and evidence boundaries  
\- local event inspector  
\- debug configuration

\*\*Phase 6 — QA\*\*  
\- unit tests  
\- integration tests  
\- duplicate-event protection  
\- mobile QA  
\- network verification

\*\*Phase 7 — Deployment\*\*  
\- Vercel  
\- final README  
\- TESTING.md  
\- production build check

\---

\#\# 25\. Technical decision summary

The design intentionally chooses \*\*clarity over complexity\*\*.

The strongest version of this assignment is not the site with the most features. It is the site where every measurement decision can be defended:

\- standard events instead of arbitrary custom events,  
\- meaningful funnel coverage instead of tracking everything,  
\- accurate conversion timing instead of firing on confirmation-page render,  
\- stable event IDs for future deduplication,  
\- consent-aware behavior for international readiness,  
\- a vendor-isolated measurement layer for scalability,  
\- browser Pixel as the required implementation,  
\- server-side measurement shown as the logical production extension rather than pretending credentials were provided.

That combination directly demonstrates the core Solutions Engineer skills the prompt is testing: understanding customer goals, translating them into measurement architecture, implementing correctly, anticipating production concerns, and explaining the tradeoffs clearly.  
