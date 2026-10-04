import { expect, test } from "@playwright/test";

const catalog = [
  {
    slug: "aero-run-jacket",
    name: "Aero Run Jacket",
    price: "$148.00",
    id: "NM-RUN-001",
  },
  {
    slug: "velocity-legging",
    name: "Velocity Legging",
    price: "$118.00",
    id: "NM-TRN-002",
  },
  {
    slug: "motion-performance-tee",
    name: "Motion Performance Tee",
    price: "$68.00",
    id: "NM-YGA-003",
  },
];

test("home links to the complete catalog and membership", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Made foryour nextmove.",
  );
  await expect(
    page.getByText("Fictional products. Demo only. No real purchases."),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Explore the collection", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.locator(".product-card")).toHaveCount(3);
  for (const product of catalog) {
    const card = page
      .locator(".product-card")
      .filter({ hasText: product.name });
    await expect(card).toContainText(product.price);
    await expect(card).toHaveAttribute("href", `/product/${product.slug}`);
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Nano Motion Plus" })
    .click();
  await expect(page).toHaveURL(/\/membership$/);
  await expect(
    page.getByRole("button", { name: "Enrollment coming soon" }),
  ).toBeDisabled();
  await expect(page.locator(".plan-price")).toContainText("$19");
});

for (const product of catalog) {
  test(`catalog navigation resolves ${product.name}`, async ({ page }) => {
    await page.goto("/shop");
    await page
      .locator(".product-card")
      .filter({ hasText: product.name })
      .click();
    await expect(page).toHaveURL(new RegExp(`/product/${product.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      product.name,
    );
    await expect(page.locator(".detail-price")).toContainText(product.price);
    await expect(page.locator(".detail-copy .eyebrow")).toContainText(
      product.id,
    );
    await expect(page.locator(".detail-image img")).toBeVisible();
    await expect(page.locator(".detail-image img")).toHaveJSProperty(
      "naturalWidth",
      600,
    );
    await expect(page.locator(".related-products .product-card")).toHaveCount(
      2,
    );
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Shop", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });
}

test("scaffold routes show safe empty states without invented outcomes", async ({
  page,
}) => {
  const routes = [
    ["/cart", "Room for your next move."],
    ["/checkout", "Start with an essential."],
    ["/order-confirmation", "No order to show just yet."],
    ["/membership-confirmation", "Your next chapter awaits."],
  ];
  for (const [route, heading] of routes) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
  }
});

test("unknown products and routes return the branded 404", async ({ page }) => {
  for (const route of ["/product/does-not-exist", "/does-not-exist"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Let’s find your way back.",
    );
    await page.getByRole("link", { name: "Back to the collection" }).click();
    await expect(page).toHaveURL(/\/shop$/);
  }
});

test("every page fits the viewport, loads local art, and stays free of measurement", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:3100/"))
      externalRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  for (const route of [
    "/",
    "/shop",
    ...catalog.map((product) => `/product/${product.slug}`),
    "/cart",
    "/checkout",
    "/order-confirmation",
    "/membership",
    "/membership-confirmation",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.locator("img").evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
    });
    const metrics = await page.evaluate(() => ({
      contentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      imagesLoaded: [...document.images].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
      measurementLoaded: "oaiq" in window,
      storageEntries: localStorage.length,
    }));
    expect(metrics.contentWidth, `overflow on ${route}`).toBeLessThanOrEqual(
      metrics.viewportWidth,
    );
    expect(metrics.imagesLoaded).toBe(true);
    expect(metrics.measurementLoaded).toBe(false);
    expect(metrics.storageEntries).toBe(0);
  }
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("keyboard users can skip navigation", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
