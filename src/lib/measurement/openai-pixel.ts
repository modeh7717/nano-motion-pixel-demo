import type { PixelDriver } from "./types.ts";

export const PIXEL_SCRIPT_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
type PixelFunction = ((...args: unknown[]) => void) & { q?: IArguments[] };
declare global {
  interface Window {
    oaiq?: PixelFunction;
  }
}

// The documented stub holds consent/init commands only. No measure calls are
// queued while loading, so revocation cannot replay application-held actions.
export function createBrowserPixelDriver(timeoutMs = 12_000): PixelDriver {
  let pending: Promise<void> | undefined;
  return {
    load(config) {
      if (pending) return pending;
      pending = new Promise<void>((resolve, reject) => {
        if (!window.oaiq) {
          const stub: PixelFunction = function () {
            // eslint-disable-next-line prefer-rest-params -- Preserve the official SDK stub's arguments queue.
            stub.q!.push(arguments);
          };
          stub.q = [];
          window.oaiq = stub;
        }
        const queue = window.oaiq;
        queue("consent", false);
        queue("init", config);
        const script = document.createElement("script");
        script.async = true;
        script.src = PIXEL_SCRIPT_URL;
        script.dataset.nanoMotionPixel = "true";
        const finish = (error?: Error) => {
          clearTimeout(timer);
          script.onload = null;
          script.onerror = null;
          if (error) reject(error);
          else resolve();
        };
        const timer = setTimeout(
          () => finish(new Error("Measurement script timed out.")),
          timeoutMs,
        );
        script.onload = () => {
          if (!window.oaiq || window.oaiq.q)
            finish(new Error("Measurement SDK did not become ready."));
          else finish();
        };
        script.onerror = () =>
          finish(new Error("Measurement script could not load."));
        document.head.appendChild(script);
      });
      return pending;
    },
    consent(accepted) {
      window.oaiq?.("consent", accepted);
    },
    measure(event) {
      if (!window.oaiq || window.oaiq.q)
        throw new Error("Measurement SDK is unavailable.");
      window.oaiq(
        "measure",
        event.name,
        event.data,
        ...(event.options ? [event.options] : []),
      );
    },
  };
}
