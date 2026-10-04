import assert from "node:assert/strict";
import { test } from "node:test";
import { products } from "../../src/data/products.ts";
import { membershipPlan } from "../../src/data/membership.ts";
import { purchaseSnapshot } from "../../src/lib/commerce/model.ts";
import { createCommerceStore } from "../../src/lib/commerce/store.ts";
import { createMembershipStore } from "../../src/lib/membership/store.ts";
import {
  buildProductViewed,
  buildItemAdded,
  buildCheckoutStarted,
  buildOrderCreated,
  buildSubscriptionCreated,
  buildRouteViewed,
} from "../../src/lib/measurement/event-builders.ts";
import {
  createMeasurementStore,
  CONSENT_STORAGE_KEY,
} from "../../src/lib/measurement/store.ts";
import type {
  MeasurementEvent,
  PixelDriver,
} from "../../src/lib/measurement/types.ts";

const snapshot = purchaseSnapshot([{ productId: products[0].id, quantity: 2 }]);
const attempt = {
  id: "attempt-1",
  createdAt: "2026-10-04T03:00:00.000Z",
  status: "active" as const,
  snapshot,
};
const order = {
  id: "order-1",
  createdAt: attempt.createdAt,
  checkoutAttemptId: attempt.id,
  snapshot,
};
const enrollment = {
  id: "enrollment-1",
  createdAt: attempt.createdAt,
  status: "active" as const,
  plan: membershipPlan,
};

function fixture({
  raw,
  blocked = false,
  quota = false,
  failMeasure = false,
  failConsent = false,
  pixelId = "demo-pixel",
}: {
  raw?: string;
  blocked?: boolean;
  quota?: boolean;
  failMeasure?: boolean;
  failConsent?: boolean;
  pixelId?: string;
} = {}) {
  const data = new Map<string, string>();
  if (raw !== undefined) data.set(CONSENT_STORAGE_KEY, raw);
  const calls: unknown[][] = [];
  const measured: MeasurementEvent[] = [];
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const pending = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const driver: PixelDriver = {
    load: (config) => {
      calls.push(["load", config]);
      return pending;
    },
    consent: (value) => {
      calls.push(["consent", value]);
      if (failConsent && value) throw new Error("Consent failed");
    },
    measure: (event) => {
      if (failMeasure) throw new Error("Dispatch failed");
      measured.push(event);
    },
  };
  const storage = () => {
    if (blocked) throw new Error("Blocked");
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (quota) throw new Error("Full");
        data.set(key, value);
      },
    };
  };
  const store = createMeasurementStore({ driver, pixelId, storage });
  const loaded = async () => {
    resolve();
    await pending;
    await Promise.resolve();
  };
  return { store, data, calls, measured, loaded, reject, storage };
}

