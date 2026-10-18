import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function waitForWorkItemResults(page: Page): Promise<void> {
  const results = page.locator('app-work-item-result-list section.list-panel[aria-busy="false"]');
  // Readiness uses the existing action/test budget; expected rows remain separate assertions.
  await results.waitFor();
  await expect(results.getByRole('alert')).toHaveCount(0);
}

export async function waitForCycleReview(page: Page): Promise<void> {
  const review = page.locator('app-project-cycle-review-page');
  await review.locator('.review-header, app-error-panel').first().waitFor();
  await expect(review.getByRole('alert')).toHaveCount(0);
}
