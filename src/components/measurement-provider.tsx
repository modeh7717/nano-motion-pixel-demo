"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import {
  createMeasurementStore,
  CONSENT_STORAGE_KEY,
} from "@/lib/measurement/store";
import type { MeasurementStore } from "@/lib/measurement/store";
import { createBrowserPixelDriver } from "@/lib/measurement/openai-pixel";

/**
 * React bridge for measurement: components use this context rather than calling
 * window.oaiq directly. The store owns consent and dispatch decisions; the driver
 * owns SDK commands. This file owns React lifecycle, navigation, and consent UI.
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
