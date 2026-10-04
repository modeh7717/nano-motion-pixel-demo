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

export function MembershipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actions: measurement } = useMeasurement();
  const [store] = useState(() =>
    createMembershipStore({ onEnroll: measurement.trackSubscriptionCreated }),
  );
  useEffect(() => {
    measurement.hydrate();
    store.hydrate();
  }, [store, measurement]);
  return (
    <MembershipContext.Provider value={store}>
      {children}
    </MembershipContext.Provider>
  );
}

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
