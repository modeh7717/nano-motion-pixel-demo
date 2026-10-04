import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lineTotal,
  parseCommerceRecord,
  purchaseSnapshot,
} from "../../src/lib/commerce/model.ts";
import {
  COMMERCE_STORAGE_KEY,
  createCommerceStore,
} from "../../src/lib/commerce/store.ts";

const jacket = "NM-RUN-001";
const tee = "NM-YGA-003";
function fixture(initial?: string, failWrites = false) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(COMMERCE_STORAGE_KEY, initial);
  let writes = 0;
  let id = 0;
  const storage = () => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes++;
      if (failWrites) throw new Error("Quota exceeded");
      data.set(key, value);
    },
  });
  const store = createCommerceStore({
    storage,
    uuid: () => `test-${++id}`,
    now: () => "2026-10-04T02:00:00.000Z",
  });
  return { store, data, storage, writes: () => writes };
}

test("two jackets keep unit price, quantity, and total distinct", () => {
  const snapshot = purchaseSnapshot([{ productId: jacket, quantity: 2 }]);
  assert.deepEqual(snapshot.items[0], {
    productId: jacket,
    name: "Aero Run Jacket",
    unitPriceCents: 14800,
    quantity: 2,
  });
  assert.equal(snapshot.totalCents, 29600);
  assert.equal(snapshot.currency, "USD");
  assert.equal(
    purchaseSnapshot([
      { productId: jacket, quantity: 2 },
      { productId: tee, quantity: 1 },
    ]).totalCents,
    36400,
  );
});

test("invalid quantities, prices, and unsafe totals are rejected", () => {
  for (const invalid of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(() => lineTotal(invalid, 1));
    assert.throws(() => lineTotal(14800, invalid));
  }
  assert.throws(() => lineTotal(14800, Number.MAX_SAFE_INTEGER));
  assert.throws(() =>
    purchaseSnapshot([
      { productId: jacket, quantity: Number.MAX_SAFE_INTEGER },
    ]),
  );
  assert.throws(() =>
    purchaseSnapshot([{ productId: "unknown", quantity: 1 }]),
  );
  assert.throws(() =>
    purchaseSnapshot([
      { productId: jacket, quantity: 1 },
      { productId: jacket, quantity: 1 },
    ]),
  );
});

test("overflowing sums are rejected even when individual lines are safe", () => {
  const quantity = Math.floor(Number.MAX_SAFE_INTEGER / 14800);
  assert.ok(Number.isSafeInteger(lineTotal(14800, quantity)));
  assert.throws(() =>
    purchaseSnapshot([
      { productId: jacket, quantity },
      { productId: tee, quantity },
    ]),
  );
});

test("hydration is deferred and idempotent, and browsing never writes storage", () => {
  const { store, writes } = fixture();
  assert.equal(store.getSnapshot().ready, false);
  assert.throws(() => store.addItem(jacket));
  store.hydrate();
  store.hydrate();
  assert.equal(store.getSnapshot().ready, true);
  assert.equal(writes(), 0);
});

test("cart additions, quantity edits, and removals survive hydration", () => {
  const { store, storage } = fixture();
  store.hydrate();
  store.addItem(jacket);
  store.addItem(jacket);
  store.addItem(tee);
  assert.deepEqual(store.getSnapshot().cart, [
    { productId: jacket, quantity: 2 },
    { productId: tee, quantity: 1 },
  ]);
  store.setQuantity(jacket, 3);
  store.removeItem(tee);
  const restored = createCommerceStore({ storage });
  restored.hydrate();
  assert.deepEqual(restored.getSnapshot().cart, [
    { productId: jacket, quantity: 3 },
  ]);
});

