import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function expectFitsViewport(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
