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
  await expect(inspector(page).locator(".response-code").first()).toHaveText(
    "HTTP — · not sent",
  );
  await accept(page);
  await expect(inspector(page)).toContainText("handed_to_sdk");
  expect((await commands(page)).find((call) => call[0] === "init")![1]).toEqual(
    { pixelId: "T8bLgKF4RsYWhHwHnPDJWg", debug: true },
  );
  await expect(inspector(page).locator(".response-code").first()).toHaveText(
    "HTTP — · unavailable",
  );
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
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page.locator(".order-id")).toBeVisible();
  await enable(page);
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
  await expect(order.locator(".response-code")).toHaveText(
    "HTTP — · unavailable",
  );
  await expect(panel).toContainText("does not verify OpenAI receipt");
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
