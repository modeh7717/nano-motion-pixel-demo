import type { DispatchResult, EventName, MeasurementEvent } from "./types.ts";

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
