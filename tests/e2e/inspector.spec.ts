import { expect, test } from "@playwright/test";
import { expectFitsViewport } from "./helpers/layout";
import { openInspector } from "./helpers/inspector";
import type { Page } from "@playwright/test";
import { accept, commands, events, installSdk } from "./helpers/pixel";

function inspector(page: Page) {
  return page.getByRole("complementary", { name: "Local instrumentation log" });
}
async function enable(page: Page, value = "true") {
  await page.evaluate((value) => {
    const url = new URL(location.href);
    url.searchParams.set("measurementDebug", value);
    history.replaceState(null, "", url);
  }, value);
}

test("production inspector requires the exact flag, and toggling it never adds view events", async ({
  page,
}) => {
  await installSdk(page);
  await page.goto("/product/aero-run-jacket");
  await expect(inspector(page)).toHaveCount(0);
  await enable(page, "1");
  await expect(inspector(page)).toHaveCount(0);
  await enable(page);
  await expect(inspector(page)).toBeVisible();
  const window = page.getByRole("region", { name: "Interaction log window" });
  await expect(window).toBeHidden();
  await openInspector(page);
  await expect(inspector(page)).toContainText("suppressed");
  await expect(inspector(page)).not.toContainText("HTTP");
  await accept(page);
  await expect(inspector(page)).toContainText("handed_to_sdk");
  expect((await commands(page)).find((call) => call[0] === "init")![1]).toEqual(
    { pixelId: "T8bLgKF4RsYWhHwHnPDJWg", debug: true },
  );
  await expect(inspector(page)).not.toContainText("HTTP");
  const before = await commands(page);
  await page.getByRole("button", { name: "Minimize interaction log" }).click();
  await expect(window).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Open interaction log" }),
  ).toBeFocused();
  await openInspector(page);
  await page.keyboard.press("Escape");
  await expect(window).toBeHidden();
  expect(await commands(page)).toEqual(before);
  await enable(page, "false");
  await expect(inspector(page)).toHaveCount(0);
  await enable(page);
  await expect(inspector(page)).toBeVisible();
  expect(
    (await events(page)).filter((event) => event[1] === "contents_viewed"),
  ).toHaveLength(1);
  // Adding the flag through the address bar creates a new document, which must
  // restore saved acceptance before logging its initial product view.
  await page.goto("/product/aero-run-jacket?measurementDebug=true");
  await openInspector(page);
  await expect(inspector(page)).toContainText("Consent: accepted");
  const view = inspector(page).locator('[data-event-name="contents_viewed"]');
  await expect(view).toHaveCount(1);
  await expect(view).toHaveAttribute("data-dispatch-status", "handed_to_sdk");
  await expect(inspector(page)).not.toContainText(
    "Measurement consent is not accepted.",
  );
  await page.reload();
  await openInspector(page);
  await expect(view).toHaveCount(1);
  await expect(view).toHaveAttribute("data-dispatch-status", "handed_to_sdk");
  await page.getByRole("button", { name: "Revoke measurement" }).click();
  await page.reload();
  await openInspector(page);
  await expect(inspector(page)).toContainText("Consent: declined");
  await expect(view).toHaveCount(1);
  await expect(view).toHaveAttribute("data-dispatch-status", "suppressed");
  expect(await commands(page)).toEqual([]);
  await expect(page.locator('script[data-nano-motion-pixel="true"]')).toHaveCount(
    0,
  );
});

test("inspector explains saved order payloads and clearing it cannot resend or alter the order", async ({
  page,
}) => {
  await installSdk(page);
  await page.goto("/product/aero-run-jacket?measurementDebug=true");
  await accept(page);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await expect(page).toHaveURL(/\/cart\?measurementDebug=true$/);
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await expect(page).toHaveURL(/\/checkout\?measurementDebug=true$/);
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page).toHaveURL(/\/order-confirmation\?measurementDebug=true$/);
  await expect(page.locator(".order-id")).toBeVisible();
  const panel = inspector(page);
  await openInspector(page);
  const order = panel.locator('[data-event-name="order_created"]');
  await expect(order).toContainText("$296.00 USD");
  await expect(order).toContainText("29600 minor units");
  await expect(order).toContainText("quantity 2");
  await expect(order).toContainText("NM-RUN-001");
  await expect(order).toContainText(
    `order_${await page.locator(".order-id").textContent()}`,
  );
  await expect(order).toHaveAttribute("data-dispatch-status", "handed_to_sdk");
  await expect(panel).not.toContainText("HTTP");
  await order.getByText("Payload and event options", { exact: true }).click();
  await expect(order.locator("pre")).toContainText('"event_id"');
  await expect(order.locator("pre")).not.toContainText('"group_id"');
  await expectFitsViewport(page);
  await panel.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() =>
    localStorage.getItem("nano-motion:commerce:v1"),
  );
  const calls = await commands(page);
  await panel.getByRole("button", { name: "Clear local log" }).click();
  await expect(panel).toContainText("No local observations yet.");
  expect(await commands(page)).toEqual(calls);
  expect(
    await page.evaluate(() => localStorage.getItem("nano-motion:commerce:v1")),
  ).toBe(before);
  await page.reload();
  await openInspector(page);
  await expect(page.locator(".order-id")).toBeVisible();
  await expect(panel).toContainText("page_viewed");
  await expect(panel.locator('[data-event-name="order_created"]')).toHaveCount(
    0,
  );
  expect(
    (await events(page)).filter((event) => event[1] === "order_created"),
  ).toHaveLength(0);
});

test("manually adding the debug flag carries it through links and membership until removed", async ({
  page,
}) => {
  await installSdk(page);
  await page.goto("/");
  await enable(page);
  await page.getByRole("link", { name: "Explore the collection" }).click();
  await expect(page).toHaveURL(/\/shop\?measurementDebug=true$/);
  await expect(inspector(page)).toBeVisible();
  const product = page.locator('a[href^="/product/aero-run-jacket"]');
  await expect(product).toHaveAttribute(
    "href",
    "/product/aero-run-jacket?measurementDebug=true",
  );
  await product.click();
  await expect(page).toHaveURL(
    /\/product\/aero-run-jacket\?measurementDebug=true$/,
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/shop\?measurementDebug=true$/);
  await page
    .getByRole("link", { name: "Nano Motion Plus", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/membership\?measurementDebug=true$/);
  await page.getByRole("button", { name: "Join demo membership" }).click();
  await expect(page).toHaveURL(
    /\/membership-confirmation\?measurementDebug=true$/,
  );
  await page.reload();
  await expect(inspector(page)).toBeVisible();
  // Manually remove the parameter without refreshing, as with the DevTools helper.
  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.delete("measurementDebug");
    history.replaceState(null, "", url);
  });
  await expect(inspector(page)).toHaveCount(0);
  const shop = page.getByRole("link", { name: "Shop", exact: true });
  await expect(shop).toHaveAttribute("href", "/shop");
  await shop.click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(inspector(page)).toHaveCount(0);
  await page.goto("/membership?measurementDebug=false");
  await expect(shop).toHaveAttribute("href", "/shop");
  await page.getByRole("link", { name: "View your membership" }).click();
  await expect(page).toHaveURL(/\/membership-confirmation$/);
});