test("failed quantity changes leave the previous valid cart intact", () => {
  const { store } = fixture();
  store.hydrate();
  store.addItem(jacket);
  for (const quantity of [0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(() => store.setQuantity(jacket, quantity));
  assert.equal(store.getSnapshot().cart[0].quantity, 1);
});

test("empty checkout creates neither attempt nor order", () => {
  const { store, writes } = fixture();
  store.hydrate();
  assert.equal(store.ensureCheckout(), null);
  assert.equal(store.startCheckout(), null);
  assert.equal(store.getSnapshot().order, null);
  assert.equal(writes(), 0);
  assert.throws(() => store.completeCheckout("missing"));
});

test("direct entry and effect replay reuse an attempt, including after refresh", () => {
  const { store, storage } = fixture();
  store.hydrate();
  store.addItem(jacket);
  const attempt = store.ensureCheckout()!;
  assert.equal(store.ensureCheckout(), attempt);
  const restored = createCommerceStore({ storage });
  restored.hydrate();
  assert.equal(restored.ensureCheckout()?.id, attempt.id);
  assert.notEqual(store.startCheckout()?.id, attempt.id);
});

test("changing the cart invalidates checkout and prevents stale submission", () => {
  const { store } = fixture();
  store.hydrate();
  store.addItem(jacket);
  const attempt = store.ensureCheckout()!;
  store.setQuantity(jacket, 2);
  assert.equal(store.getSnapshot().checkout, null);
  assert.throws(() => store.completeCheckout(attempt.id));
  assert.equal(store.getSnapshot().order, null);
  assert.notEqual(store.ensureCheckout()?.id, attempt.id);
});

test("one completion persists the immutable outcome before notifying subscribers", () => {
  const { store, data, writes } = fixture();
  store.hydrate();
  store.addItem(jacket, 2);
  const attempt = store.ensureCheckout()!;
  let observed = false;
  const unsubscribe = store.subscribe(() => {
    if (!store.getSnapshot().order) return;
    observed = true;
    const saved = JSON.parse(data.get(COMMERCE_STORAGE_KEY)!);
    assert.equal(saved.order.id, store.getSnapshot().order!.id);
    assert.equal(saved.checkout.status, "completed");
    assert.deepEqual(saved.cart, []);
  });
  const before = writes();
  const order = store.completeCheckout(attempt.id);
  assert.equal(observed, true);
  assert.equal(store.completeCheckout(attempt.id), order);
  assert.equal(writes(), before + 1);
  assert.equal(order.snapshot.totalCents, 29600);
  assert.ok(Object.isFrozen(order));
  assert.ok(Object.isFrozen(order.snapshot.items[0]));
  unsubscribe();
  store.addItem(tee);
  assert.equal(order.snapshot.totalCents, 29600);
});

test("completed orders survive refresh and a fresh attempt creates a different order", () => {
  const { store, storage } = fixture();
  store.hydrate();
  store.addItem(jacket);
  const first = store.completeCheckout(store.ensureCheckout()!.id);
  const restored = createCommerceStore({ storage });
  restored.hydrate();
  assert.deepEqual(restored.getSnapshot().order, first);
  assert.equal(
    restored.completeCheckout(first.checkoutAttemptId)?.id,
    first.id,
  );
  assert.equal(restored.ensureCheckout(), null);
  store.addItem(tee);
  const next = store.completeCheckout(store.startCheckout()!.id);
  assert.notEqual(next.id, first.id);
  assert.equal(first.snapshot.items[0].productId, jacket);
  assert.equal(next.snapshot.items[0].productId, tee);
});

test("corrupt and structurally invalid saved records restore safe empty states", () => {
  const invalid = [
    "{",
    JSON.stringify({ version: 99, cart: [], checkout: null, order: null }),
    JSON.stringify({
      version: 1,
      cart: [{ productId: jacket, quantity: 1.5 }],
      checkout: null,
      order: null,
    }),
  ];
  for (const raw of invalid) {
    const { store } = fixture(raw);
    store.hydrate();
    assert.equal(store.getSnapshot().storageIssue, "corrupt");
    assert.deepEqual(store.getSnapshot().cart, []);
    assert.equal(store.getSnapshot().order, null);
    store.addItem(jacket);
    assert.equal(store.getSnapshot().storageIssue, null);
  }
});

test("inconsistent order totals and completed attempt identities are rejected", () => {
  const { store, data } = fixture();
  store.hydrate();
  store.addItem(jacket);
  store.completeCheckout(store.ensureCheckout()!.id);
  const saved = JSON.parse(data.get(COMMERCE_STORAGE_KEY)!);
  saved.order.snapshot.totalCents = 1;
  assert.throws(() => parseCommerceRecord(saved));
  saved.order.snapshot.totalCents = 14800;
  saved.checkout.id = "different-attempt";
  assert.throws(() => parseCommerceRecord(saved));
});

test("unavailable storage keeps commerce usable in memory", () => {
  const store = createCommerceStore({
    storage: () => {
      throw new Error("Blocked");
    },
  });
  store.hydrate();
  assert.equal(store.getSnapshot().storageIssue, "unavailable");
  store.addItem(jacket);
  const attempt = store.ensureCheckout()!;
  const order = store.completeCheckout(attempt.id);
  assert.equal(order.snapshot.totalCents, 14800);
  assert.equal(store.getSnapshot().order, order);
  assert.equal(store.getSnapshot().storageIssue, "unavailable");
  assert.deepEqual(store.getSnapshot().cart, []);
});

test("quota failure keeps the completed outcome and guard even without persistence", () => {
  const { store, data } = fixture(undefined, true);
  store.hydrate();
  store.addItem(jacket);
  const attempt = store.ensureCheckout()!;
  const order = store.completeCheckout(attempt.id);
  assert.equal(store.completeCheckout(attempt.id), order);
  assert.equal(store.getSnapshot().storageIssue, "unavailable");
  assert.equal(data.size, 0);
});
