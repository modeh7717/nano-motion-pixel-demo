import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createInstrumentationLog,
  DIAGNOSTIC_LIMIT,
  createMeasurementStore,
} from "../../src/components/measurement-provider.tsx";
import { buildItemAdded } from "../../src/lib/measurement/event-builders.ts";
import type { MeasurementEvent } from "../../src/lib/measurement/types.ts";

function fixture(debug: boolean | (() => boolean) = false) {
  const measured: MeasurementEvent[] = [];
  const configurations: { pixelId: string; debug: boolean }[] = [];
  let resolve!: () => void;
  const pending = new Promise<void>((yes) => {
    resolve = yes;
  });
  const store = createMeasurementStore({
    pixelId: "test-pixel",
    debug,
    storage: () => ({ getItem: () => null, setItem: () => {} }),
    driver: {
      load: (config) => {
        configurations.push(config);
        return pending;
      },
      consent: () => {},
      measure: (event) => {
        measured.push(event);
      },
    },
  });
  const loaded = async () => {
    resolve();
    await pending;
    await Promise.resolve();
  };
  return { store, measured, configurations, loaded };
}
test("the observation log keeps only the latest 100 frozen entries and never persists them", () => {
  const log = createInstrumentationLog(() => "2026-10-04T04:00:00.000Z");
  const event = buildItemAdded("NM-RUN-001", 1);
  const result = { status: "suppressed" as const, reason: "Test consent" };
  for (let i = 0; i < 140; i++) log.record(event.name, event, result);
  result.reason = "Changed externally";
  const entries = log.getSnapshot();
  assert.equal(entries.length, DIAGNOSTIC_LIMIT);
  assert.equal(entries[0].sequence, 41);
  assert.equal(entries[99].sequence, 140);
  assert.equal(entries[0].timestamp, "2026-10-04T04:00:00.000Z");
  assert.equal(entries[0].result.reason, "Test consent");
  assert.ok(Object.isFrozen(entries));
  assert.ok(Object.isFrozen(entries[0]));
  assert.ok(Object.isFrozen(entries[0].result));
});
test("suppressed/loading observations never become a replay source after SDK readiness", async () => {
  const { store, measured, loaded } = fixture();
  store.observeRoute("/product/aero-run-jacket");
  store.hydrate();
  store.trackItemAdded("NM-RUN-001", 1);
  store.setPreference("accepted");
  store.trackItemAdded("NM-RUN-001", 1);
  const suppressed = store.diagnostics.getSnapshot();
  assert.equal(suppressed.length, 3);
  assert.ok(suppressed.every((entry) => entry.result.status === "suppressed"));
  await loaded();
  assert.deepEqual(
    measured.map((event) => event.name),
    ["contents_viewed"],
  );
  assert.equal(
    store.diagnostics.getSnapshot().at(-1)!.result.status,
    "handed_to_sdk",
  );
  assert.equal(
    store.diagnostics.getSnapshot().at(-1)!.event!.data.amount,
    14800,
  );
});
test("clearing observations never changes consent, submits measurements, or creates outcomes", async () => {
  const { store, measured, loaded } = fixture();
  store.hydrate();
  store.observeRoute("/");
  store.setPreference("accepted");
  await loaded();
  store.trackItemAdded("NM-RUN-001", 1);
  const before = store.getSnapshot();
  const count = measured.length;
  store.diagnostics.clear();
  store.observeRoute("/");
  assert.equal(store.diagnostics.getSnapshot().length, 0);
  assert.equal(store.getSnapshot(), before);
  assert.equal(measured.length, count);
});
test("revocation/reset clear prior diagnostics and invalid data is recorded without its raw input", async () => {
  const { store, loaded } = fixture();
  store.hydrate();
  store.observeRoute("/");
  store.setPreference("accepted");
  await loaded();
  store.setPreference("declined");
  assert.equal(store.diagnostics.getSnapshot().length, 0);
  store.trackItemAdded("NM-RUN-001", 1);
  assert.equal(store.diagnostics.getSnapshot()[0].result.status, "suppressed");
  store.setPreference("unknown");
  assert.equal(store.diagnostics.getSnapshot().length, 0);
  store.trackItemAdded("private-invalid-input", 1);
  const entry = store.diagnostics.getSnapshot()[0];
  assert.equal(entry.name, "items_added");
  assert.equal(entry.event, null);
  assert.equal(JSON.stringify(entry).includes("private-invalid-input"), false);
});
test("SDK debug configuration is resolved at consented initialization and never reinitializes the document", async () => {
  let enabled = false;
  const { store, loaded, configurations } = fixture(() => enabled);
  store.hydrate();
  assert.equal(configurations.length, 0);
  enabled = true;
  store.setPreference("accepted");
  await loaded();
  enabled = false;
  store.setPreference("declined");
  store.setPreference("accepted");
  assert.deepEqual(configurations, [{ pixelId: "test-pixel", debug: true }]);
});

test("revocation closes the consent gate before notifying diagnostic-clear subscribers", async () => {
  const { store, loaded, measured } = fixture();
  store.hydrate();
  store.observeRoute("/");
  store.setPreference("accepted");
  await loaded();
  const count = measured.length;
  store.diagnostics.subscribe(() => {
    if (store.diagnostics.getSnapshot().length === 0)
      store.trackItemAdded("NM-RUN-001", 1);
  });
  store.setPreference("declined");
  assert.equal(measured.length, count);
  assert.equal(store.diagnostics.getSnapshot()[0].result.status, "suppressed");
  store.syncPreference(null);
  assert.equal(measured.length, count);
  assert.equal(store.getSnapshot().preference, "unknown");
});
