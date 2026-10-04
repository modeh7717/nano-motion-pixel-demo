"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useMeasurement } from "@/components/measurement-provider";
import { DIAGNOSTIC_LIMIT } from "@/lib/measurement/diagnostics";
import { formatUsd } from "@/lib/money";

export function MeasurementInspector() {
  const params = useSearchParams();
  const { state, actions } = useMeasurement();
  const entries = useSyncExternalStore(
    actions.diagnostics.subscribe,
    actions.diagnostics.getSnapshot,
    actions.diagnostics.getServerSnapshot,
  );
  const enabled =
    process.env.NODE_ENV === "development" ||
    params.get("measurementDebug") === "true";
  if (!enabled) return null;
  return (
    <aside
      className="container measurement-inspector"
      aria-label="Local instrumentation log"
    >
      <details open>
        <summary>
          <span>Local instrumentation log</span>
          <small>
            {entries.length} / {DIAGNOSTIC_LIMIT} observations
          </small>
        </summary>
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
          <p className="inspector-note">
            Local observations only. SDK handoff does not verify OpenAI receipt,
            attribution, or reporting. This in-memory log never replays events
            and resets on refresh, revocation, or preference reset.
          </p>
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
      </details>
    </aside>
  );
}
