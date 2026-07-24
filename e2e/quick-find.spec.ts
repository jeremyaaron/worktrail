import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";

const demoProjectId = "10000000-0000-4000-8000-000000000201";
const maintainerId = "10000000-0000-4000-8000-000000000102";
const readyWorkItemId = "10000000-0000-4000-8000-000000000402";
const inProgressWorkItemId = "10000000-0000-4000-8000-000000000403";
const quickFindShortcut =
  process.platform === "darwin" ? "Meta+k" : "Control+k";

function quickFindDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Quick Find" });
}

function quickFindInput(page: Page): Locator {
  return quickFindDialog(page).getByRole("combobox", {
    name: "Search Worktrail",
  });
}

async function expectFocused(locator: Locator): Promise<void> {
  await expect
    .poll(async () =>
      locator.evaluate(
        (element) => element === element.ownerDocument.activeElement,
      ),
    )
    .toBe(true);
}

async function openQuickFind(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Open Quick Find" }).click();

  const dialog = quickFindDialog(page);
  await expect(dialog).toBeVisible();
  await expectFocused(quickFindInput(page));
  return dialog;
}

async function searchQuickFind(page: Page, query: string): Promise<Locator> {
  const input = quickFindInput(page);
  await input.fill(query);
  await expect(input).toHaveValue(query);
  await expect(quickFindDialog(page).getByText("Searching...")).toBeHidden();
  return quickFindDialog(page);
}

async function attachViewportScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await testInfo.attach(name, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
}

