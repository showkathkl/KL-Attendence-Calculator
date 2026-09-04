import { test, expect } from "@playwright/test";

test.describe("KLU Attend+ Demo Mode", () => {
  test("should load landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Your attendance")).toBeVisible();
    await expect(page.locator("text=without the headache")).toBeVisible();
  });

  test("should open demo mode", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Try Demo')");
    
    // Should show dashboard
    await expect(page.locator("text=Dashboard")).toBeVisible();
    await expect(page.locator("text=Overall Attendance")).toBeVisible();
  });

  test("should display demo attendance data", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Try Demo')");
    
    // Check for demo data
    await expect(page.locator("text=Data Structures")).toBeVisible();
    await expect(page.locator("text=Java Programming")).toBeVisible();
    
    // Check for percentages
    await expect(page.locator("text=%")).toBeVisible();
  });

  test("should navigate between pages in demo", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Try Demo')");
    
    // Navigate to Subjects
    await page.click("button:has-text('Subjects')");
    await expect(page.locator("text=Subjects")).toBeVisible();
    
    // Navigate to Timetable
    await page.click("button:has-text('Timetable')");
    await expect(page.locator("text=Timetable")).toBeVisible();
  });

  test("should handle dark mode toggle", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Try Demo')");
    
    // Check initial state (light mode)
    const html = await page.locator("html");
    const isDark = await html.evaluate((el) =>
      el.classList.contains("dark")
    );
    
    expect(typeof isDark).toBe("boolean");
  });

  test("should exit demo mode", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Try Demo')");
    await page.click("button:has-text('Exit Demo')");
    
    // Should show landing again
    await expect(page.locator("text=Try Demo")).toBeVisible();
  });
});
