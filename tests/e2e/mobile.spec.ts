import { expect, test } from "@playwright/test";
import { expectFitsViewport } from "./helpers/layout";
import { openInspector } from "./helpers/inspector";
import { accept, installSdk } from "./helpers/pixel";

test("mobile storefront, consent, artwork, and inspector fit the viewport", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installSdk(page);
  await page.goto("/?measurementDebug=true");
  await expect(
    page.getByRole("region", { name: "Measurement preference" }),
  ).toBeVisible();
  await expectFitsViewport(page);
  await accept(page);

  for (const route of [
    "/",
    "/shop",
    "/product/aero-run-jacket",
    "/membership",
  ]) {
    await page.goto(`${route}?measurementDebug=true`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.locator("img").evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
    });
    await openInspector(page);
    await expect(
      page.getByRole("complementary", { name: "Local instrumentation log" }),
    ).toContainText("handed_to_sdk");
    await expectFitsViewport(page);
    const bounds = await page
      .getByRole("region", { name: "Interaction log window" })
      .boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await page
      .getByRole("button", { name: "Minimize interaction log" })
      .click();
  }
  expect(errors).toEqual([]);
});

test("mobile shopper can navigate from home to a persistent order", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await page
    .getByRole("link", { name: "Explore the collection", exact: true })
    .click();
  await page
    .locator(".product-card")
    .filter({ hasText: "Aero Run Jacket" })
    .click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await expect(page.locator(".order-total")).toHaveText("$148.00");
  await expectFitsViewport(page);
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  await expectFitsViewport(page);
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page.locator(".order-id")).toBeVisible();
  const id = await page.locator(".order-id").innerText();
  await expectFitsViewport(page);
  await page.reload();
  await expect(page.locator(".order-id")).toHaveText(id);
  await expect(page.locator(".order-total")).toHaveText("$148.00");
});
