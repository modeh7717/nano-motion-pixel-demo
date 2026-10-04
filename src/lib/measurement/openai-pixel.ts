import type { PixelDriver } from "./types.ts";

// Official browser SDK source, rather than a REST endpoint or npm dependency.
// Integration reference: https://developers.openai.com/ads/measurement-pixel
export const PIXEL_SCRIPT_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
// Before script loading, oaiq is our installation stub with an arguments queue.
// After loading, the vendor replaces it with the actual SDK function. Declaring
// the optional global describes both stages without installing anything on SSR.
type PixelFunction = ((...args: unknown[]) => void) & { q?: IArguments[] };
declare global {
  interface Window {
    oaiq?: PixelFunction;
  }
}

/**
 * The only application adapter that loads/calls OpenAI's browser SDK.
 * The measurement store decides whether consent/readiness permit an event;
 * event-builders.ts decides the payload. This adapter supplies SDK commands.
 * OpenAI's script owns attribution cookies, batching, and network transport.
 * We do not implement a fetch loop or call the server-side Conversions API here.
 *
 * The installation stub queues consent/init commands only. Loading-time measure
 * actions are suppressed by the store, so acceptance cannot replay old actions.
 */
export function createBrowserPixelDriver(timeoutMs = 12_000): PixelDriver {
  // Cache the first load promise, including rejection, for this driver. Repeated
  // calls/effect replay cannot insert a second script or initialize twice. A new
  // browser document creates a new driver; the script file itself may be cached.
  let pending: Promise<void> | undefined;
  // Script availability and application consent are separate checks. Only a
  // replaced stub after a successful onload can set this readiness flag.
  let ready = false;
  return {
    load(config) {
      if (pending) return pending;
      pending = new Promise<void>((resolve, reject) => {
        if (!window.oaiq) {
          // Preserve the documented stub shape. Calls made before the external
          // file executes are replayed by that SDK when it replaces this stub.
          const stub: PixelFunction = function () {
            // eslint-disable-next-line prefer-rest-params -- Preserve the official SDK stub's arguments queue.
            stub.q!.push(arguments);
          };
          stub.q = [];
          window.oaiq = stub;
        }
        const queue = window.oaiq;
        // Start SDK measurement blocked, then configure its public Pixel ID and
        // debug option. After load resolves, the store explicitly enables consent
        // only if the visitor's current application preference is still accepted.
        // Production consideration: SDK consent(false) also deletes __obref and
        // __oppref. This demo repeats that command on each document, so restoring
        // accepted consent can lose a stored ad reference when the current URL
        // has no oppref. Production startup must account for that cookie behavior.
        queue("consent", false);
        queue("init", config);
        const script = document.createElement("script");
        script.async = true;
        script.src = PIXEL_SCRIPT_URL;
        script.dataset.nanoMotionPixel = "true";
        // Resolve/reject once and detach load handlers so a stalled script cannot
        // mark this driver ready after its timeout. The store reports failure
        // locally and continues allowing cart, order, and membership actions.
        const finish = (error?: Error) => {
          clearTimeout(timer);
          script.onload = null;
          script.onerror = null;
          if (error) reject(error);
          else resolve();
        };
        // Loading is asynchronous and must not indefinitely hold SDK readiness.
        const timer = setTimeout(
          () => finish(new Error("Measurement script timed out.")),
          timeoutMs,
        );
        script.onload = () => {
          // The loaded official SDK retains an empty .q compatibility array.
          // Readiness means it replaced the installation stub, not removed .q.
          if (typeof window.oaiq !== "function" || window.oaiq === queue)
            finish(new Error("Measurement SDK did not become ready."));
          else {
            ready = true;
            finish();
          }
        };
        script.onerror = () =>
          finish(new Error("Measurement script could not load."));
        // Only load() inserts the script. The store calls it after acceptance;
        // provider mount, unknown consent, and decline never initiate this fetch.
        document.head.appendChild(script);
      });
      return pending;
    },
    consent(accepted) {
      // A ready SDK applies this immediately; a loading stub queues the command.
      // Before either exists, optional chaining is a no-op and does not load it.
      // The store closes its local dispatch gate before applying revocation.
      window.oaiq?.("consent", accepted);
    },
    measure(event) {
      // Defensive check in addition to the store's consent/readiness gate. This
      // method does not independently decide consent or retain rejected events.
      if (!ready || typeof window.oaiq !== "function")
        throw new Error("Measurement SDK is unavailable.");
      // SDK signature: measure, event name, data, optional event options. Keep
      // event_id in the fourth argument for deduplication, not inside data.
      // Returning without throwing means handoff only: the SDK can validate,
      // batch, or drop an event later, and its network response is not returned.
      window.oaiq(
        "measure",
        event.name,
        event.data,
        ...(event.options ? [event.options] : []),
      );
    },
  };
}
