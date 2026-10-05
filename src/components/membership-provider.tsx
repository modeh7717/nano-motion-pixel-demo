"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { membershipPlan } from "@/data/membership";
import { readStored, writeStored } from "@/lib/browser-storage";
import type { StorageIssue, StoragePort } from "@/lib/browser-storage";
import { freezePlan, parseMembershipRecord } from "@/lib/membership/model";
import type { Enrollment, MembershipRecord } from "@/lib/membership/model";
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

// Shared membership state and actions live with their provider. Browser access
// stays deferred until hydration or an action; each document retains one store.
export const MEMBERSHIP_STORAGE_KEY = "nano-motion:membership:v1";
type MembershipState = MembershipRecord &
  Readonly<{ ready: boolean; storageIssue: StorageIssue }>;
const emptyRecord: MembershipRecord = Object.freeze({
  version: 1,
  enrollment: null,
});
const serverState: MembershipState = Object.freeze({
  ...emptyRecord,
  ready: false,
  storageIssue: null,
});

export function createMembershipStore({
  storage = () => window.localStorage,
  uuid = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
  onEnroll,
}: {
  storage?: () => StoragePort;
  uuid?: () => string;
  now?: () => string;
  onEnroll?: (enrollment: Enrollment) => void;
} = {}) {
  let state = serverState;
  let enrolling = false;
  const listeners = new Set<() => void>();
  const publish = (next: MembershipState) => {
    state = Object.freeze(next);
    listeners.forEach((listener) => listener());
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
        MEMBERSHIP_STORAGE_KEY,
        parseMembershipRecord,
      );
      publish({
        ...(saved.value ?? emptyRecord),
        ready: true,
        storageIssue: saved.issue,
      });
    },
    enroll: (): Enrollment => {
      if (!state.ready)
        throw new Error("Your membership is still loading. Please try again.");
      if (state.enrollment) return state.enrollment;
      if (enrolling)
        throw new Error("Your demo membership is already being created.");
      enrolling = true;
      try {
        const enrollment = Object.freeze({
          id: `NM-PLUS-${uuid()}`,
          createdAt: now(),
          status: "active" as const,
          plan: freezePlan(membershipPlan),
        });
        const next: MembershipRecord = Object.freeze({
          version: 1,
          enrollment,
        });
        // Save the outcome before publication. A failed write still retains it in memory.
        const storageIssue = writeStored(storage, MEMBERSHIP_STORAGE_KEY, next);
        publish({ ...next, ready: true, storageIssue });
        try {
          onEnroll?.(enrollment);
        } catch {
          /* Enrollment remains complete. */
        }
        return enrollment;
      } finally {
        enrolling = false;
      }
    },
  };
}

export type MembershipStore = ReturnType<typeof createMembershipStore>;
