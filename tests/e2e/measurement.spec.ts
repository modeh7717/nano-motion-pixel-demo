import { expect, test } from "@playwright/test";
import {
  accept,
  commands,
  consentKey,
  events,
  installSdk,
  mockSdk,
  sdkUrl,
} from "./helpers/pixel";
import type { Route } from "@playwright/test";

test("unknown/declined consent loads no SDK; pre-consent commerce is never backfilled", async ({
  page,
}, info) => {
  let loads = 0;
  await installSdk(page, async (route) => {
    loads++;
    await route.fulfill({
      contentType: "application/javascript",
      body: mockSdk,
    });
  });
  await page.goto("/product/aero-run-jacket");
  await expect(
    page.getByRole("region", { name: "Measurement preference" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("consent.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page.locator(".order-id")).toBeVisible();
  expect(loads).toBe(0);
  expect(await commands(page)).toEqual([]);
  await page
    .getByRole("button", { name: "Change measurement preference" })
    .click();
  await accept(page);
  expect(loads).toBe(1);
  const measured = await events(page);
  expect(measured.map((event) => event[1])).toEqual(["page_viewed"]);
  expect(measured[0][2]).toMatchObject({
    contents: [{ id: "order-confirmation" }],
  });
  await page.reload();
  await expect.poll(async () => (await events(page)).length).toBe(1);
  expect((await events(page))[0][1]).toBe("page_viewed");
});

test("all six events use correct payloads and persisted stable conversion IDs without refresh duplicates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installSdk(page);
  await page.goto("/product/aero-run-jacket");
  await accept(page);
  await expect.poll(async () => (await events(page)).length).toBe(1);
  const setup = await commands(page);
  expect(setup.slice(0, 3)).toEqual([
    ["consent", false],
    ["init", { pixelId: "T8bLgKF4RsYWhHwHnPDJWg", debug: false }],
    ["consent", true],
  ]);
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await page
    .getByRole("button", { name: "Complete demo order" })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(page.locator(".order-id")).toBeVisible();
  let measured = await events(page);
  expect(measured.filter((event) => event[1] === "items_added")).toHaveLength(
    2,
  );
  expect(
    measured
      .filter((event) => event[1] === "items_added")
      .map((event) => event[2]),
  ).toEqual(
    Array.from({ length: 2 }, () => ({
      type: "contents",
      amount: 14800,
      currency: "USD",
      contents: [
        {
          id: "NM-RUN-001",
          name: "Aero Run Jacket",
          content_type: "product",
          quantity: 1,
        },
      ],
    })),
  );
  const checkouts = measured.filter((event) => event[1] === "checkout_started");
  const orders = measured.filter((event) => event[1] === "order_created");
  expect(checkouts).toHaveLength(1);
  expect(orders).toHaveLength(1);
  expect(orders[0][2]).toEqual({
    type: "contents",
    amount: 29600,
    currency: "USD",
    contents: [
      {
        id: "NM-RUN-001",
        name: "Aero Run Jacket",
        content_type: "product",
        quantity: 2,
      },
    ],
  });
  expect(checkouts[0][2]).toEqual(orders[0][2]);
  const savedOrder = await page.evaluate(
    () => JSON.parse(localStorage.getItem("nano-motion:commerce:v1")!).order,
  );
  expect(orders[0][3]).toEqual({ event_id: `order_${savedOrder.id}` });
  const observations = await page.evaluate(() => window.__pixelOutcomes);
  expect(observations).toContainEqual(
    expect.objectContaining({
      commerce: expect.objectContaining({ order: savedOrder, cart: [] }),
    }),
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Nano Motion Plus" })
    .click();
  await page
    .getByRole("button", { name: "Join demo membership" })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(page.locator(".enrollment-id")).toBeVisible();
  measured = await events(page);
  const memberships = measured.filter(
    (event) => event[1] === "subscription_created",
  );
  expect(memberships).toHaveLength(1);
  expect(memberships[0][2]).toEqual({
    type: "plan_enrollment",
    plan_id: "nano-motion-plus-monthly",
    amount: 1900,
    currency: "USD",
  });
  expect(memberships[0][3]).toEqual({
    event_id: `subscription_${await page.locator(".enrollment-id").textContent()}`,
  });
  expect(new Set(measured.map((event) => event[1])).size).toBe(6);
  expect(
    (await commands(page)).filter((call) => call[0] === "init"),
  ).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".enrollment-id")).toBeVisible();
  await expect.poll(async () => (await events(page)).length).toBe(1);
  expect((await events(page))[0][1]).toBe("page_viewed");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Nano Motion Plus" })
    .click();
  await page.getByRole("link", { name: "View your membership" }).click();
  expect(
    (await events(page)).filter((event) => event[1] === "subscription_created"),
  ).toHaveLength(0);
  await page.goto("/order-confirmation");
  await expect(page.locator(".order-id")).toHaveText(savedOrder.id);
  await expect.poll(async () => (await events(page)).length).toBe(1);
  expect((await events(page))[0][1]).toBe("page_viewed");
  expect(errors).toEqual([]);
});

test("committed navigation and history create visits while query/hash changes and rerenders do not", async ({
  page,
}) => {
  await installSdk(page);
  await page.goto("/product/aero-run-jacket");
  await accept(page);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.evaluate(() =>
    history.pushState(null, "", "?measurementDebug=true#detail"),
  );
  expect(
    (await events(page)).filter((event) => event[1] === "contents_viewed"),
  ).toHaveLength(1);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Shop", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect
    .poll(
      async () =>
        (await events(page)).filter((event) => event[1] === "page_viewed")
          .length,
    )
    .toBe(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/product\/aero-run-jacket/);
  await expect
    .poll(
      async () =>
        (await events(page)).filter((event) => event[1] === "contents_viewed")
          .length,
    )
    .toBe(2);
  await page.goForward();
  await expect(page).toHaveURL(/\/shop$/);
  await expect
    .poll(
      async () =>
        (await events(page)).filter((event) => event[1] === "page_viewed")
          .length,
    )
    .toBe(2);
});

test("checkout attempt is measured once, explicit restart is new, and pre-consent attempt is not backfilled", async ({
  page,
}) => {
  await installSdk(page);
  await page.goto("/product/aero-run-jacket");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  await accept(page);
  expect(
    (await events(page)).filter((event) => event[1] === "checkout_started"),
  ).toHaveLength(0);
  await page.getByRole("link", { name: "Return to cart" }).click();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  const checkout = (await events(page)).find(
    (event) => event[1] === "checkout_started",
  )!;
  expect(checkout).toBeDefined();
  await page.getByRole("link", { name: "Return to cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(
    page.getByRole("button", { name: "Begin demo checkout" }),
  ).toBeEnabled();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  expect(
    (await events(page)).filter((event) => event[1] === "checkout_started"),
  ).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Complete demo order" }),
  ).toBeEnabled();
  await expect.poll(async () => (await events(page)).length).toBe(1);
  expect((await events(page))[0][1]).toBe("page_viewed");
  await page.getByRole("link", { name: "Return to cart" }).click();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await expect
    .poll(
      async () =>
        (await events(page)).filter((event) => event[1] === "checkout_started")
          .length,
    )
    .toBe(1);
  expect(
    (await events(page)).find((event) => event[1] === "checkout_started")![3],
  ).not.toEqual(checkout[3]);
});

test("revoking during delayed SDK load suppresses actions and current views until reacceptance", async ({
  page,
}) => {
  let held!: Route;
  await installSdk(page, async (route) => {
    held = route;
  });
  await page.goto("/product/aero-run-jacket");
  await page
    .getByRole("button", { name: "Accept measurement", exact: true })
    .click();
  await expect.poll(() => !!held).toBe(true);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("button", { name: "Revoke measurement" }).click();
  await held.fulfill({ contentType: "application/javascript", body: mockSdk });
  await expect
    .poll(async () => (await commands(page)).some((call) => call[0] === "init"))
    .toBe(true);
  expect(await events(page)).toEqual([]);
  await page
    .getByRole("button", { name: "Change measurement preference" })
    .click();
  await accept(page);
  expect((await events(page)).map((event) => event[1])).toEqual([
    "contents_viewed",
  ]);
  await page.getByRole("button", { name: "Add to cart" }).click();
  expect((await events(page)).map((event) => event[1])).toEqual([
    "contents_viewed",
    "items_added",
  ]);
  await page
    .getByRole("button", { name: "Change measurement preference" })
    .click();
  await expect(
    page.getByRole("region", { name: "Measurement preference" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  expect(await events(page)).toHaveLength(2);
});

test("blocked SDK cannot interrupt order or membership completion", async ({
  page,
}) => {
  await installSdk(page, async (route) => {
    await route.abort();
  });
  await page.goto("/product/aero-run-jacket");
  await page
    .getByRole("button", { name: "Accept measurement", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await page.getByRole("button", { name: "Begin demo checkout" }).click();
  await page.getByRole("button", { name: "Complete demo order" }).click();
  await expect(page.locator(".order-id")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Nano Motion Plus" })
    .click();
  await page.getByRole("button", { name: "Join demo membership" }).click();
  await expect(page.locator(".enrollment-id")).toBeVisible();
  expect(await events(page)).toEqual([]);
});

test("unavailable/corrupt consent storage restores unknown with an honest choice notice", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(key, '{"version":99,"preference":"accepted"}');
    },
    { key: consentKey },
  );
  let loads = 0;
  await page.route(sdkUrl, async (route) => {
    loads++;
    await route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Measurement preference" }),
  ).toContainText("saved preference could not be read");
  expect(loads).toBe(0);
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).preference,
      consentKey,
    ),
  ).toBe("declined");
});

test("cross-tab revocation stops subsequent submissions in the open document", async ({
  page,
  context,
}) => {
  await installSdk(page);
  await page.goto("/product/aero-run-jacket");
  await accept(page);
  const other = await context.newPage();
  await installSdk(other);
  await other.goto("/");
  await other.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, preference: "declined" }),
      ),
    consentKey,
  );
  await expect(page.locator(".measurement-preferences")).toContainText(
    "Measurement: declined",
  );
  await page.getByRole("button", { name: "Add to cart" }).click();
  expect((await events(page)).map((event) => event[1])).toEqual([
    "contents_viewed",
  ]);
});

test("denied consent storage retains this visit's choice and restores unknown after refresh", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  let loads = 0;
  await page.route(sdkUrl, async (route) => {
    loads++;
    await route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Measurement preference" }),
  ).toContainText("storage is unavailable");
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(page.locator(".measurement-preferences")).toContainText(
    "Measurement: declined",
  );
  await expect(page.locator(".measurement-preferences")).toContainText(
    "applies to this visit",
  );
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Measurement preference" }),
  ).toBeVisible();
  expect(loads).toBe(0);
});
