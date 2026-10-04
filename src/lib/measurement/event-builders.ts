import { products, getProductBySlug } from "../../data/products.ts";
import type { Product } from "../../data/products.ts";
import type {
  PurchaseSnapshot,
  CheckoutAttempt,
  Order,
} from "../commerce/model.ts";
import { lineTotal } from "../commerce/model.ts";
import type { Enrollment } from "../membership/model.ts";
import { membershipPlan } from "../../data/membership.ts";
import { identifier, positiveInteger } from "../validation.ts";
import type { EventName, MeasurementEvent, EventData } from "./types.ts";

function event(
  name: EventName,
  data: EventData,
  eventId?: string,
): MeasurementEvent {
  return Object.freeze({
    name,
    data: Object.freeze(data),
    ...(eventId ? { options: Object.freeze({ event_id: eventId }) } : {}),
  });
}
function productData(product: Product, quantity: number): EventData {
  if (
    product.currency !== "USD" ||
    !products.some(
      (item) => item.id === product.id && item.name === product.name,
    )
  )
    throw new Error("Invalid measurement product.");
  return {
    type: "contents",
    amount: lineTotal(product.priceCents, quantity),
    currency: "USD",
    contents: Object.freeze([
      Object.freeze({
        id: product.id,
        name: product.name,
        content_type: "product" as const,
        quantity,
      }),
    ]),
  };
}
export function buildProductViewed(product: Product) {
  return event("contents_viewed", productData(product, 1));
}
export function buildItemAdded(productId: string, quantity: number) {
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error("Unknown measurement product.");
  return event("items_added", productData(product, quantity));
}
function purchaseData(snapshot: PurchaseSnapshot): EventData {
  if (
    snapshot.currency !== "USD" ||
    !snapshot.items.length ||
    snapshot.items.length > products.length
  )
    throw new Error("Invalid measurement purchase.");
  const seen = new Set<string>();
  let total = 0;
  const contents = snapshot.items.map((item) => {
    if (
      seen.has(item.productId) ||
      !products.some(
        (product) =>
          product.id === item.productId && product.name === item.name,
      )
    )
      throw new Error("Invalid measurement contents.");
    seen.add(item.productId);
    total += lineTotal(item.unitPriceCents, item.quantity);
    positiveInteger(total);
    return Object.freeze({
      id: item.productId,
      name: item.name,
      content_type: "product" as const,
      quantity: item.quantity,
    });
  });
  if (total !== snapshot.totalCents)
    throw new Error("Invalid measurement total.");
  return {
    type: "contents",
    amount: total,
    currency: "USD",
    contents: Object.freeze(contents),
  };
}
export function buildCheckoutStarted(attempt: CheckoutAttempt) {
  if (attempt.status !== "active") throw new Error("Checkout is not active.");
  return event(
    "checkout_started",
    purchaseData(attempt.snapshot),
    `checkout_${identifier(attempt.id)}`,
  );
}
export function buildOrderCreated(order: Order) {
  return event(
    "order_created",
    purchaseData(order.snapshot),
    `order_${identifier(order.id)}`,
  );
}
export function buildSubscriptionCreated(enrollment: Enrollment) {
  const plan = enrollment.plan;
  if (
    enrollment.status !== "active" ||
    plan.id !== membershipPlan.id ||
    plan.currency !== "USD" ||
    plan.interval !== "month"
  )
    throw new Error("Invalid measurement enrollment.");
  positiveInteger(plan.amountCents);
  return event(
    "subscription_created",
    {
      type: "plan_enrollment",
      plan_id: plan.id,
      amount: plan.amountCents,
      currency: "USD",
    },
    `subscription_${identifier(enrollment.id)}`,
  );
}
const pages: Readonly<Record<string, { id: string; name: string }>> = {
  "/": { id: "home", name: "Nano Motion Home" },
  "/shop": { id: "shop", name: "Nano Motion Shop" },
  "/cart": { id: "cart", name: "Nano Motion Cart" },
  "/checkout": { id: "checkout", name: "Nano Motion Checkout" },
  "/order-confirmation": {
    id: "order-confirmation",
    name: "Nano Motion Order Confirmation",
  },
  "/membership": { id: "membership", name: "Nano Motion Plus" },
  "/membership-confirmation": {
    id: "membership-confirmation",
    name: "Nano Motion Membership Confirmation",
  },
};
export function buildRouteViewed(pathname: string): MeasurementEvent | null {
  if (Object.hasOwn(pages, pathname)) {
    return event("page_viewed", {
      type: "contents",
      contents: Object.freeze([
        Object.freeze({ ...pages[pathname], content_type: "page" as const }),
      ]),
    });
  }
  const match = /^\/product\/([^/]+)$/.exec(pathname);
  const product = match ? getProductBySlug(match[1]) : undefined;
  return product ? buildProductViewed(product) : null;
}
