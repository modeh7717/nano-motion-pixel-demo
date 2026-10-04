"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createMembershipStore } from "@/lib/membership/store";
import type { MembershipStore } from "@/lib/membership/store";
import { useMeasurement } from "@/components/measurement-provider";

const MembershipContext = createContext<MembershipStore | null>(null);

/**
 * Share the fictional membership store across routes and connect a new saved
 * enrollment to subscription_created. This is a simulated $19 initial monthly
 * enrollment; it does not call a billing service or represent renewal revenue.
 */
export function MembershipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actions: measurement } = useMeasurement();
  const [store] = useState(() =>
    // onEnroll receives the committed enrollment snapshot after a storage
    // attempt. Restoring or reusing an existing enrollment does not invoke it.
    // Measurement builds the plan payload and subscription_<enrollment ID>, then
    // applies the same consent/readiness gate used for shopping events.
    createMembershipStore({ onEnroll: measurement.trackSubscriptionCreated }),
  );
  useEffect(() => {
    // Restore the shared preference before exposing restored membership state.
    // Neither hydration step creates an enrollment or backfills a conversion.
    measurement.hydrate();
    store.hydrate();
  }, [store, measurement]);
  return (
    <MembershipContext.Provider value={store}>
      {children}
    </MembershipContext.Provider>
  );
}

// Plan and confirmation components read one shared store. The initial server
// snapshot is empty/unready; localStorage is accessed only after hydration.
export function useMembership() {
  const store = useContext(MembershipContext);
  if (!store) throw new Error("MembershipProvider is missing.");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { state, actions: store };
}
