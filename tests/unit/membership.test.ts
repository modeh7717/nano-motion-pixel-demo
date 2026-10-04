import assert from "node:assert/strict";
import { test } from "node:test";
import { membershipPlan } from "../../src/data/membership.ts";
import { parseMembershipRecord } from "../../src/lib/membership/model.ts";
import {
  createMembershipStore,
  MEMBERSHIP_STORAGE_KEY,
} from "../../src/lib/membership/store.ts";

function fixture(initial?: string, failWrites = false) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(MEMBERSHIP_STORAGE_KEY, initial);
  let writes = 0;
  let ids = 0;
  const storage = () => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes++;
      if (failWrites) throw new Error("Quota exceeded");
      data.set(key, value);
    },
  });
  const store = createMembershipStore({
    storage,
    uuid: () => `member-${++ids}`,
    now: () => "2026-10-04T03:00:00.000Z",
  });
  return { store, data, storage, writes: () => writes, ids: () => ids };
}

test("membership records the initial $19 monthly enrollment snapshot", () => {
  const { store } = fixture();
  store.hydrate();
  const enrollment = store.enroll();
  assert.equal(enrollment.plan.id, "nano-motion-plus-monthly");
  assert.equal(enrollment.plan.amountCents, 1900);
  assert.equal(enrollment.plan.currency, "USD");
  assert.equal(enrollment.plan.interval, "month");
  assert.equal(enrollment.status, "active");
  assert.ok(Object.isFrozen(enrollment));
  assert.ok(Object.isFrozen(enrollment.plan));
  assert.ok(Object.isFrozen(enrollment.plan.benefits));
});

test("browsing and repeated hydration never create or persist enrollment", () => {
  const { store, writes, ids } = fixture();
  assert.equal(store.getSnapshot().ready, false);
  assert.throws(() => store.enroll());
  store.hydrate();
  store.hydrate();
  assert.equal(store.getSnapshot().enrollment, null);
  assert.equal(writes(), 0);
  assert.equal(ids(), 0);
});

test("rapid repeated enrollment saves one outcome before notifying subscribers", () => {
  const { store, data, writes, ids } = fixture();
  store.hydrate();
  let observed = false;
  store.subscribe(() => {
    const enrollment = store.getSnapshot().enrollment;
    observed = true;
    assert.equal(
      JSON.parse(data.get(MEMBERSHIP_STORAGE_KEY)!).enrollment.id,
      enrollment!.id,
    );
    assert.equal(store.enroll(), enrollment);
  });
  const enrollment = store.enroll();
  assert.equal(store.enroll(), enrollment);
  assert.equal(store.enroll(), enrollment);
  assert.equal(observed, true);
  assert.equal(writes(), 1);
  assert.equal(ids(), 1);
});

test("refresh restores the existing enrollment and Join never creates another ID", () => {
  const { store, storage, writes } = fixture();
  store.hydrate();
  const enrollment = store.enroll();
  const restored = createMembershipStore({
    storage,
    uuid: () => {
      throw new Error("Must not generate another ID");
    },
  });
  restored.hydrate();
  assert.deepEqual(restored.enroll(), enrollment);
  assert.equal(writes(), 1);
});

test("corrupt or invalid saved memberships restore an empty, recoverable state", () => {
  const valid = {
    version: 1,
    enrollment: {
      id: "NM-PLUS-saved",
      createdAt: "2026-10-04T03:00:00.000Z",
      status: "active",
      plan: membershipPlan,
    },
  };
  const invalidRecords = [
    "{",
    JSON.stringify({ ...valid, version: 99 }),
    JSON.stringify({ version: 1, enrollment: { ...valid.enrollment, id: "" } }),
    JSON.stringify({
      version: 1,
      enrollment: { ...valid.enrollment, createdAt: "invalid" },
    }),
    JSON.stringify({
      version: 1,
      enrollment: { ...valid.enrollment, status: "inactive" },
    }),
    JSON.stringify({
      version: 1,
      enrollment: {
        ...valid.enrollment,
        plan: { ...membershipPlan, id: "unknown-plan" },
      },
    }),
    JSON.stringify({
      version: 1,
      enrollment: {
        ...valid.enrollment,
        plan: { ...membershipPlan, amountCents: 19.5 },
      },
    }),
    JSON.stringify({
      version: 1,
      enrollment: {
        ...valid.enrollment,
        plan: { ...membershipPlan, amountCents: -1900 },
      },
    }),
    JSON.stringify({
      version: 1,
      enrollment: {
        ...valid.enrollment,
        plan: { ...membershipPlan, benefits: [123] },
      },
    }),
  ];
  for (const raw of invalidRecords) {
    const { store } = fixture(raw);
    store.hydrate();
    assert.equal(store.getSnapshot().enrollment, null);
    assert.equal(store.getSnapshot().storageIssue, "corrupt");
    assert.equal(store.enroll().plan.amountCents, 1900);
    assert.equal(store.getSnapshot().storageIssue, null);
  }
});

test("saved null enrollment is valid and unsafe monetary values are rejected", () => {
  assert.deepEqual(parseMembershipRecord({ version: 1, enrollment: null }), {
    version: 1,
    enrollment: null,
  });
  for (const amountCents of [0, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() =>
      parseMembershipRecord({
        version: 1,
        enrollment: {
          id: "saved",
          createdAt: "2026-10-04T03:00:00.000Z",
          status: "active",
          plan: { ...membershipPlan, amountCents },
        },
      }),
    );
});

test("blocked browser storage still allows one enrollment in memory", () => {
  const dependencies = {
    storage: () => {
      throw new Error("Blocked");
    },
  };
  const store = createMembershipStore(dependencies);
  store.hydrate();
  const enrollment = store.enroll();
  assert.equal(store.enroll(), enrollment);
  assert.equal(store.getSnapshot().storageIssue, "unavailable");
  const refreshed = createMembershipStore(dependencies);
  refreshed.hydrate();
  assert.equal(refreshed.getSnapshot().enrollment, null);
});

test("quota failure retains the same enrollment and never claims it is saved", () => {
  const { store, data, writes, ids } = fixture(undefined, true);
  store.hydrate();
  const enrollment = store.enroll();
  assert.equal(store.enroll(), enrollment);
  assert.equal(store.getSnapshot().enrollment, enrollment);
  assert.equal(store.getSnapshot().storageIssue, "unavailable");
  assert.equal(writes(), 1);
  assert.equal(ids(), 1);
  assert.equal(data.size, 0);
});
