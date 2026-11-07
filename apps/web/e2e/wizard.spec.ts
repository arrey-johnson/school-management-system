import { expect, test } from "@playwright/test";

test("first-run wizard to overview", async ({ page }) => {
  await page.goto("/setup");
  await page.getByPlaceholder("Password (min 10 characters)").fill("ChangeMeNow1");
  await page.getByRole("button", { name: "Create administrator" }).click();
  await page.getByRole("radio", { name: /Nursery, primary and secondary/i }).check();
  await page.getByRole("button", { name: "Save school" }).click();
  await page.getByRole("button", { name: "Create year and sections" }).click();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({ timeout: 20_000 });
});
