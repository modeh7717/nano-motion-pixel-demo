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

const MeasurementContext = createContext<MeasurementStore | null>(null);
export function MeasurementProvider({
  children,
  pixelId,
}: {
  children: React.ReactNode;
  pixelId: string;
}) {
  const [store] = useState(() =>
    createMeasurementStore({
      driver: createBrowserPixelDriver(),
      pixelId,
      debug: process.env.NODE_ENV === "development",
    }),
  );
  useEffect(() => {
    store.hydrate();
    const sync = (event: StorageEvent) => {
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
function RouteObserver() {
  const pathname = usePathname();
  const { actions } = useMeasurement();
  useEffect(() => {
    actions.observeRoute(pathname);
  }, [pathname, actions]);
  return null;
}
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
