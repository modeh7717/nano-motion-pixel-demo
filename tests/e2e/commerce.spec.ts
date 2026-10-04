import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const storageKey = "nano-motion:commerce:v1";
async function readCommerce(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
}
async function add(page: Page, slug = "aero-run-jacket") {
  await page.goto(`/product/${slug}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.locator(".action-status")).toContainText(
    "Added to your cart.",
  );
}
async function begin(page: Page) {
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
}

async function expectFitsViewport(page: Page) {
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

test("cart adds, edits, rejects fractions, removes, and persists exact totals", async ({
  page,
}, testInfo) => {
  await add(page);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await add(page, "motion-performance-tee");
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await expect(page.locator(".order-total")).toHaveText("$364.00");
  const quantity = page.getByRole("spinbutton", {
    name: "Quantity for Aero Run Jacket",
  });
  await expect(quantity).toHaveValue("2");
  await quantity.fill("1.5");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "whole-number quantity",
  );
  expect((await readCommerce(page)).cart[0].quantity).toBe(2);
  await quantity.fill("3");
  await expect(page.locator(".order-total")).toHaveText("$512.00");
  await expectFitsViewport(page);
  await page.reload();
  await expect(quantity).toHaveValue("3");
  await expect(page.locator(".order-total")).toHaveText("$512.00");
  await page.screenshot({
    path: testInfo.outputPath("cart.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Remove Motion Performance Tee" })
    .click();
  await expect(page.locator(".order-total")).toHaveText("$444.00");
  await page.getByRole("button", { name: "Remove Aero Run Jacket" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Room for your next move.",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Room for your next move.",
  );
});

test("two jackets complete one persistent order even on rapid double submission", async ({
  page,
}, testInfo) => {
  await add(page);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await begin(page);
  await expect(page.locator(".order-total")).toHaveText("$296.00");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  const attempt = (await readCommerce(page)).checkout.id;
  await expectFitsViewport(page);
  await page.screenshot({
    path: testInfo.outputPath("checkout.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Complete demo order" })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(page).toHaveURL(/\/order-confirmation$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A good move.",
  );
  const saved = await readCommerce(page);
  expect(saved.cart).toEqual([]);
  expect(saved.checkout.status).toBe("completed");
  expect(saved.order.checkoutAttemptId).toBe(attempt);
  expect(saved.order.snapshot.totalCents).toBe(29600);
  expect(saved.order.snapshot.items[0]).toMatchObject({
    quantity: 2,
    unitPriceCents: 14800,
  });
  await expect(page.locator(".order-id")).toHaveText(saved.order.id);
  await expectFitsViewport(page);
  await page.screenshot({
    path: testInfo.outputPath("order.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".order-id")).toHaveText(saved.order.id);
  expect((await readCommerce(page)).order).toEqual(saved.order);
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Start with an essential.",
  );
  expect((await readCommerce(page)).order).toEqual(saved.order);
});

test("direct checkout creates one attempt, reuses refresh and history, and supports an explicit restart", async ({
  page,
}) => {
  await add(page);
  await page.goto("/checkout");
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  const first = (await readCommerce(page)).checkout.id;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  expect((await readCommerce(page)).checkout.id).toBe(first);
  await page.getByRole("link", { name: "Return to cart" }).click();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  expect((await readCommerce(page)).checkout.id).toBe(first);
  await page.goForward();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  expect((await readCommerce(page)).checkout.id).not.toBe(first);
  await page.getByRole("link", { name: "Return to cart" }).click();
  await page
    .getByRole("spinbutton", { name: "Quantity for Aero Run Jacket" })
    .fill("2");
  expect((await readCommerce(page)).checkout).toBeNull();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await expect(page.locator(".order-total")).toHaveText("$296.00");
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page).toHaveURL(/\/order-confirmation$/);
  const order = (await readCommerce(page)).order;
  await add(page, "velocity-legging");
  await begin(page);
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page).toHaveURL(/\/order-confirmation$/);
  await expect(page.locator(".order-total")).toHaveText("$118.00");
  expect((await readCommerce(page)).order.id).not.toBe(order.id);
  expect(order.snapshot.totalCents).toBe(29600);
});

test("corrupt saved data cannot fabricate orders or block a new journey", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      '{"version":1,"cart":[{"productId":"NM-RUN-001","quantity":-2}],"order":{"id":"fake"}}',
    );
  }, storageKey);
  await page.goto("/order-confirmation");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "No order to show just yet.",
  );
  await expect(page.locator(".storage-notice")).toContainText(
    "could not be read",
  );
  await page
    .getByRole("link", { name: "Back to the collection", exact: true })
    .click();
  await page
    .locator(".product-card")
    .filter({ hasText: "Aero Run Jacket" })
    .click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await begin(page);
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page).toHaveURL(/\/order-confirmation$/);
  expect((await readCommerce(page)).order.snapshot.totalCents).toBe(14800);
});

test("blocked storage retains the order during client navigation and discloses refresh loss", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await add(page);
  await begin(page);
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page).toHaveURL(/\/order-confirmation$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A good move.",
  );
  await expect(page.locator(".storage-notice")).toContainText("may be lost");
  const id = await page.locator(".order-id").innerText();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Cart", exact: true })
    .click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Room for your next move.",
  );
  await page.goBack();
  await expect(page.locator(".order-id")).toHaveText(id);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "No order to show just yet.",
  );
});

test("quota failure cannot interrupt order completion or invent refresh persistence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await add(page);
  await begin(page);
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page).toHaveURL(/\/order-confirmation$/);
  await expect(page.locator(".order-total")).toHaveText("$148.00");
  await expect(page.locator(".storage-notice")).toContainText("may be lost");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "No order to show just yet.",
  );
});
