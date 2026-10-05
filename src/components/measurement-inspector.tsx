"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  DIAGNOSTIC_LIMIT,
  useMeasurement,
} from "@/components/measurement-provider";
import { formatUsd } from "@/lib/money";

/**
 * Optional demo UI for the bounded local observation log. It reads the shared
 * store without creating a driver or submitting events. "handed_to_sdk" records
 * an SDK function call, not confirmed transport, attribution, or Ads reporting.
 * Numeric HTTP codes are intentionally absent: the SDK exposes no per-event
 * response callback, so actual batch statuses must be inspected in DevTools.
 */
export function MeasurementInspector() {
  const params = useSearchParams();
  const { state, actions } = useMeasurement();
  // Window visibility is presentation state only. Starting minimized, opening,
  // and closing never change consent, SDK initialization, or log contents.
  const [isOpen, setIsOpen] = useState(false);
  // Link the launcher's aria-controls to a stable, hydration-safe panel ID.
  const panelId = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const minimize = useRef<HTMLButtonElement>(null);
  // Subscribe even while the window is minimized. The store retains the latest
  // 100 observations in memory across client navigation; this UI is not a queue
  // and has no retry/replay or persistence behavior. Its server snapshot is empty.
  const entries = useSyncExternalStore(
    actions.diagnostics.subscribe,
    actions.diagnostics.getSnapshot,
    actions.diagnostics.getServerSnapshot,
  );
  // Development enables the demo launcher automatically. Production requires
  // the exact query value "true". Changing this flag only affects visibility;
  // route measurement observes pathname, so a query toggle adds no page view.
  const enabled =
    process.env.NODE_ENV === "development" ||
    params.get("measurementDebug") === "true";
  useEffect(() => {
    // Move keyboard focus into the opened window. It is a nonmodal panel: users
    // can still interact with the page. Minimize/Escape return focus to the
    // launcher instead of leaving it on a control inside a hidden window.
    if (isOpen && enabled) minimize.current?.focus();
  }, [isOpen, enabled]);
  const close = () => {
    setIsOpen(false);
    launcher.current?.focus();
  };
  if (!enabled) return null;
  return (
    <aside
      className="measurement-inspector"
      aria-label="Local instrumentation log"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <section
        id={panelId}
        className="inspector-window"
        aria-label="Interaction log window"
        hidden={!isOpen}
      >
        <header className="inspector-header">
          <div>
            <h2>Interaction log</h2>
            <small>
              {entries.length} / {DIAGNOSTIC_LIMIT} observations
            </small>
          </div>
          <button
            ref={minimize}
            type="button"
            onClick={close}
            aria-label="Minimize interaction log"
            title="Minimize (Esc)"
          >
            <span aria-hidden="true">−</span>
          </button>
        </header>
        <div className="inspector-body">
          <div className="inspector-controls">
            <p>
              Consent: <strong>{state.preference}</strong> · SDK:{" "}
              <strong>{state.sdkStatus}</strong>
            </p>
            {/* Clear affects diagnostics alone; it cannot alter business state,
                change consent, or resend any of the recorded interactions. */}
            <button type="button" onClick={actions.diagnostics.clear}>
              Clear local log
            </button>
          </div>
          {state.error && (
            <p className="inspector-error" role="status">
              {state.error}
            </p>
          )}
          {entries.length === 0 ? (
            <p className="inspector-empty">No local observations yet.</p>
          ) : (
            <ol className="instrumentation-entries">
              {/* Copy before reversing: store snapshots are immutable. Display
                  newest observations first and use their sequence as identity,
                  since event names/timestamps can repeat in rapid interactions. */}
              {[...entries].reverse().map((entry) => (
                <li
                  key={entry.sequence}
                  data-event-name={entry.name}
                  data-dispatch-status={entry.result.status}
                >
                  <div className="instrumentation-heading">
                    <time dateTime={entry.timestamp}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </time>
                    <strong>{entry.name}</strong>
                    <span
                      className={`dispatch-status dispatch-${entry.result.status}`}
                    >
                      {entry.result.status}
                    </span>
                  </div>
                  {/* These are the exact normalized event values. Amounts stay
                      in integer cents; formatUsd only supplies the readable
                      display. Invalid inputs have event=null and expose no raw
                      payload, but still show their name/status/reason below. */}
                  <div className="instrumentation-values">
                    {entry.event?.data.contents?.map((content) => (
                      <p key={content.id}>
                        <code>{content.id}</code> · {content.name}
                        {content.quantity !== undefined && (
                          <> · quantity {content.quantity}</>
                        )}
                      </p>
                    ))}
                    {entry.event?.data.plan_id && (
                      <p>
                        Plan: <code>{entry.event.data.plan_id}</code>
                      </p>
                    )}
                    {entry.event?.data.amount !== undefined && (
                      <p>
                        Amount: {formatUsd(entry.event.data.amount)}{" "}
                        {entry.event.data.currency} · {entry.event.data.amount}{" "}
                        minor units
                      </p>
                    )}
                    {entry.event?.options && (
                      <p>
                        Event ID: <code>{entry.event.options.event_id}</code>
                      </p>
                    )}
                  </div>
                  {entry.result.status !== "handed_to_sdk" && (
                    <p className="instrumentation-reason">
                      {entry.result.reason}
                    </p>
                  )}
                  {/* event_id is an SDK option (the fourth measure argument),
                      separate from event data. Show both without rebuilding or
                      dispatching them; disclosure is only a local inspection. */}
                  {entry.event && (
                    <details className="instrumentation-payload">
                      <summary>Payload and event options</summary>
                      <pre>
                        {JSON.stringify(
                          {
                            data: entry.event.data,
                            options: entry.event.options ?? null,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
      {/* The observation count remains visible while minimized. CSS anchors
          this launcher and its scrollable window to the bottom-right viewport. */}
      <button
        ref={launcher}
        type="button"
        className="inspector-launcher"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? "Close interaction log" : "Open interaction log"}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M7 9h10M7 13h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>Interaction log</span>
        <span className="inspector-count">{entries.length}</span>
      </button>
    </aside>
  );
}
