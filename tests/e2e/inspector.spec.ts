import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { accept, commands, events, installSdk, mockSdk } from "./helpers/pixel";

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
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
  await expect(inspector(page)).toContainText("suppressed");
  await accept(page);
  await expect(inspector(page)).toContainText("handed_to_sdk");
  expect((await commands(page)).find((call) => call[0] === "init")![1]).toEqual(
    { pixelId: "T8bLgKF4RsYWhHwHnPDJWg", debug: true },
  );
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
}, info) => {
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
  const order = panel.locator('[data-event-name="order_created"]');
  await expect(order).toContainText("$296.00 USD");
  await expect(order).toContainText("29600 minor units");
  await expect(order).toContainText("quantity 2");
  await expect(order).toContainText("NM-RUN-001");
  await expect(order).toContainText(
    `order_${await page.locator(".order-id").textContent()}`,
  );
  await expect(order).toHaveAttribute("data-dispatch-status", "handed_to_sdk");
  await expect(panel).toContainText("does not verify OpenAI receipt");
  await order.getByText("Payload and event options", { exact: true }).click();
  await expect(order.locator("pre")).toContainText('"event_id"');
  await expect(order.locator("pre")).not.toContainText('"group_id"');
  await fits(page);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("inspector.png"),
    fullPage: true,
  });
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
  await expect(page.locator(".order-id")).toBeVisible();
  await expect(panel).toContainText("page_viewed");
  await expect(panel.locator('[data-event-name="order_created"]')).toHaveCount(
    0,
  );
  expect(
    (await events(page)).filter((event) => event[1] === "order_created"),
  ).toHaveLength(0);
});

test("loading observations are suppressed without a queued/replay claim and revocation clears history", async ({
  page,
}) => {
  let held!: Route;
  await installSdk(page, async (route) => {
    held = route;
  });
  await page.goto("/product/aero-run-jacket?measurementDebug=true");
  await page
    .getByRole("button", { name: "Accept measurement", exact: true })
    .click();
  await expect.poll(() => !!held).toBe(true);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(
    inspector(page).locator('[data-event-name="items_added"]'),
  ).toContainText("SDK is loading");
  await expect(
    inspector(page).locator('[data-dispatch-status="queued"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke measurement" }).click();
  await expect(inspector(page)).toContainText("No local observations yet.");
  await held.fulfill({ contentType: "application/javascript", body: mockSdk });
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(
    inspector(page).locator('[data-event-name="items_added"]'),
  ).toContainText("consent is not accepted");
  await page
    .getByRole("button", { name: "Change measurement preference" })
    .click();
  await accept(page);
  expect(
    (await events(page)).filter((event) => event[1] === "items_added"),
  ).toHaveLength(0);
});

test("failed SDK loading is visible locally while cart actions still succeed", async ({
  page,
}, info) => {
  await installSdk(page, async (route) => {
    await route.abort();
  });
  await page.goto("/product/aero-run-jacket?measurementDebug=true");
  await page
    .getByRole("button", { name: "Accept measurement", exact: true })
    .click();
  await expect(inspector(page)).toContainText("SDK: failed");
  await expect(inspector(page)).toContainText(
    "Measurement script could not load",
  );
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.locator(".action-status")).toContainText(
    "Added to your cart",
  );
  await expect(
    inspector(page).locator('[data-event-name="items_added"]'),
  ).toHaveAttribute("data-dispatch-status", "failed");
  await fits(page);
  await inspector(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("inspector-failure.png"),
    fullPage: true,
  });
});

test("long journeys retain at most 100 diagnostic entries without truncating business state", async ({
  page,
}) => {
  await installSdk(page);
  await page.goto("/product/aero-run-jacket?measurementDebug=true");
  await accept(page);
  await page.getByRole("button", { name: "Add to cart" }).evaluate((button) => {
    for (let i = 0; i < 105; i++) (button as HTMLButtonElement).click();
  });
  await expect(
    inspector(page).locator(".instrumentation-entries > li"),
  ).toHaveCount(100);
  expect(
    (await events(page)).filter((event) => event[1] === "items_added"),
  ).toHaveLength(105);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("nano-motion:commerce:v1")!).cart[0]
          .quantity,
    ),
  ).toBe(105);
  await fits(page);
  await inspector(page)
    .getByRole("button", { name: "Clear local log" })
    .click();
  await expect(
    inspector(page).locator(".instrumentation-entries > li"),
  ).toHaveCount(0);
  expect(
    (await events(page)).filter((event) => event[1] === "items_added"),
  ).toHaveLength(105);
});
