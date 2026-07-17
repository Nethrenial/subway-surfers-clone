import { expect, test, type Page } from '@playwright/test';

async function prepareDeterministicScreenshot(page: Page, stateName?: string): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.assets.files ?? 0) === 8);
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  const hasHooks = await page.evaluate(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  if (!hasHooks) throw new Error('Missing deterministic Three.js game test hooks.');

  await page.evaluate((name) => {
    const hooks = window.__THREE_GAME_TEST_HOOKS__;
    hooks?.seed(12345);
    hooks?.setReducedMotion(true);
    hooks?.hideDebugUi(true);
    if (name) hooks?.setState(name);
    hooks?.setPausedForScreenshot(true);
  }, stateName);
  await page.waitForTimeout(180);
}

for (const state of [
  'menu',
  'settings',
  'active-play',
  'jump-test',
  'roll-test',
  'hazard-showcase',
  'shield-test',
  'paused',
  'game-over',
] as const) {
  test(`${state} visual baseline`, async ({ page }, testInfo) => {
    await prepareDeterministicScreenshot(page, state);
    await expect(page).toHaveScreenshot(`${state}-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.018,
      animations: 'disabled',
    });
  });
}
