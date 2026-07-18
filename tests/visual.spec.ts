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
  await expect(page.locator('#loading-screen')).toHaveClass(/is-complete/);
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.assets.files ?? 0)).toBe(8);
  await expect(page.locator('#main-menu')).not.toHaveClass(/is-hidden/);
  await page.locator('#menu-settings-button').click();
  await expect(page.locator('#settings-overlay')).toHaveClass(/is-visible/);
  await page.locator('#master-volume').evaluate((element: HTMLInputElement) => {
    element.value = '70';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#master-output')).toHaveText('70');
  await page.locator('#settings-close-button').click();
  await page.locator('#start-button').click();
  await expect(page.locator('#main-menu')).toHaveClass(/is-hidden/);
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.audio.unlocked)).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.audio.master)).toBe(0.7);

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
  const finishedRunSeed = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.seed);
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('running');
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.seed)).not.toBe(finishedRunSeed);

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
    window.__THREE_GAME_TEST_HOOKS__?.setState('collision-test');
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
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('collectible-test'));
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
    window.__THREE_GAME_TEST_HOOKS__?.setState('collision-test');
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

test('oncoming trains move continuously after entering the visible corridor', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'Train scheduling is viewport independent.');
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.assets.files ?? 0) === 8);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('hazard-showcase'));

  await expect.poll(
    async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.entities.visibleTrains ?? 0),
  ).toBeGreaterThan(0);

  const startZ = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.entities.leadTrainZ ?? -Infinity);
  await page.waitForTimeout(300);
  const endZ = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.entities.leadTrainZ ?? -Infinity);
  expect(endZ - startZ).toBeGreaterThan(4);

  expect(await page.evaluate(
    () => window.__THREE_GAME_DIAGNOSTICS__?.entities.trainConflictViolations ?? -1,
  )).toBe(0);
  expect(await page.evaluate(
    () => window.__THREE_GAME_DIAGNOSTICS__?.entities.trainMotionViolations ?? -1,
  )).toBe(0);
  expect(await page.evaluate(
    () => window.__THREE_GAME_DIAGNOSTICS__?.entities.prematureTrainRecycles ?? -1,
  )).toBe(0);
});

test('magnet detaches coins individually from their authored trail', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'Magnet simulation is viewport independent.');
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.assets.files ?? 0) === 8);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('magnet-capture-test'));

  await expect.poll(async () => page.evaluate(
    () => window.__THREE_GAME_DIAGNOSTICS__?.entities.magnetCapturesStarted ?? 0,
  )).toBeGreaterThan(0);
  expect(await page.evaluate(
    () => window.__THREE_GAME_DIAGNOSTICS__?.entities.maxConcurrentCaptures,
  )).toBe(1);

  await testInfo.attach('staggered-magnet-capture', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('generated routes remain open during a sustained live simulation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'Route generation is viewport independent.');
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.assets.files ?? 0) === 8);
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__?.seed(7);
    window.__THREE_GAME_TEST_HOOKS__?.setState('active-play');
    window.__THREE_GAME_TEST_HOOKS__?.setInvulnerable(true);
    window.__THREE_GAME_TEST_HOOKS__?.setSpeedForTest(18.5);
  });
  await page.waitForTimeout(8_000);

  const entities = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.entities);
  expect(entities?.trainsEntered).toBeGreaterThan(0);
  expect(entities?.routeWallViolations).toBe(0);
  expect(entities?.trainConflictViolations).toBe(0);
  expect(entities?.trainMotionViolations).toBe(0);
  expect(entities?.prematureTrainRecycles).toBe(0);
});
