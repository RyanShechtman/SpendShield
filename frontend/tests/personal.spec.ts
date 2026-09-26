import { test, expect } from "@playwright/test";

async function setup(page) {
  await page.goto("/");
  await page.getByLabel("Your name", { exact: true }).fill("Maya");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Monthly spending budget (USD)").fill("500");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Goal amount (USD)", { exact: true }).fill("1500");
  await page.getByLabel("Already saved (USD)").fill("200");
  await page.getByLabel("Monthly savings plan (USD)").fill("100");
  await page.getByRole("button", { name: "Open my dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Maya." }),
  ).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/test/reset")).ok()).toBeTruthy();
});

test("onboarding, settings, entries, edits and persistence", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What should we call you?" }),
  ).toBeVisible();
  await page.screenshot({ path: "../docs/onboarding.png", fullPage: true });
  await setup(page);
  await expect(
    page.getByRole("heading", { name: "Add your first transaction." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByLabel("Merchant or description").fill("Neighborhood cafe");
  await page.getByLabel("Amount (USD)", { exact: true }).fill("12.50");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Restaurants");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await request.get("/api/dashboard")).ok()).toBeTruthy();
  expect((await (await request.get("/api/dashboard")).json()).available).toBe(
    487.5,
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Taylor");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Taylor." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Neighborhood cafe", exact: true })
    .click();
  await page.getByLabel("Amount (USD)", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  expect((await (await request.get("/api/dashboard")).json()).available).toBe(
    485,
  );
  await page.screenshot({
    path: "../docs/dashboard.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("purchase intentions require an explicit saved confirmation", async ({
  page,
  request,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Purchase Shield", exact: true })
    .click();
  await page.getByLabel("Purchase you’re considering").fill("Running shoes");
  await page.getByLabel("Price (USD)", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Show me the tradeoff" }).click();
  await page.getByText("Record a cheaper option", { exact: true }).click();
  await page.getByLabel("Alternative name").fill("Last season shoes");
  await page.getByLabel("Actual price (USD)").fill("60");
  await page
    .getByRole("button", { name: "Choose this option & plan the difference" })
    .click();
  await page.getByRole("button", { name: "Review planned savings" }).click();
  let d = await (await request.get("/api/dashboard")).json();
  expect(d.goal.saved).toBe(200);
  expect(d.goal.planned).toBe(40);
  await page.getByRole("button", { name: "Mark as saved" }).click();
  await page.getByRole("button", { name: "Yes, I have saved it" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  d = await (await request.get("/api/dashboard")).json();
  expect(d.goal.saved).toBe(240);
  expect(d.goal.planned).toBe(0);
});

test("CSV preview, append and duplicate protection", async ({
  page,
  request,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const csv = {
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "date,merchant,amount,category\n2026-01-01,Salary,1000,Income\n2026-01-02,Shop,-20,Shopping\n",
    ),
  };
  await page.getByRole("dialog").locator("input[type=file]").setInputFiles(csv);
  await expect(
    page.getByRole("heading", { name: "2 new transactions" }),
  ).toBeVisible();
  expect(
    (await (await request.get("/api/dashboard")).json()).transaction_count,
  ).toBe(0);
  await page.getByRole("button", { name: "Import 2 transactions" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByRole("dialog").locator("input[type=file]").setInputFiles(csv);
  await expect(
    page.getByRole("heading", { name: "0 new transactions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 0 transactions" }),
  ).toBeDisabled();
  const d = await (await request.get("/api/dashboard")).json();
  expect(d.profile.first_name).toBe("Maya");
  expect(d.goal.saved).toBe(200);
  expect(d.transaction_count).toBe(2);
});

test("mobile setup and dashboard fit small screens", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.screenshot({
    path: "test-results/onboarding-mobile.png",
    fullPage: true,
  });
  await setup(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your settings" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/settings-mobile.png",
    fullPage: true,
  });
});

test("compare prices, plan a reminder, archive and restore a check", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await page
    .getByRole("button", { name: "Purchase Shield", exact: true })
    .click();
  await page.getByLabel("Purchase you’re considering").fill("Trail shoes");
  await page.getByLabel("Price (USD)", { exact: true }).fill("160");
  await page.getByRole("button", { name: "Show me the tradeoff" }).click();
  await page
    .getByRole("button", { name: "Compare prices", exact: true })
    .click();
  await page.getByLabel("Compare price (USD)", { exact: true }).fill("87");
  await expect(page.locator(".scenario-results")).toContainText("$73.00");
  await expect(page.locator(".scenario-results")).toContainText("27 days");
  await page
    .getByRole("button", { name: "Use this as my target price" })
    .click();
  await expect(page.getByLabel("Target price (optional, USD)")).toHaveValue(
    "87",
  );
  await page.getByLabel("Revisit in (hours)").fill("24");
  await page
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await expect(
    page.getByText("Saved. Find it under Saved purchase checks."),
  ).toBeVisible();
  const p = (await (await request.get("/api/purchases/pending")).json())[0];
  expect(p.target_price_cents).toBe(8700);
  await page
    .getByRole("button", { name: "Archive Trail shoes", exact: true })
    .click();
  await expect(
    page.getByText("Your purchase checks will be saved here automatically."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore Trail shoes", exact: true })
    .click();
  await page.getByRole("button", { name: "To consider", exact: true }).click();
  await page
    .getByRole("button", { name: "Review Trail shoes", exact: true })
    .click();
  await expect(page.getByLabel("Target price (optional, USD)")).toHaveValue(
    "87",
  );
  await expect(page.getByLabel("Revisit in (hours)")).toHaveValue("24");
  await page.getByRole("button", { name: "Edit price", exact: true }).click();
  await page.locator("#confirm-price").fill("150");
  await page
    .getByRole("button", { name: "Confirm price", exact: true })
    .click();
  await expect(page.locator(".purchase-title")).toContainText("$150.00");
  await expect(page.locator(".saved-checks")).toContainText("$150.00");
  await expect(page.locator(".scenario-results")).not.toContainText(
    "Calculating",
  );
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/purchase-polished.png",
    fullPage: true,
  });
});

test("correct confirmed savings and reopen a decision", async ({
  page,
  request,
}) => {
  await setup(page);
  const p = await (
    await request.post("/api/ai/analyze-purchase", {
      data: { text: "Lamp", price: "50", use_ai: false },
    })
  ).json();
  await request.post("/api/purchases/protect", {
    data: { purchase_id: p.id, action: "purchase_skipped" },
  });
  await request.post(`/api/events/${p.id}/confirm-saved`);
  await page.reload();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await page
    .getByRole("button", { name: "Mark as not saved", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, mark as not saved" }).click();
  await expect(
    page.getByRole("button", { name: "Mark as saved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Undo decision", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, undo decision" }).click();
  await expect(
    page.getByText("No decisions yet.", { exact: false }),
  ).toBeVisible();
  const d = await (await request.get("/api/dashboard")).json();
  expect(d.goal.saved).toBe(200);
  expect(d.goal.planned).toBe(0);
  expect(
    (await (await request.get("/api/purchase-history")).json()).total,
  ).toBe(1);
});

test("backup preview, replacement and undo restore", async ({
  page,
  request,
}) => {
  await setup(page);
  const backup = await (await request.get("/api/profile/export")).json();
  await request.post("/api/profile", {
    data: { name: "Taylor", ai_enabled: false },
  });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /Restore a backup/ }).click();
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "my-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await expect(
    page.getByRole("heading", { name: "Maya's profile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restore this backup" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Maya." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /Restore a backup/ }).click();
  await page
    .getByRole("button", { name: "Undo last restore", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm undo restore" }).click();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Taylor." }),
  ).toBeVisible();
});

test("AI category review is explicit and guide explains every workflow", async ({
  page,
  request,
}) => {
  await setup(page);
  await request.post("/api/transactions", {
    data: {
      merchant: "ABC STORE",
      date: "2026-01-01",
      category: "Other",
      amount: "30",
    },
  });
  await page.reload();
  const d = await (await request.get("/api/dashboard")).json();
  const t = (await (await request.get("/api/transactions")).json())
    .transactions[0];
  await page.route("**/api/ai/financial-scan", (route) =>
    route.fulfill({
      json: {
        ai: {
          status: "live",
          model: "test-model",
          message: "Mocked for browser testing",
        },
        insights: [],
        classified_count: 0,
        dashboard: d,
        suggestions: [
          {
            ...t,
            category: "Groceries",
            normalized_merchant: "ABC Store",
            confidence: 0.95,
          },
        ],
      },
    }),
  );
  await page
    .getByRole("button", { name: "Financial Scan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run financial scan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review 1 suggested category" }),
  ).toBeVisible();
  expect(
    (await (await request.get("/api/transactions")).json()).transactions[0]
      .category,
  ).toBe("Other");
  await page.locator(".category-review").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Apply 1 selected" }).click();
  await expect(page.locator(".category-review")).not.toBeVisible();
  expect(
    (await (await request.get("/api/transactions")).json()).transactions[0]
      .category,
  ).toBe("Groceries");
  await page.getByRole("button", { name: "How to use SpendShield" }).click();
  await expect(
    page.getByRole("heading", { name: "Your guide to SpendShield" }),
  ).toBeVisible();
  await expect(page.locator(".guide-list details")).toHaveCount(12);
  await page
    .locator(".guide-list summary")
    .filter({ hasText: "Understand the limits" })
    .click();
  await expect(
    page.getByText("There is no bank sync", { exact: false }),
  ).toBeVisible();
});

test("purchase results and actions fit a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page);
  await page
    .getByRole("button", { name: "Purchase Shield", exact: true })
    .click();
  await page
    .getByLabel("Purchase you’re considering")
    .fill("A useful kitchen appliance");
  await page.getByLabel("Price (USD)", { exact: true }).fill("160");
  await page.getByRole("button", { name: "Show me the tradeoff" }).click();
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save reminder", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/purchase-mobile.png",
    fullPage: true,
  });
});

test("hosted sign-in screen explains privacy without requesting a key", async ({
  page,
}) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { hosted: true, authenticated: false } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Continue with GitHub" }),
  ).toHaveAttribute("href", "/auth/login");
  await expect(
    page.getByText("You never need to enter an API key.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Maya." }),
  ).not.toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/hosted-sign-in.png",
    fullPage: true,
  });
});

test("hosted sign out removes the dashboard", async ({ page }) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { hosted: true, authenticated: true } }),
  );
  await setup(page);
  await expect(
    page.getByText("Private account", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Continue with GitHub" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Maya." }),
  ).not.toBeVisible();
});
