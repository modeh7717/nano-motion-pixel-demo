"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { readStored, writeStored } from "@/lib/browser-storage";
import type { StorageIssue, StoragePort } from "@/lib/browser-storage";
import {
  parseCommerceRecord,
  purchaseSnapshot,
  samePurchase,
} from "@/lib/commerce/model";
import type {
  CartItem,
  CheckoutAttempt,
  CommerceRecord,
  Order,
} from "@/lib/commerce/model";
import { positiveInteger } from "@/lib/validation";
import { useMeasurement } from "@/components/measurement-provider";

const CommerceContext = createContext<CommerceStore | null>(null);

/**
 * Adapt vendor-independent commerce outcomes to the shared measurement store.
 * UI components call addItem/startCheckout/completeCheckout on the commerce
 * store; they do not construct OpenAI payloads or decide whether consent allows
 * dispatch. One committed commerce store is shared across storefront routes.
 */
export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const { actions: measurement } = useMeasurement();
  const [store] = useState(() =>
    createCommerceStore({
      onEvent: (event) => {
        // The commerce store commits its state and attempts storage before this
        // callback. It emits checkout/order outcomes once per new attempt/order,
        // not when restoring saved data. A storage failure still permits an
        // in-memory demo outcome; measurement failure cannot undo that outcome.
        // trackItemAdded receives the added delta, not the resulting cart total.
        if (event.type === "item-added")
          measurement.trackItemAdded(event.productId, event.quantity);
        else if (event.type === "checkout-started")
          measurement.trackCheckoutStarted(event.attempt);
        else measurement.trackOrderCreated(event.order);
      },
    }),
  );
  useEffect(() => {
    // Explicitly restore consent first rather than relying on parent/child
    // effect ordering. Both hydrate methods are idempotent. Commerce can then
    // become ready without checking actions against an unrestored preference.
    measurement.hydrate();
    store.hydrate();
  }, [store, measurement]);
  return (
    <CommerceContext.Provider value={store}>
      {children}
    </CommerceContext.Provider>
  );
}

// Expose the same external store to product, cart, checkout, and confirmation
// components. The initial server snapshot avoids localStorage reads during SSR.
export function useCommerce() {
  const store = useContext(CommerceContext);
  if (!store) throw new Error("CommerceProvider is missing.");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { state, actions: store };
}

// Storage is a demo convenience, not a prerequisite for shopping. Explain the
// actual persistence limitation: unavailable storage keeps outcomes in memory;
// corrupt records are rejected rather than turned into invented confirmations.
export function StorageNotice({
  issue,
  subject,
}: {
  issue: StorageIssue;
  subject: string;
}) {
  if (!issue) return null;
  return (
    <p className="storage-notice" role="status">
      {issue === "unavailable"
        ? `Browser storage is unavailable. Your ${subject} will remain available for this visit, but may be lost when you refresh or close the page.`
        : `Saved ${subject} data could not be read. Start a new demo journey to replace it safely.`}
    </p>
  );
}

// Browser state restores after hydration. Show a neutral loading message while
// that happens instead of briefly displaying a false empty/success state.
export function JourneyLoading({ label }: { label: string }) {
  return (
    <div className="container journey-loading" role="status">
      {label}
    </div>
  );
}

// Shared commerce state and actions live with their provider. Browser access
// stays deferred until hydration or an action; each document retains one store.
export type CommerceEvent =
  | { type: "item-added"; productId: string; quantity: number }
  | { type: "checkout-started"; attempt: CheckoutAttempt }
  | { type: "order-created"; order: Order };

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
  onEvent?: (event: CommerceEvent) => void;
};

export function createCommerceStore({
  storage = () => window.localStorage,
  uuid = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
  onEvent,
}: Dependencies = {}) {
  let state = serverState;
  let completing = false;
  const listeners = new Set<() => void>();
  const emit = (event: CommerceEvent) => {
    // Business outcomes never depend on optional instrumentation succeeding.
    try {
      onEvent?.(event);
    } catch {
      /* Commerce remains complete. */
    }
  };
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
    emit({ type: "checkout-started", attempt: checkout });
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
      emit({ type: "item-added", productId, quantity });
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
        emit({ type: "order-created", order });
        return order;
      } finally {
        completing = false;
      }
    },
  };
}

export type CommerceStore = ReturnType<typeof createCommerceStore>;
