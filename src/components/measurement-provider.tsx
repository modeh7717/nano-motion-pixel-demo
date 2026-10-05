"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import { readStored, writeStored } from "@/lib/browser-storage";
import type { StorageIssue, StoragePort } from "@/lib/browser-storage";
import { record } from "@/lib/validation";
import {
  buildRouteViewed,
  buildItemAdded,
  buildCheckoutStarted,
  buildOrderCreated,
  buildSubscriptionCreated,
} from "@/lib/measurement/event-builders";
import type { CheckoutAttempt, Order } from "@/lib/commerce/model";
import type { Enrollment } from "@/lib/membership/model";
import type {
  ConsentPreference,
  SdkStatus,
  PixelDriver,
  MeasurementEvent,
  DispatchResult,
  EventName,
} from "@/lib/measurement/types";
import { createBrowserPixelDriver } from "@/lib/measurement/openai-pixel";

/**
 * Share consent, SDK readiness, event actions, and local observations across the
 * storefront. Their state and rules live in this file with the React context,
 * navigation observer, and consent UI. Event builders format the payloads;
 * openai-pixel.ts owns SDK loading and commands.
 */
const MeasurementContext = createContext<MeasurementStore | null>(null);
export function MeasurementProvider({
  children,
  pixelId,
}: {
  children: React.ReactNode;
  pixelId: string;
}) {
  // Retain the same committed store/driver across rerenders and client navigation.
  // Constructing them is safe during server rendering: browser-dependent work
  // is deferred until effects or a consented SDK initialization run.
  const [store] = useState(() =>
    createMeasurementStore({
      driver: createBrowserPixelDriver(),
      pixelId,
      // Resolve debug mode when the SDK initializes, not when React creates the
      // store. A later query-flag change can show the log but does not reinitialize
      // the SDK or change the debug option already supplied to it.
      debug: () =>
        process.env.NODE_ENV === "development" ||
        new URLSearchParams(window.location.search).get("measurementDebug") ===
          "true",
    }),
  );
  useEffect(() => {
    // Hydration reads nano-motion:consent:v1 from localStorage. Until this has
    // completed, the store treats measurement as unavailable. Its hydrate()
    // guard makes repeated calls (including effect replay) safe.
    store.hydrate();
    const sync = (event: StorageEvent) => {
      // Browser storage events report changes from another document on the same
      // origin. A null key means localStorage.clear(); a removed record has a
      // null newValue. Both restore unknown consent and close the local gate.
      // Same-tab choices call setPreference() directly instead of waiting here.
      if (event.key === CONSENT_STORAGE_KEY || event.key === null)
        store.syncPreference(event.key === null ? null : event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [store]);
  return (
    <MeasurementContext.Provider value={store}>
      <RouteObserver />
      {children}
    </MeasurementContext.Provider>
  );
}
// Subscribe to immutable store snapshots with React's external-store API. The
// server snapshot is a browser-independent initial state, so server HTML and the
// first hydration render agree before saved preferences are restored.
export function useMeasurement() {
  const store = useContext(MeasurementContext);
  if (!store) throw new Error("MeasurementProvider is missing.");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { state, actions: store };
}
// Observe committed pathnames rather than clicks: direct entry, client links,
// and back/forward navigation all use this path. Query/hash-only changes do not
// count as new visits. The store chooses page_viewed or contents_viewed, excludes
// unknown routes, and prevents rerenders/effect replay from duplicating a visit.
function RouteObserver() {
  const pathname = usePathname();
  const { actions } = useMeasurement();
  useEffect(() => {
    actions.observeRoute(pathname);
  }, [pathname, actions]);
  return null;
}
// Keep the banner hidden until preference restoration finishes to avoid flashing
// a new choice at a returning visitor. These buttons update the application
// store; that store persists the choice and applies the corresponding SDK consent.
export function ConsentBanner() {
  const { state, actions } = useMeasurement();
  if (!state.ready || state.preference !== "unknown") return null;
  return (
    <section className="consent-banner" aria-label="Measurement preference">
      <div>
        <h2>Your measurement choice</h2>
        <p>
          Allow OpenAI measurement to understand visits and simulated purchases
          on this demo? Shopping works with either choice. You can change it in
          the footer.
        </p>
        {state.storageIssue && (
          <p className="consent-note" role="status">
            {state.storageIssue === "corrupt"
              ? "Your saved preference could not be read. Please choose again."
              : "Browser storage is unavailable. Your choice applies to this visit."}
          </p>
        )}
      </div>
      <div className="consent-actions">
        <button type="button" onClick={() => actions.setPreference("accepted")}>
          Accept measurement
        </button>
        <button type="button" onClick={() => actions.setPreference("declined")}>
          Decline
        </button>
      </div>
    </section>
  );
}
// Reset = unknown (show the banner again); revoke = declined. Both close the
// measurement gate and clear diagnostics immediately. Neither operation clears
// the cart or creates/replays events. SDK consent(false) handles Pixel cookies;
// the app's separate preference record remains in localStorage.
export function MeasurementPreferences() {
  const { state, actions } = useMeasurement();
  return (
    <div className="measurement-preferences">
      <span>Measurement: {state.ready ? state.preference : "loading"}</span>
      <button
        type="button"
        disabled={!state.ready}
        onClick={() => actions.setPreference("unknown")}
      >
        Change measurement preference
      </button>
      {state.preference === "accepted" && (
        <button type="button" onClick={() => actions.setPreference("declined")}>
          Revoke measurement
        </button>
      )}
      {state.ready && state.storageIssue === "unavailable" && (
        <p role="status">
          Your measurement choice applies to this visit; browser storage is
          unavailable.
        </p>
      )}
    </div>
  );
}

// Shared measurement state and actions live with their provider. Browser access
// stays deferred until hydration or an action; each document retains one store.
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
    // Route effects can run before the provider restores saved consent. Keep
    // the current visit, but make no dispatch decision until restoration ends.
    if (!state.ready || !visit || visit.measured) return;
    // An accepted current view is measured when loading finishes. Unlike cart
    // and conversion actions, it is not a discarded loading-time interaction.
    if (state.preference === "accepted" && state.sdkStatus === "loading") return;
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
      publish({
        ready: true,
        preference: saved.value ?? "unknown",
        storageIssue: saved.issue,
      });
      applyPreference(saved.value ?? "unknown", saved.issue);
      // Reconsider a route observed before hydration. Unknown/declined consent
      // is now an actual saved state; accepted visits wait for SDK readiness.
      view();
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

// Bounded local observations are part of measurement, including while the
// inspector is hidden. They never persist or become a source of replay events.
export type InstrumentationEntry = Readonly<{
  sequence: number;
  timestamp: string;
  name: EventName;
  event: MeasurementEvent | null;
  result: DispatchResult;
}>;
const empty: readonly InstrumentationEntry[] = Object.freeze([]);
export const DIAGNOSTIC_LIMIT = 100;

// This is an observation log, never a queue: no callbacks, retries, or storage.
// Invalid inputs are represented by name/reason only, never copied into the log.
export function createInstrumentationLog(now = () => new Date().toISOString()) {
  let entries = empty;
  let sequence = 0;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => entries,
    getServerSnapshot: () => empty,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    record: (
      name: EventName,
      event: MeasurementEvent | null,
      result: DispatchResult,
    ) => {
      const entry = Object.freeze({
        sequence: ++sequence,
        timestamp: now(),
        name,
        event,
        result: Object.freeze({ ...result }),
      });
      entries = Object.freeze([...entries, entry].slice(-DIAGNOSTIC_LIMIT));
      notify();
      return result;
    },
    clear: () => {
      entries = empty;
      notify();
    },
  };
}
