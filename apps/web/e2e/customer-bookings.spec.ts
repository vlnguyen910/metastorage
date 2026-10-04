import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("customer views, validates, reschedules and cancels a booking", async ({ page }) => {
  await page.goto("/login");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/customer\/dashboard/);
  const menu = page.getByRole("button", { name: "Mở menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "My Bookings", exact: true }).click();
  await expect(page.getByRole("link", { name: "BK-2026-0001" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "BK-2026-0001" }).click();
  await expect(page.getByRole("heading", { name: "Booking details" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Save new check-in" }).click();
  await expect(page.getByText("Choose a valid check-in date and time.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Check-in", { exact: true }).fill("2026-10-10T09:00");
  await page.getByRole("button", { name: "Save new check-in" }).click();
  await expect(page.getByText("Booking updated.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Booking history" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel booking", exact: true }).click();
  await page.getByRole("button", { name: "Keep booking" }).click();
  await expect(page.getByRole("button", { name: "Cancel booking", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Cancel booking", exact: true }).click();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByText("Simulated refund — no real money transfer.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save new check-in" })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("link", { name: "Back to bookings" })).toBeInViewport();
  await page.screenshot({
    path: `test-results/customer-booking-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Back to bookings" }).click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
});

test("customer booking empty and missing-detail states allow navigation", async ({ page }) => {
  await page.goto("/login");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/customer\/dashboard/);
  await page.goto("/customer/bookings");
  await expect(page.getByRole("link", { name: "BK-2026-0001" })).toBeVisible();
  await page.evaluate(() => {
    const key = "metastorage.mock-db.v3";
    const stored = localStorage.getItem(key);
    if (!stored) throw new Error("Missing mock database");
    const database = JSON.parse(stored);
    database.customerBookings = [];
    localStorage.setItem(key, JSON.stringify(database));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "No bookings yet" })).toBeVisible();
  await page.goto("/customer/bookings/missing");
  await expect(
    page.getByRole("alert").filter({ hasText: "Unable to load this booking" }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("link", { name: "Back to bookings" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/customer\/bookings$/);
});