test.describe("Quick Find", () => {
  test("supports launcher, shortcut, navigation, keyboard movement, and focus restoration", async ({
    page,
  }) => {
    await page.goto(`/projects/${demoProjectId}/board`);

    const trigger = page.getByRole("button", { name: "Open Quick Find" });
    const dialog = await openQuickFind(page);
    const input = quickFindInput(page);

    await expect(dialog.getByRole("heading", { name: "Global" })).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Current project" }),
    ).toBeVisible();
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      "quick-find-navigation-global-my-work",
    );

    await input.press("End");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      "quick-find-navigation-project-settings",
    );

    await input.press("Home");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/my-work$/);

    await trigger.focus();
    await page.keyboard.press(quickFindShortcut);
    await expect(quickFindDialog(page)).toBeVisible();
    await expect(
      quickFindDialog(page).getByRole("heading", { name: "Current project" }),
    ).toBeHidden();

    await page.keyboard.press(quickFindShortcut);
    await expect(page.getByRole("dialog", { name: "Quick Find" })).toHaveCount(
      1,
    );

    await page.keyboard.press("Escape");
    await expect(quickFindDialog(page)).toBeHidden();
    await expectFocused(trigger);
  });

  test("shows safe errors, retries searches, and closes before an actor change", async ({
    page,
  }) => {
    let requestCount = 0;

    await page.route("**/api/quick-find", async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "internal diagnostic detail" }),
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });

    await page.goto("/my-work");
    await openQuickFind(page);
    const dialog = await searchQuickFind(page, "Cloud Readiness");

    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("Quick Find is temporarily unavailable.");
    await expect(alert).not.toContainText("internal diagnostic detail");

    await dialog.getByRole("button", { name: "Retry" }).click();
    await expect(
      dialog.getByRole("heading", { name: "Projects" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Milestones" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("option", { name: /Cloud Readiness/ }),
    ).toHaveCount(2);

    await page.getByLabel("Acting as").selectOption(maintainerId);
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Acting as")).toHaveValue(maintainerId);

    const reopenedDialog = await openQuickFind(page);
    const reopenedInput = quickFindInput(page);
    await expect(reopenedInput).toHaveValue("");

    const noResultsQuery = "phase ten no result";
    await reopenedInput.fill(noResultsQuery);
    await expect(reopenedDialog.getByText("Searching...")).toBeVisible();
    await expect(
      reopenedDialog.getByText(`No results for "${noResultsQuery}"`),
    ).toBeVisible();
  });

  test("distinguishes lifecycle results and hands broad work searches to the work list", async ({
    page,
  }) => {
    await page.goto("/my-work");
    await openQuickFind(page);

    let dialog = await searchQuickFind(page, "Legacy Tracker");
    await expect(
      dialog.getByRole("option", { name: /Legacy Tracker.*Archived project/ }),
    ).toBeVisible();

    dialog = await searchQuickFind(page, "Create initial MVP planning docs");
    await expect(
      dialog.getByRole("option", {
        name: /WT-5.*Create initial MVP planning docs.*Completed work item/,
      }),
    ).toBeVisible();

    dialog = await searchQuickFind(page, "work");
    const overflow = dialog.getByRole("option", {
      name: "View all matching work items",
    });
    await expect(overflow).toBeVisible();
    await overflow.click();

    await expect(page).toHaveURL(
      /\/work-items\?search=work&archivedProjects=include$/,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Work items" }),
    ).toBeVisible();
  });

  test("opens exact work items and attachment targets through pointer and keyboard activation", async ({
    page,
  }) => {
    await page.goto("/my-work");
    await openQuickFind(page);

    let dialog = await searchQuickFind(page, "verification-evidence");
    await dialog
      .getByRole("option", {
        name: /Attachment.*verification-evidence\.json.*WT-3/,
      })
      .click();

    await expect(page).toHaveURL(`/work-items/${inProgressWorkItemId}#files`);
    const files = page.locator("#files");
    await expect(files).toBeVisible();
    await expectFocused(files);

    await openQuickFind(page);
    dialog = await searchQuickFind(page, "verification-evidence");
    await dialog
      .getByRole("option", {
        name: /Attachment.*verification-evidence\.json.*WT-3/,
      })
      .click();
    await expect(page).toHaveURL(`/work-items/${inProgressWorkItemId}#files`);
    await expectFocused(files);

    await openQuickFind(page);
    await searchQuickFind(page, "WT-2");
    await expect(quickFindInput(page)).toHaveAttribute(
      "aria-activedescendant",
      `quick-find-work-item-${readyWorkItemId}`,
    );
    await quickFindInput(page).press("Enter");

    await expect(page).toHaveURL(`/work-items/${readyWorkItemId}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Add filter controls to work item list",
      }),
    ).toBeVisible();
  });

  test("keeps search controls and results usable at desktop, mobile, and zoom-equivalent widths", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/projects/${demoProjectId}/board`);
    await openQuickFind(page);
    await searchQuickFind(page, "work");

    const viewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
      { name: "200-percent-equivalent", width: 640, height: 900 },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      const geometry = await quickFindDialog(page).evaluate((dialog) => {
        const bounds = dialog.getBoundingClientRect();
        const input =
          dialog.querySelector<HTMLInputElement>("#quick-find-query");
        const close = dialog.querySelector<HTMLElement>(
          '[aria-label="Close Quick Find"]',
        );
        const inputBounds = input?.getBoundingClientRect();
        const closeBounds = close?.getBoundingClientRect();

        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          pageOverflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          dialogOverflow: dialog.scrollWidth - dialog.clientWidth,
          dialog: {
            left: bounds.left,
            top: bounds.top,
            right: bounds.right,
            bottom: bounds.bottom,
          },
          input: inputBounds
            ? {
                left: inputBounds.left,
                right: inputBounds.right,
                width: inputBounds.width,
              }
            : null,
          close: closeBounds
            ? {
                left: closeBounds.left,
                right: closeBounds.right,
                width: closeBounds.width,
              }
            : null,
        };
      });

      expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
      expect(geometry.dialogOverflow).toBeLessThanOrEqual(1);
      expect(geometry.dialog.left).toBeGreaterThanOrEqual(0);
      expect(geometry.dialog.top).toBeGreaterThanOrEqual(0);
      expect(geometry.dialog.right).toBeLessThanOrEqual(
        geometry.viewportWidth + 1,
      );
      expect(geometry.dialog.bottom).toBeLessThanOrEqual(
        geometry.viewportHeight + 1,
      );
      expect(geometry.input).not.toBeNull();
      expect(geometry.input?.width ?? 0).toBeGreaterThan(80);
      expect(geometry.close).not.toBeNull();
      expect(geometry.close?.width ?? 0).toBeGreaterThanOrEqual(32);

      await expect(quickFindInput(page)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Close Quick Find" }),
      ).toBeVisible();
      await expect(
        quickFindDialog(page).getByRole("option", {
          name: "View all matching work items",
        }),
      ).toBeVisible();
      await attachViewportScreenshot(
        page,
        testInfo,
        `quick-find-${viewport.name}.png`,
      );
    }
  });
});
