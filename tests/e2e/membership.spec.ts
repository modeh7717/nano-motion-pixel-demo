import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const membershipKey = "nano-motion:membership:v1";
const commerceKey = "nano-motion:commerce:v1";
async function savedMembership(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    membershipKey,
  );
}
async function join(page: Page) {
  await page.getByRole("button", { name: "Join demo membership" }).click();
  await expect(page).toHaveURL(/\/membership-confirmation$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A little more possibility.",
  );
}
async function fits(page: Page) {
  const size = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
}

test("rapid double Join creates one $19 enrollment with an immutable saved plan", async ({
  page,
}, testInfo) => {
  await page.goto("/membership");
  await expect(page.locator(".plan-price")).toContainText("$19.00");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await fits(page);
  await page.screenshot({
    path: testInfo.outputPath("membership.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Join demo membership" })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(page).toHaveURL(/\/membership-confirmation$/);
  const saved = await savedMembership(page);
  expect(saved.enrollment.plan).toMatchObject({
    id: "nano-motion-plus-monthly",
    amountCents: 1900,
    currency: "USD",
    interval: "month",
  });
  expect(saved.enrollment.status).toBe("active");
  await expect(page.locator(".enrollment-id")).toHaveText(saved.enrollment.id);
  await expect(page.locator(".membership-amount")).toHaveText("$19.00");
  await fits(page);
  await page.screenshot({
    path: testInfo.outputPath("membership-confirmation.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".enrollment-id")).toHaveText(saved.enrollment.id);
  expect((await savedMembership(page)).enrollment).toEqual(saved.enrollment);
});

test("returning to membership and revisiting confirmation reuses the active enrollment", async ({
  page,
}) => {
  await page.goto("/membership");
  await join(page);
  const original = (await savedMembership(page)).enrollment;
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Nano Motion Plus" })
    .click();
  await expect(page).toHaveURL(/\/membership$/);
  await expect(
    page.getByRole("button", { name: "Join demo membership" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "View your membership" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "View your membership" }).click();
  await expect(page.locator(".enrollment-id")).toHaveText(original.id);
  await page.goto("/membership-confirmation");
  await expect(page.locator(".enrollment-id")).toHaveText(original.id);
  expect((await savedMembership(page)).enrollment).toEqual(original);
});

test("direct confirmation never creates an enrollment", async ({ page }) => {
  await page.goto("/membership-confirmation");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your next chapter awaits.",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), membershipKey),
  ).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your next chapter awaits.",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), membershipKey),
  ).toBeNull();
});

test("invalid stored enrollment restores a safe empty state and can be replaced", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        enrollment: {
          id: "fake",
          status: "active",
          plan: { amountCents: -1900 },
        },
      }),
    );
  }, membershipKey);
  await page.goto("/membership-confirmation");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your next chapter awaits.",
  );
  await expect(page.locator(".storage-notice")).toContainText(
    "could not be read",
  );
  await page
    .getByRole("link", { name: "Explore Nano Motion Plus", exact: true })
    .click();
  await join(page);
  await expect(page.locator(".membership-amount")).toHaveText("$19.00");
  expect((await savedMembership(page)).enrollment.id).not.toBe("fake");
});

test("blocked storage retains enrollment during navigation and discloses refresh loss", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.goto("/membership");
  await join(page);
  await expect(page.locator(".storage-notice")).toContainText("may be lost");
  const id = await page.locator(".enrollment-id").innerText();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Nano Motion Plus" })
    .click();
  await expect(page).toHaveURL(/\/membership$/);
  await page.getByRole("link", { name: "View your membership" }).click();
  await expect(page.locator(".enrollment-id")).toHaveText(id);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your next chapter awaits.",
  );
});

test("quota failure preserves demo enrollment in memory with no false saved confirmation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.goto("/membership");
  await join(page);
  await expect(page.locator(".membership-amount")).toHaveText("$19.00");
  await expect(page.locator(".storage-notice")).toContainText("may be lost");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), membershipKey),
  ).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your next chapter awaits.",
  );
});

test("membership leaves the cart and completed order untouched and sends no measurement", async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:3100/"))
      external.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/product/aero-run-jacket");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page).toHaveURL(/\/order-confirmation$/);
  await page.goto("/product/motion-performance-tee");
  await page.getByRole("button", { name: "Add to cart" }).click();
  const commerce = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    commerceKey,
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Nano Motion Plus" })
    .click();
  await join(page);
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    commerceKey,
  );
  expect(after).toEqual(commerce);
  expect(after.cart).toEqual([{ productId: "NM-YGA-003", quantity: 1 }]);
  expect(after.order.snapshot.totalCents).toBe(14800);
  expect(await page.evaluate(() => "oaiq" in window)).toBe(false);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
