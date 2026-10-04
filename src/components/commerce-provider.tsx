"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createCommerceStore } from "@/lib/commerce/store";
import type { CommerceStore } from "@/lib/commerce/store";
import type { StorageIssue } from "@/lib/browser-storage";
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
