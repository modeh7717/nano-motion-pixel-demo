import { readStored, writeStored } from "../browser-storage.ts";
import type { StorageIssue, StoragePort } from "../browser-storage.ts";
import { record } from "../validation.ts";
import { createInstrumentationLog } from "./diagnostics.ts";
import {
  buildRouteViewed,
  buildItemAdded,
  buildCheckoutStarted,
  buildOrderCreated,
  buildSubscriptionCreated,
} from "./event-builders.ts";
import type { CheckoutAttempt, Order } from "../commerce/model.ts";
import type { Enrollment } from "../membership/model.ts";
import type {
  ConsentPreference,
  SdkStatus,
  PixelDriver,
  MeasurementEvent,
  DispatchResult,
  EventName,
} from "./types.ts";

export const CONSENT_STORAGE_KEY = "nano-motion:consent:v1";
export function parseConsent(value: unknown): ConsentPreference {
  const data = record(value);
  if (
    data.version !== 1 ||
    !["unknown", "accepted", "declined"].includes(data.preference as string)
  )
    throw new Error("Invalid measurement preference.");
  return data.preference as ConsentPreference;
}
type MeasurementState = Readonly<{
  ready: boolean;
  preference: ConsentPreference;
  storageIssue: StorageIssue;
  sdkStatus: SdkStatus;
  error: string | null;
}>;
const initial: MeasurementState = Object.freeze({
  ready: false,
  preference: "unknown",
  storageIssue: null,
  sdkStatus: "idle",
  error: null,
});

export function createMeasurementStore({
  driver,
  pixelId,
  debug = false,
  storage = () => window.localStorage,
}: {
  driver: PixelDriver;
  pixelId: string;
  debug?: boolean | (() => boolean);
  storage?: () => StoragePort;
}) {
  let state = initial;
  let visit: { pathname: string; measured: boolean; observed: boolean } | null =
    null;
  const diagnostics = createInstrumentationLog();
  const listeners = new Set<() => void>();
  const publish = (next: Partial<MeasurementState>) => {
    state = Object.freeze({ ...state, ...next });
    listeners.forEach((listener) => listener());
  };
  const dispatch = (
    name: EventName,
    build: () => MeasurementEvent,
  ): DispatchResult => {
    let event: MeasurementEvent;
    try {
      event = build();
    } catch {
      return diagnostics.record(name, null, {
        status: "suppressed",
        reason: "Invalid event data.",
      });
    }
    if (!state.ready || state.preference !== "accepted")
      return diagnostics.record(name, event, {
        status: "suppressed",
        reason: "Measurement consent is not accepted.",
      });
    if (state.sdkStatus === "failed")
      return diagnostics.record(name, event, {
        status: "failed",
        reason: state.error ?? "Measurement SDK failed.",
      });
    if (state.sdkStatus !== "ready")
      return diagnostics.record(name, event, {
        status: "suppressed",
        reason: "Measurement SDK is loading; this action will not be replayed.",
      });
    try {
      driver.measure(event);
      return diagnostics.record(name, event, {
        status: "handed_to_sdk",
        reason: "Local SDK handoff; receipt is not verified.",
      });
    } catch {
      publish({
        sdkStatus: "failed",
        error: "Measurement dispatch failed. Shopping remains available.",
      });
      return diagnostics.record(name, event, {
        status: "failed",
        reason: state.error!,
      });
    }
  };
  const view = () => {
    if (!visit || visit.measured) return;
    const event = buildRouteViewed(visit.pathname);
    if (!event) return;
    if (state.preference !== "accepted" || state.sdkStatus !== "ready") {
      if (!visit.observed) {
        visit.observed = true;
        dispatch(event.name, () => event);
      }
      return;
    }
    visit.measured = true;
    dispatch(event.name, () => event);
  };
  const setSdkConsent = (accepted: boolean) => {
    try {
      driver.consent(accepted);
      return true;
    } catch {
      publish({
        sdkStatus: "failed",
        error: "Measurement preference could not be applied to the SDK.",
      });
      return false;
    }
  };
  const start = () => {
    if (state.preference !== "accepted" || state.sdkStatus !== "idle") return;
    if (!pixelId.trim()) {
      publish({
        sdkStatus: "failed",
        error: "A public Pixel ID is not configured.",
      });
      return;
    }
    publish({ sdkStatus: "loading" });
    try {
      driver
        .load({ pixelId, debug: typeof debug === "function" ? debug() : debug })
        .then(
          () => {
            if (state.sdkStatus !== "loading") return;
            if (!setSdkConsent(state.preference === "accepted")) return;
            publish({ sdkStatus: "ready" });
            view();
          },
          () =>
            publish({
              sdkStatus: "failed",
              error:
                "Measurement script could not load. Shopping remains available.",
            }),
        );
    } catch {
      publish({
        sdkStatus: "failed",
        error: "Measurement initialization failed. Shopping remains available.",
      });
    }
  };
  const applyPreference = (
    preference: ConsentPreference,
    storageIssue: StorageIssue,
  ) => {
    if (preference === "accepted" && state.sdkStatus === "ready") {
      if (!setSdkConsent(true)) return;
      publish({ preference, storageIssue });
      view();
    } else {
      publish({ preference, storageIssue });
      if (preference !== "accepted") setSdkConsent(false);
      else start();
    }
  };
  return {
    diagnostics,
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate: () => {
      if (state.ready) return;
      const saved = readStored(storage, CONSENT_STORAGE_KEY, parseConsent);
      publish({ ready: true });
      applyPreference(saved.value ?? "unknown", saved.issue);
    },
    setPreference: (preference: ConsentPreference) => {
      if (!state.ready) return;
      if (!["unknown", "accepted", "declined"].includes(preference)) return;
      // Close the local gate before any persistence or SDK work on revocation.
      if (preference !== "accepted") {
        publish({ preference });
        setSdkConsent(false);
        diagnostics.clear();
      }
      const storageIssue = writeStored(storage, CONSENT_STORAGE_KEY, {
        version: 1,
        preference,
      });
      applyPreference(preference, storageIssue);
    },
    syncPreference: (raw: string | null) => {
      let preference: ConsentPreference = "unknown";
      let issue: StorageIssue = null;
      try {
        if (raw !== null) preference = parseConsent(JSON.parse(raw));
      } catch {
        issue = "corrupt";
      }
      applyPreference(preference, issue);
      if (preference !== "accepted") diagnostics.clear();
    },
    observeRoute: (pathname: string) => {
      if (visit?.pathname !== pathname)
        visit = { pathname, measured: false, observed: false };
      view();
    },
    trackItemAdded: (productId: string, quantity: number) =>
      dispatch("items_added", () => buildItemAdded(productId, quantity)),
    trackCheckoutStarted: (attempt: CheckoutAttempt) =>
      dispatch("checkout_started", () => buildCheckoutStarted(attempt)),
    trackOrderCreated: (order: Order) =>
      dispatch("order_created", () => buildOrderCreated(order)),
    trackSubscriptionCreated: (enrollment: Enrollment) =>
      dispatch("subscription_created", () =>
        buildSubscriptionCreated(enrollment),
      ),
  };
}
export type MeasurementStore = ReturnType<typeof createMeasurementStore>;
