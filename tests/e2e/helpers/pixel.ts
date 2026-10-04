import { expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
export const sdkUrl = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
export const consentKey = "nano-motion:consent:v1";
declare global {
  interface Window {
    __pixelCalls: unknown[][];
    __pixelOutcomes: unknown[];
  }
}
export const mockSdk = `(() => {
  const queued = window.oaiq.q || [];
  let consent = false;
  window.__pixelCalls = window.__pixelCalls || [];
  window.__pixelOutcomes = window.__pixelOutcomes || [];
  window.oaiq = function(...args) {
    window.__pixelCalls.push(args);
    if (args[0] === 'consent') consent = args[1];
    if (args[0] === 'measure') {
      if (!consent) throw new Error('Application handed an event to a nonconsenting SDK');
      let commerce = null, membership = null;
      try {
        commerce = JSON.parse(localStorage.getItem('nano-motion:commerce:v1'));
        membership = JSON.parse(localStorage.getItem('nano-motion:membership:v1'));
      } catch {}
      window.__pixelOutcomes.push({ commerce, membership });
    }
  };
  queued.forEach(args => window.oaiq(...args));
})();`;
export async function installSdk(
  page: Page,
  handler?: (route: Route) => Promise<void>,
) {
  await page.route(
    sdkUrl,
    handler ??
      (async (route) => {
        await route.fulfill({
          contentType: "application/javascript",
          body: mockSdk,
        });
      }),
  );
}
export async function commands(page: Page) {
  return page.evaluate(() => window.__pixelCalls ?? []);
}
export async function events(page: Page) {
  return (await commands(page)).filter((call) => call[0] === "measure");
}
export async function accept(page: Page) {
  await page
    .getByRole("button", { name: "Accept measurement", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await commands(page)).some(
        (call) => call[0] === "consent" && call[1] === true,
      ),
    )
    .toBe(true);
}
