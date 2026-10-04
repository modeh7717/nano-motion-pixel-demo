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

const MembershipContext = createContext<MembershipStore | null>(null);

export function MembershipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store] = useState(() => createMembershipStore());
  useEffect(() => {
    store.hydrate();
  }, [store]);
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
