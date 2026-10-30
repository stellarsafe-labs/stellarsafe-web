import { expect, test, type Page } from "@playwright/test";

async function connectAs(page: Page, name: RegExp) {
  await page.goto("/connect");
  await page.getByRole("button", { name }).click();
  await page.waitForURL("**/treasuries");
}

async function switchPersona(page: Page, name: string) {
  await page.getByRole("button", { name: /Wallet menu/ }).click();
  await page.getByRole("menuitem", { name: /Switch persona/ }).hover();
  await page.getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByRole("button", { name: new RegExp(`connected as ${name}`) })).toBeVisible();
}

async function signInDialog(page: Page, confirm: RegExp) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: confirm }).click();
  await expect(dialog.getByText(/Confirmed in ledger/)).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "Done" }).click();
}

test("propose → two approvals → execute, enforced end to end", async ({ page }) => {
  await connectAs(page, /Chloé Martin/);
  await page.getByRole("link", { name: "Nebula Labs Treasury" }).click();
  await page.getByRole("link", { name: "New payment" }).first().click();

  await page.getByLabel("Title").fill("E2E design invoice");
  await page.getByRole("combobox", { name: "Recipient" }).click();
  await page.getByRole("option", { name: /Pixelcraft Studio/ }).click();
  await page.getByLabel("Amount").fill("600");
  await page.getByRole("combobox", { name: "Budget" }).click();
  await page.getByRole("option", { name: /Marketing/ }).click();

  // Policy preview reflects the 500+ tier.
  await expect(page.getByText(/approvals required/)).toBeVisible();
  await page.getByRole("button", { name: /Review & submit/ }).click();
  await signInDialog(page, /Sign & submit/);
  await page.waitForURL(/\/proposals\/\d+$/);
  const url = page.url();

  // Proposer cannot approve their own payment.
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

  await switchPersona(page, "Ben Lindqvist");
  await page.goto(url);
  await page.getByRole("button", { name: "Approve" }).click();
  await signInDialog(page, /Sign approval/);
  await expect(page.getByText("1 of 2 required", { exact: true })).toBeVisible();

  await switchPersona(page, "Dev Raman");
  await page.goto(url);
  await page.getByRole("button", { name: "Approve" }).click();
  await signInDialog(page, /Sign approval/);

  await expect(page.getByText("Ready to execute").first()).toBeVisible();
  await page.getByRole("button", { name: "Execute payment" }).click();
  await signInDialog(page, /Sign & send/);
  await expect(page.getByText("Executed").first()).toBeVisible();

  await page.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByText(/executed #\d+: 600 USDC to Pixelcraft Studio/).first()).toBeVisible();
});

test("viewer persona is read-only", async ({ page }) => {
  await connectAs(page, /Eve Tanaka/);
  await page.getByRole("link", { name: "Nebula Labs Treasury" }).click();
  await expect(page.getByText(/view-only access/)).toBeVisible();
  await expect(page.getByRole("link", { name: /^New payment$/ }).filter({ hasText: "New payment" })).toHaveCount(1); // sidebar link only
  await page.goto(page.url() + "/proposals/new");
  await expect(page.getByText(/can't propose payments/)).toBeVisible();
});
