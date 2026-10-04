import { expect, test } from "@playwright/test";
import { expectFitsViewport } from "./helpers/layout";
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

test("cart adds, edits, rejects fractions, removes, and persists exact totals", async ({
  page,
}) => {
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
