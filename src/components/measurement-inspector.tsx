"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import { useMeasurement } from "@/components/measurement-provider";
import { DIAGNOSTIC_LIMIT } from "@/lib/measurement/diagnostics";
import { formatUsd } from "@/lib/money";

export function MeasurementInspector() {
  const params = useSearchParams();
  const { state, actions } = useMeasurement();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const minimize = useRef<HTMLButtonElement>(null);
  const entries = useSyncExternalStore(
    actions.diagnostics.subscribe,
    actions.diagnostics.getSnapshot,
    actions.diagnostics.getServerSnapshot,
  );
  const enabled =
    process.env.NODE_ENV === "development" ||
    params.get("measurementDebug") === "true";
  useEffect(() => {
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
                    <span
                      className="response-code"
                      title={
                        entry.result.status === "suppressed"
                          ? "This event was suppressed and was not sent."
                          : "No per-event HTTP response is exposed by the SDK. Inspect batch responses in DevTools Network."
                      }
                    >
                      HTTP — ·{" "}
                      {entry.result.status === "suppressed"
                        ? "not sent"
                        : "unavailable"}
                    </span>
                  </div>
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
                  <p className="instrumentation-reason">
                    {entry.result.reason}
                  </p>
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
