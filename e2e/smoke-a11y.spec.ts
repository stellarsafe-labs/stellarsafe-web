import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PUBLIC = ["/", "/docs", "/docs/security", "/connect"];

// The app's CSP would block the style tag below; the scan doesn't need it.
test.use({ bypassCSP: true });

/** Scan for WCAG A/AA issues once transitions have settled, so a mid-fade frame can't fail contrast checks. */
async function scan(page: Page) {
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
}

for (const path of PUBLIC) {
  test(`smoke + a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const results = await scan(page);
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}

test("smoke + a11y: treasury screens", async ({ page }) => {
  await page.goto("/connect");
  await page.getByRole("button", { name: /Ada Okafor/ }).click();
  await page.waitForURL("**/treasuries");
  await page.getByRole("link", { name: "Nebula Labs Treasury" }).click();
  await page.waitForURL(/\/t\/C/);
  const base = page.url();
  for (const sub of [
    "",
    "/proposals",
    "/proposals/new",
    "/members",
    "/policies",
    "/policies/edit",
    "/transactions",
    "/activity",
    "/settings",
  ]) {
    await page.goto(base + sub);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await scan(page);
    expect(
      results.violations.map(
        (v) =>
          `${sub || "/"} ${v.id}: ${v.nodes
            .map((n) => n.target.join(" "))
            .slice(0, 3)
            .join(" | ")}`,
      ),
    ).toEqual([]);
  }
});
