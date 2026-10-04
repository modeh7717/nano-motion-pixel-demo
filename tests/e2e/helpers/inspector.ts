import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function openInspector(page: Page) {
  await page
    .getByRole("button", { name: "Open interaction log", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Interaction log window" }),
  ).toBeVisible();
}
