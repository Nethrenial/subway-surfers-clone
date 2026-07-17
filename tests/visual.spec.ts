import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

type CanvasSample = {
  ok: boolean;
  reason: string;
  variance?: number;
  colorBuckets?: number;
};

async function sampleCanvas(page: import('@playwright/test').Page): Promise<CanvasSample> {
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box || box.width < 32 || box.height < 32) {
    return { ok: false, reason: 'canvas-too-small' };
  }

  const buffer = await canvas.screenshot();
  const png = PNG.sync.read(buffer);
  let min = 255;
  let max = 0;
  let alphaPixels = 0;
  const buckets = new Set<string>();
  const stride = Math.max(1, Math.floor((png.width * png.height) / 4096));

  for (let pixel = 0; pixel < png.width * png.height; pixel += stride) {
    const offset = pixel * 4;
    const r = png.data[offset];
    const g = png.data[offset + 1];
    const b = png.data[offset + 2];
    const a = png.data[offset + 3];
    min = Math.min(min, r, g, b);
    max = Math.max(max, r, g, b);
    if (a > 0) alphaPixels += 1;
    buckets.add(`${r >> 4},${g >> 4},${b >> 4},${a >> 6}`);
  }

  const variance = max - min;
  return {
    ok: alphaPixels > 256 && (variance > 8 || buckets.size > 3),
    reason: 'sampled',
    variance,
    colorBuckets: buckets.size,
  };
}

test('renders and completes the runner interaction loop', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);

  const sample = await sampleCanvas(page);
  expect(sample, JSON.stringify(sample)).toMatchObject({ ok: true });

  const canvasBox = await page.locator('#game-canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  if (canvasBox) expect(canvasBox.width / canvasBox.height).toBeCloseTo(9 / 16, 1);

  const distanceBefore = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.distance ?? 0);
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.distance ?? 0))
    .toBeGreaterThan(distanceBefore + 0.5);

  if (testInfo.project.name.includes('mobile')) {
    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height * 0.65;
      await canvas.dispatchEvent('pointerdown', { pointerId: 7, clientX: centerX, clientY: centerY });
      await canvas.dispatchEvent('pointerup', { pointerId: 7, clientX: centerX + 90, clientY: centerY });
    }
  } else {
    await page.keyboard.press('KeyD');
  }

  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.position.x ?? 0))
    .toBeGreaterThan(0.5);

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.input('jump'));
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.state))
    .toBe('jumping');

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('active-play'));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.input('roll'));
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.state))
    .toBe('rolling');

  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('paused');
  const pausedDistance = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.distance ?? -1);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.distance ?? -2)).toBe(pausedDistance);
  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('running');

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('game-over'));
  await expect(page.locator('#game-over-overlay')).toHaveClass(/is-visible/);
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('running');

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${testInfo.project.name}-game`, {
    body: screenshot,
    contentType: 'image/png',
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('a real seeded hazard collision ends and restarts the run', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'Collision behavior is viewport independent.');
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__?.seed(7);
    window.__THREE_GAME_TEST_HOOKS__?.setState('active-play');
  });

  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state), { timeout: 7_000 })
    .toBe('game-over');
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.state)).toBe('crashed');
  await expect(page.locator('#game-over-overlay')).toHaveClass(/is-visible/);

  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('running');
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('collectibles, power-ups, and shield recovery affect a real run', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'Mobile gesture and HUD fit are covered by the main interaction test.');
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('active-play'));
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.coins ?? 0), { timeout: 3_000 })
    .toBeGreaterThan(0);
  await expect(page.locator('#coin-value')).not.toHaveText('0');

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('power-up-test'));
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.powerUps.magnet ?? 0))
    .toBeGreaterThan(8);
  await expect(page.locator('[data-power="magnet"]')).toHaveClass(/is-active/);

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.grantPowerUp('multiplier'));
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.multiplier)).toBe(2);
  await expect(page.locator('#multiplier-value')).toHaveText('x2');

  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__?.setState('active-play');
    window.__THREE_GAME_TEST_HOOKS__?.grantPowerUp('shield');
  });
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const diagnostics = window.__THREE_GAME_DIAGNOSTICS__;
          return diagnostics?.state === 'running' && diagnostics.powerUps.shield === 0;
        }),
      { timeout: 7_000 },
    )
    .toBe(true);
  await expect(page.locator('#game-over-overlay')).not.toHaveClass(/is-visible/);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