test("builders preserve integer cents, action deltas, and browser-only item fields", () => {
  assert.equal(buildProductViewed(products[0]).data.amount, 14800);
  assert.equal(buildItemAdded(products[0].id, 1).data.amount, 14800);
  for (const event of [
    buildCheckoutStarted(attempt),
    buildOrderCreated(order),
  ]) {
    assert.equal(event.data.amount, 29600);
    assert.equal(event.data.currency, "USD");
    assert.deepEqual(event.data.contents, [
      {
        id: products[0].id,
        name: products[0].name,
        content_type: "product",
        quantity: 2,
      },
    ]);
    assert.ok(Object.isFrozen(event.data.contents));
    assert.ok(Object.isFrozen(event.data.contents![0]));
    assert.equal("event_id" in event.data, false);
  }
  assert.equal(buildOrderCreated(order).options!.event_id, "order_order-1");
  assert.equal(
    buildCheckoutStarted(attempt).options!.event_id,
    "checkout_attempt-1",
  );
  assert.deepEqual(buildSubscriptionCreated(enrollment), {
    name: "subscription_created",
    data: {
      type: "plan_enrollment",
      plan_id: membershipPlan.id,
      amount: 1900,
      currency: "USD",
    },
    options: { event_id: "subscription_enrollment-1" },
  });
});
test("builders reject fractions, negatives, unsafe totals, bad IDs and unsupported currencies", () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(() => buildItemAdded(products[0].id, quantity));
  for (const amount of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(() =>
      buildProductViewed({ ...products[0], priceCents: amount }),
    );
    assert.throws(() =>
      buildSubscriptionCreated({
        ...enrollment,
        plan: { ...membershipPlan, amountCents: amount },
      }),
    );
  }
  assert.throws(() =>
    buildOrderCreated({
      ...order,
      snapshot: { ...snapshot, totalCents: 14800 },
    }),
  );
  assert.throws(() => buildOrderCreated({ ...order, id: "" }));
  assert.throws(() =>
    buildCheckoutStarted({ ...attempt, status: "completed" }),
  );
  assert.throws(() =>
    buildProductViewed({ ...products[0], currency: "EUR" as "USD" }),
  );
  assert.throws(() =>
    buildSubscriptionCreated({
      ...enrollment,
      plan: { ...membershipPlan, id: "unknown" },
    }),
  );
});
test("route taxonomy covers generic pages and resolved products, excluding 404 and query strings", () => {
  for (const route of [
    "/",
    "/shop",
    "/cart",
    "/checkout",
    "/order-confirmation",
    "/membership",
    "/membership-confirmation",
  ])
    assert.equal(buildRouteViewed(route)!.name, "page_viewed");
  assert.equal(
    buildRouteViewed("/product/aero-run-jacket")!.name,
    "contents_viewed",
  );
  for (const route of [
    "/unknown",
    "/product/unknown",
    "/shop?measurementDebug=true",
    "/constructor",
  ])
    assert.equal(buildRouteViewed(route), null);
});
test("unknown and declined consent never load the SDK or submit events", () => {
  const { store, calls, measured } = fixture();
  store.observeRoute("/");
  store.hydrate();
  store.hydrate();
  assert.equal(store.trackItemAdded(products[0].id, 1).status, "suppressed");
  store.setPreference("declined");
  assert.equal(store.trackOrderCreated(order).status, "suppressed");
  assert.equal(calls.filter(([command]) => command === "load").length, 0);
  assert.equal(measured.length, 0);
});
test("loading actions are discarded, readiness measures only the current visit once", async () => {
  const { store, measured, loaded, calls } = fixture();
  store.hydrate();
  store.observeRoute("/");
  store.setPreference("accepted");
  assert.equal(store.trackItemAdded(products[0].id, 1).status, "suppressed");
  assert.equal(store.trackCheckoutStarted(attempt).status, "suppressed");
  assert.equal(store.trackOrderCreated(order).status, "suppressed");
  store.observeRoute("/product/aero-run-jacket");
  store.observeRoute("/product/aero-run-jacket");
  await loaded();
  store.observeRoute("/product/aero-run-jacket");
  assert.deepEqual(
    measured.map((event) => event.name),
    ["contents_viewed"],
  );
  assert.equal(calls.filter(([command]) => command === "load").length, 1);
  assert.equal(store.trackItemAdded(products[0].id, 1).status, "handed_to_sdk");
  assert.deepEqual(
    measured.map((event) => event.name),
    ["contents_viewed", "items_added"],
  );
});
test("restored accepted consent waits for readiness and route observation without duplicate views", async () => {
  const { store, measured, loaded } = fixture({
    raw: JSON.stringify({ version: 1, preference: "accepted" }),
  });
  store.hydrate();
  store.hydrate();
  await loaded();
  assert.equal(measured.length, 0);
  store.observeRoute("/shop");
  store.observeRoute("/shop");
  assert.equal(measured.length, 1);
  store.observeRoute("/product/aero-run-jacket");
  store.observeRoute("/shop");
  store.observeRoute("/product/aero-run-jacket");
  assert.deepEqual(
    measured.map((event) => event.name),
    ["page_viewed", "contents_viewed", "page_viewed", "contents_viewed"],
  );
});
test("revocation during loading blocks everything until reacceptance, without historical replay", async () => {
  const { store, measured, loaded, calls } = fixture();
  store.hydrate();
  store.observeRoute("/");
  store.setPreference("accepted");
  store.trackOrderCreated(order);
  store.setPreference("declined");
  await loaded();
  assert.equal(measured.length, 0);
  store.trackSubscriptionCreated(enrollment);
  store.setPreference("accepted");
  assert.deepEqual(
    measured.map((event) => event.name),
    ["page_viewed"],
  );
  assert.equal(calls.filter(([command]) => command === "load").length, 1);
  store.setPreference("unknown");
  store.trackItemAdded(products[0].id, 1);
  store.observeRoute("/shop");
  store.setPreference("accepted");
  assert.deepEqual(
    measured.map((event) => event.name),
    ["page_viewed", "page_viewed"],
  );
});
test("corrupt and unavailable preferences restore unknown and storage failures preserve the current choice", () => {
  for (const raw of [
    "{",
    JSON.stringify({ version: 99, preference: "accepted" }),
    JSON.stringify({ version: 1, preference: true }),
  ]) {
    const { store, calls } = fixture({ raw });
    store.hydrate();
    assert.equal(store.getSnapshot().preference, "unknown");
    assert.equal(store.getSnapshot().storageIssue, "corrupt");
    assert.equal(
      calls.some(([command]) => command === "load"),
      false,
    );
  }
  for (const settings of [{ blocked: true }, { quota: true }]) {
    const { store } = fixture(settings);
    store.hydrate();
    store.setPreference("declined");
    assert.equal(store.getSnapshot().preference, "declined");
    assert.equal(store.getSnapshot().storageIssue, "unavailable");
  }
});
test("cross-tab denial and storage clearing close the local gate immediately", async () => {
  const { store, measured, loaded } = fixture();
  store.hydrate();
  store.setPreference("accepted");
  await loaded();
  store.syncPreference(JSON.stringify({ version: 1, preference: "declined" }));
  store.trackOrderCreated(order);
  assert.equal(measured.length, 0);
  store.syncPreference(null);
  assert.equal(store.getSnapshot().preference, "unknown");
  store.syncPreference("{");
  assert.equal(store.getSnapshot().storageIssue, "corrupt");
});
test("script, dispatch, and SDK consent failures remain local and do not leak measurements", async () => {
  const f = fixture();
  f.store.hydrate();
  f.store.setPreference("accepted");
  f.reject(new Error("Blocked"));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.store.trackOrderCreated(order).status, "failed");
  const broken = fixture({ failMeasure: true });
  broken.store.hydrate();
  broken.store.setPreference("accepted");
  await broken.loaded();
  assert.equal(broken.store.trackOrderCreated(order).status, "failed");
  assert.equal(broken.store.getSnapshot().sdkStatus, "failed");
  const badConsent = fixture({ failConsent: true });
  badConsent.store.hydrate();
  badConsent.store.setPreference("accepted");
  await badConsent.loaded();
  assert.equal(badConsent.store.getSnapshot().sdkStatus, "failed");
  assert.deepEqual(badConsent.measured, []);
  const missing = fixture({ pixelId: "" });
  missing.store.hydrate();
  missing.store.setPreference("accepted");
  assert.equal(missing.store.getSnapshot().sdkStatus, "failed");
});
test("business hooks run after persistence, once per new attempt/outcome, and never during hydration", () => {
  const f = fixture();
  let events = 0;
  const persisted: { type: string; actual: string; expected: string }[] = [];
  const commerce = createCommerceStore({
    storage: f.storage,
    onEvent: (event) => {
      events++;
      const saved = JSON.parse(f.data.get("nano-motion:commerce:v1")!);
      if (event.type === "order-created")
        persisted.push({
          type: event.type,
          actual: saved.order.id,
          expected: event.order.id,
        });
      if (event.type === "checkout-started")
        persisted.push({
          type: event.type,
          actual: saved.checkout.id,
          expected: event.attempt.id,
        });
    },
  });
  commerce.hydrate();
  assert.equal(events, 0);
  commerce.addItem(products[0].id);
  const attempt = commerce.ensureCheckout()!;
  commerce.ensureCheckout();
  commerce.completeCheckout(attempt.id);
  commerce.completeCheckout(attempt.id);
  assert.equal(events, 3);
  assert.equal(persisted.length, 2);
  for (const observation of persisted)
    assert.equal(observation.actual, observation.expected);
  const restored = createCommerceStore({
    storage: f.storage,
    onEvent: () => events++,
  });
  restored.hydrate();
  assert.equal(events, 3);
  let enrollments = 0;
  let savedEnrollmentId: string | undefined;
  const membership = createMembershipStore({
    storage: f.storage,
    onEnroll: () => {
      enrollments++;
      savedEnrollmentId = JSON.parse(f.data.get("nano-motion:membership:v1")!)
        .enrollment.id;
    },
  });
  membership.hydrate();
  const enrolled = membership.enroll();
  membership.enroll();
  assert.equal(enrollments, 1);
  assert.equal(savedEnrollmentId, enrolled.id);
});
test("throwing measurement hooks cannot roll back commerce or enrollment", () => {
  const f = fixture();
  const fail = () => {
    throw new Error("Measurement failure");
  };
  const commerce = createCommerceStore({ storage: f.storage, onEvent: fail });
  commerce.hydrate();
  commerce.addItem(products[0].id);
  const attempt = commerce.startCheckout()!;
  const order = commerce.completeCheckout(attempt.id);
  assert.equal(commerce.getSnapshot().order!.id, order.id);
  assert.equal(commerce.getSnapshot().cart.length, 0);
  const membership = createMembershipStore({
    storage: f.storage,
    onEnroll: fail,
  });
  membership.hydrate();
  const enrollment = membership.enroll();
  assert.equal(membership.getSnapshot().enrollment!.id, enrollment.id);
});
