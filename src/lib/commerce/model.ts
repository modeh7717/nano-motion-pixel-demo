import { products } from "../../data/products.ts";

export type CartItem = Readonly<{ productId: string; quantity: number }>;
export type OrderItem = Readonly<{
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}>;
export type PurchaseSnapshot = Readonly<{
  items: readonly OrderItem[];
  totalCents: number;
  currency: "USD";
}>;
export type CheckoutAttempt = Readonly<{
  id: string;
  createdAt: string;
  status: "active" | "completed";
  snapshot: PurchaseSnapshot;
}>;
export type Order = Readonly<{
  id: string;
  checkoutAttemptId: string;
  createdAt: string;
  snapshot: PurchaseSnapshot;
}>;
export type CommerceRecord = Readonly<{
  version: 1;
  cart: readonly CartItem[];
  checkout: CheckoutAttempt | null;
  order: Order | null;
}>;

export function positiveInteger(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Use a positive whole-number quantity or amount.");
  }
}

export function lineTotal(unitPriceCents: number, quantity: number): number {
  positiveInteger(unitPriceCents);
  positiveInteger(quantity);
  const total = unitPriceCents * quantity;
  positiveInteger(total);
  return total;
}

export function purchaseSnapshot(cart: readonly CartItem[]): PurchaseSnapshot {
  if (cart.length === 0)
    throw new Error("Add an essential before checking out.");
  const seen = new Set<string>();
  const items = cart.map(({ productId, quantity }) => {
    const product = products.find((item) => item.id === productId);
    if (!product || seen.has(productId)) throw new Error("Invalid cart item.");
    seen.add(productId);
    lineTotal(product.priceCents, quantity);
    return Object.freeze({
      productId,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity,
    });
  });
  const totalCents = snapshotTotal(items);
  return Object.freeze({
    items: Object.freeze(items),
    totalCents,
    currency: "USD",
  });
}

function snapshotTotal(items: readonly OrderItem[]): number {
  let total = 0;
  for (const item of items) {
    total += lineTotal(item.unitPriceCents, item.quantity);
    positiveInteger(total);
  }
  return total;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid saved data.");
  return value as Record<string, unknown>;
}

export function identifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > 128
  )
    throw new Error("Invalid saved identifier.");
  return value;
}

export function timestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error("Invalid saved date.");
  return value;
}

function parseSnapshot(value: unknown): PurchaseSnapshot {
  const data = record(value);
  if (
    data.currency !== "USD" ||
    !Array.isArray(data.items) ||
    data.items.length === 0 ||
    data.items.length > products.length
  )
    throw new Error("Invalid saved purchase.");
  const seen = new Set<string>();
  const items = data.items.map((value) => {
    const item = record(value);
    const productId = identifier(item.productId);
    const product = products.find((product) => product.id === productId);
    if (!product || item.name !== product.name || seen.has(productId))
      throw new Error("Invalid saved product.");
    seen.add(productId);
    positiveInteger(item.unitPriceCents);
    positiveInteger(item.quantity);
    return Object.freeze({
      productId,
      name: product.name,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    });
  });
  const totalCents = snapshotTotal(items);
  if (data.totalCents !== totalCents) throw new Error("Invalid saved total.");
  return Object.freeze({
    items: Object.freeze(items),
    totalCents,
    currency: "USD",
  });
}

export function samePurchase(
  a: PurchaseSnapshot,
  b: PurchaseSnapshot,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function parseCommerceRecord(value: unknown): CommerceRecord {
  const data = record(value);
  if (
    data.version !== 1 ||
    !Array.isArray(data.cart) ||
    data.cart.length > products.length
  )
    throw new Error("Invalid saved cart.");
  const cart = Object.freeze(
    data.cart.map((value) => {
      const item = record(value);
      const productId = identifier(item.productId);
      positiveInteger(item.quantity);
      return Object.freeze({ productId, quantity: item.quantity });
    }),
  );
  const currentPurchase = cart.length ? purchaseSnapshot(cart) : null;
  let order: Order | null = null;
  if (data.order !== null) {
    const saved = record(data.order);
    order = Object.freeze({
      id: identifier(saved.id),
      checkoutAttemptId: identifier(saved.checkoutAttemptId),
      createdAt: timestamp(saved.createdAt),
      snapshot: parseSnapshot(saved.snapshot),
    });
  }
  let checkout: CheckoutAttempt | null = null;
  if (data.checkout !== null) {
    const saved = record(data.checkout);
    if (saved.status !== "active" && saved.status !== "completed")
      throw new Error("Invalid saved checkout.");
    checkout = Object.freeze({
      id: identifier(saved.id),
      createdAt: timestamp(saved.createdAt),
      status: saved.status,
      snapshot: parseSnapshot(saved.snapshot),
    });
    if (
      checkout.status === "active" &&
      (!currentPurchase ||
        !samePurchase(checkout.snapshot, currentPurchase) ||
        order?.checkoutAttemptId === checkout.id)
    )
      throw new Error("Stale saved checkout.");
    if (
      checkout.status === "completed" &&
      (!order ||
        order.checkoutAttemptId !== checkout.id ||
        !samePurchase(checkout.snapshot, order.snapshot) ||
        cart.length !== 0)
    )
      throw new Error("Invalid completed checkout.");
  }
  return Object.freeze({ version: 1, cart, checkout, order });
}
