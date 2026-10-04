import { readStored, writeStored } from "../browser-storage.ts";
import type { StorageIssue, StoragePort } from "../browser-storage.ts";
import {
  parseCommerceRecord,
  purchaseSnapshot,
  samePurchase,
} from "./model.ts";
import { positiveInteger } from "../validation.ts";
import type { CartItem, CommerceRecord, Order } from "./model.ts";

export const COMMERCE_STORAGE_KEY = "nano-motion:commerce:v1";
const emptyRecord: CommerceRecord = Object.freeze({
  version: 1,
  cart: Object.freeze([]),
  checkout: null,
  order: null,
});
export type CommerceState = CommerceRecord &
  Readonly<{ ready: boolean; storageIssue: StorageIssue }>;
const serverState: CommerceState = Object.freeze({
  ...emptyRecord,
  ready: false,
  storageIssue: null,
});

type Dependencies = {
  storage?: () => StoragePort;
  uuid?: () => string;
  now?: () => string;
};

export function createCommerceStore({
  storage = () => window.localStorage,
  uuid = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
}: Dependencies = {}) {
  let state = serverState;
  let completing = false;
  const listeners = new Set<() => void>();
  const publish = (next: CommerceState) => {
    state = Object.freeze(next);
    listeners.forEach((listener) => listener());
  };
  const save = (next: CommerceRecord) => {
    // One write closes the attempt, saves its immutable order, and clears the cart.
    // A failed write leaves the full outcome in memory for this browser document.
    const storageIssue = writeStored(storage, COMMERCE_STORAGE_KEY, next);
    publish({ ...next, ready: true, storageIssue });
  };
  const requireReady = () => {
    if (!state.ready)
      throw new Error("Your cart is still loading. Please try again.");
  };
  const updateCart = (items: readonly CartItem[]) => {
    if (items.length) purchaseSnapshot(items);
    const cart = Object.freeze(items.map((item) => Object.freeze({ ...item })));
    save({ version: 1, cart, checkout: null, order: state.order });
  };
  const beginCheckout = (newAttempt: boolean) => {
    requireReady();
    if (!state.cart.length) return null;
    const snapshot = purchaseSnapshot(state.cart);
    if (
      !newAttempt &&
      state.checkout?.status === "active" &&
      samePurchase(state.checkout.snapshot, snapshot)
    )
      return state.checkout;
    const checkout = Object.freeze({
      id: `checkout_${uuid()}`,
      createdAt: now(),
      status: "active" as const,
      snapshot,
    });
    save({ version: 1, cart: state.cart, checkout, order: state.order });
    return checkout;
  };

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => serverState,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate: () => {
      if (state.ready) return;
      const saved = readStored(
        storage,
        COMMERCE_STORAGE_KEY,
        parseCommerceRecord,
      );
      publish({
        ...(saved.value ?? emptyRecord),
        ready: true,
        storageIssue: saved.issue,
      });
    },
    addItem: (productId: string, quantity = 1) => {
      requireReady();
      positiveInteger(quantity);
      const existing = state.cart.find((item) => item.productId === productId);
      const cart = existing
        ? state.cart.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...state.cart, { productId, quantity }];
      updateCart(cart);
    },
    setQuantity: (productId: string, quantity: number) => {
      requireReady();
      positiveInteger(quantity);
      if (!state.cart.some((item) => item.productId === productId))
        throw new Error("That essential is no longer in your cart.");
      updateCart(
        state.cart.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        ),
      );
    },
    removeItem: (productId: string) => {
      requireReady();
      updateCart(state.cart.filter((item) => item.productId !== productId));
    },
    startCheckout: () => beginCheckout(true),
    ensureCheckout: () => beginCheckout(false),
    completeCheckout: (attemptId: string): Order => {
      requireReady();
      if (state.order?.checkoutAttemptId === attemptId) return state.order;
      if (completing)
        throw new Error("Your demo order is already being completed.");
      completing = true;
      try {
        const attempt = state.checkout;
        if (!attempt || attempt.id !== attemptId || attempt.status !== "active")
          throw new Error(
            "Your cart has changed. Please begin checkout again.",
          );
        const snapshot = purchaseSnapshot(state.cart);
        if (!samePurchase(snapshot, attempt.snapshot))
          throw new Error(
            "Your cart has changed. Please begin checkout again.",
          );
        const order = Object.freeze({
          id: `NM-${uuid()}`,
          checkoutAttemptId: attempt.id,
          createdAt: now(),
          snapshot,
        });
        save({
          version: 1,
          cart: Object.freeze([]),
          checkout: Object.freeze({ ...attempt, status: "completed" }),
          order,
        });
        return order;
      } finally {
        completing = false;
      }
    },
  };
}

export type CommerceStore = ReturnType<typeof createCommerceStore>;
