import { membershipPlan } from "../../data/membership.ts";
import { readStored, writeStored } from "../browser-storage.ts";
import type { StorageIssue, StoragePort } from "../browser-storage.ts";
import { freezePlan, parseMembershipRecord } from "./model.ts";
import type { Enrollment, MembershipRecord } from "./model.ts";

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
}: {
  storage?: () => StoragePort;
  uuid?: () => string;
  now?: () => string;
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
        return enrollment;
      } finally {
        enrolling = false;
      }
    },
  };
}

export type MembershipStore = ReturnType<typeof createMembershipStore>;
