import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('home is remote navigable, opening a preview never pretends to launch a TV app', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const netflix = page.getByRole('button', { name: 'Open Netflix', exact: true });
  await expect(netflix).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Open YouTube', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Desktop preview');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(':focus')).toHaveAttribute('data-focusable', /^input-/);
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await netflix.focus();
  await page.mouse.move(1, 1);
  await page.screenshot({ path: info.outputPath('luma-home.png') });
  expect(errors).toEqual([]);
});

test('hold OK opens options, favorites persist and hidden apps can be restored', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  await page.getByRole('button', { name: 'Open Netflix', exact: true }).focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(700);
  await page.keyboard.up('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Remove from favorites' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  const netflix = page.getByRole('button', { name: 'Open Netflix', exact: true });
  await netflix.focus();
  await page.keyboard.press('m');
  await page.getByRole('button', { name: 'Hide from library' }).click();
  await expect(netflix).toHaveCount(0);
  await page.getByRole('button', { name: 'Hidden apps (1)', exact: true }).click();
  await expect(netflix).toBeVisible();
  await netflix.focus();
  await page.keyboard.press('m');
  await page.getByRole('button', { name: 'Show in library' }).click();
  await expect(page.getByRole('button', { name: 'Hide hidden apps', exact: true })).toHaveCount(0);
});

test('full-page settings support remote navigation, Back, and persistent preferences', async ({
  page,
}, info) => {
  await page.goto('/');
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await settings.click();
  await expect(page.getByRole('region', { name: 'Luma settings', exact: true })).toBeVisible();
  await expect(settings).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('switch', { name: 'Show app names on Home', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(settings).toBeFocused();
  for (const id of ['setting-home-app-names', 'setting-clock', 'setting-motion', 'setting-refresh', 'setting-show-weather']) {
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(':focus')).toHaveAttribute('data-focusable', id);
  }
  await page.getByRole('button', { name: 'Summit', exact: true }).click();
  await page.getByRole('switch', { name: '24-hour clock', exact: false }).click();
  await page.getByRole('switch', { name: 'Reduced motion', exact: false }).click();
  await page.screenshot({ path: info.outputPath('luma-settings.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.locator('.wallpaper')).toHaveClass(/wallpaper-summit/);
  await expect(page.locator('.luma')).toHaveClass(/reduce-motion/);
});

test('search, category filtering, empty results and Back work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Find an app' });
  await search.fill('jelly');
  await expect(page.locator('.library-grid [data-app-id]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Jellyfin', exact: true })).toBeVisible();
  await search.fill('nothing matches');
  await expect(page.getByRole('heading', { name: 'Nothing here. Yet.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(page.locator('.library-grid [data-app-id]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Spotify', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Favorites', exact: true })).toBeVisible();
});

test('the packaged file app loads offline with CSP, local fonts, no module fetches and no remote requests', async ({
  page,
}, info) => {
  const errors: string[] = [];
  const remote: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) remote.push(request.url());
  });
  page.on('requestfailed', (request) => failed.push(request.url()));
  await page.goto(pathToFileURL(path.resolve('dist/app/index.html')).href);
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeVisible();
  await expect(page.locator('.header-time')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Luma Sans"'))).toBe(true);
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  await expect(page.locator('.library-grid .brand-logo')).toHaveCount(9);
  await expect
    .poll(() =>
      page
        .locator('.library-grid .brand-logo')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Inputs', exact: true }).click();
  await expect(page.getByRole('button', { name: /PlayStation 5/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('luma-inputs.png') });
  expect(remote).toEqual([]);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

async function installMockTV(
  page: Page,
  denied: boolean,
  apps = [{ id: 'com.example.real', title: 'A real TV app', visible: true }],
  devices = [
    { appId: 'com.webos.app.hdmi2', id: 'HDMI_2', port: 2, label: 'Real HDMI', connected: true },
  ],
) {
  const manifest = JSON.parse(readFileSync(path.resolve('appinfo.json'), 'utf8'));
  await page.addInitScript(
    ({ denied, requiredACG, apps, devices }) => {
      const w = window as typeof window & { __calls: { uri: string; payload: any }[] };
      w.__calls = [];
      w.PalmSystem = { identifier: 'com.luma.launcher' };
      w.PalmServiceBridge = class {
        onservicecallback = (_raw: string) => {};
        cancel() {}
        call(uri: string, raw: string) {
          const payload = JSON.parse(raw);
          w.__calls.push({ uri, payload });
          let response: any;
          if (uri.includes('/exec')) {
            if (denied)
              response = { returnValue: false, errorText: 'Mock: service is not elevated.' };
            // Model Homebrew 0.8.0-rc1's webOS 26 access group. The real-inventory
            // test must fail when the packaged caller forgets this permission.
            else if (!requiredACG.includes('lunabus.query'))
              response = {
                returnValue: false,
                errorCode: -1,
                errorText: 'Denied method call "exec" for category "/"',
              };
            else
              response = {
                returnValue: true,
                stdoutString: JSON.stringify(
                  payload.command.includes('listApps')
                    ? {
                        returnValue: true,
                        apps,
                      }
                    : {
                        returnValue: true,
                        devices,
                      },
                ),
              };
          } else if (uri.includes('getAppLoadStatus'))
            response = { returnValue: true, exist: true };
          else response = { returnValue: true };
          setTimeout(() => this.onservicecallback(JSON.stringify(response)), 10);
        }
      };
    },
    { denied, requiredACG: manifest.requiredACG as string[], apps, devices },
  );
}

test('a TV uses its real inventory and launches TV settings separately from Luma settings', async ({
  page,
}) => {
  await installMockTV(page, false);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open A real TV app', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toHaveCount(0);
  await expect(page.getByText('Desktop preview', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__calls.filter((call: any) => call.uri.endsWith('/launch')).length,
      ),
    )
    .toBe(1);
  const launches = await page.evaluate(() =>
    (window as any).__calls.filter((call: any) => call.uri.endsWith('/launch')),
  );
  expect(launches[0].payload).toEqual({ id: 'com.example.real' });
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'TV settings', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__calls
          .filter((call: any) => call.uri.endsWith('/launch'))
          .map((call: any) => call.payload.id),
      ),
    )
    .toEqual(['com.example.real', 'com.palm.app.settings']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsPage = page.getByRole('region', { name: 'Luma settings', exact: true });
  await expect(settingsPage).toBeVisible();
  await expect(settingsPage.getByRole('button', { name: 'TV settings', exact: true })).toHaveCount(
    0,
  );
});

test('TV inventory failure is actionable and never becomes a pretend desktop inventory', async ({
  page,
}) => {
  await installMockTV(page, true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little help from your TV.' })).toBeVisible();
  await expect(page.getByText(/Mock: service is not elevated/)).toBeVisible();
  await expect(page.locator('[data-app-id]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try again', exact: false })).toBeVisible();
});

test('mobile preview remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Find an app' })).toBeVisible();
  const navigation = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
  const tvSettings = await page
    .getByRole('button', { name: 'TV settings', exact: true })
    .boundingBox();
  expect(navigation!.y).toBeGreaterThan(tvSettings!.y + tvSettings!.height);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Luma settings', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('ambient mode wakes without launching an app and restores remote focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter ambient mode' }).click();
  await expect(page.getByRole('button', { name: 'Return to Luma' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('card focus stays the same size and navigation outlines have room beside the selected pill', async ({
  page,
}) => {
  await page.goto('/');
  const netflix = page.getByRole('button', { name: 'Open Netflix', exact: true });
  await expect(netflix).toBeFocused();
  const initial = await netflix.locator('.app-face').boundingBox();
  await page.keyboard.press('ArrowRight');
  const next = await netflix.locator('.app-face').boundingBox();
  expect(next!.width).toBe(initial!.width);
  expect(next!.height).toBe(initial!.height);
  expect(
    await netflix.locator('.app-face').evaluate((element) => getComputedStyle(element).transform),
  ).toBe('none');
  await page.getByRole('button', { name: 'Home', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Apps', exact: true })).toBeFocused();
  const gap = await page.evaluate(() => {
    const selected = document.querySelector<HTMLElement>('.nav-item.active')!;
    const focused = document.activeElement as HTMLElement;
    const styles = getComputedStyle(focused);
    return {
      available: focused.getBoundingClientRect().left - selected.getBoundingClientRect().right,
      required: parseFloat(styles.outlineWidth) + parseFloat(styles.outlineOffset),
    };
  });
  expect(gap.available).toBeGreaterThan(gap.required);
});

test('compact library filters can reset, long names wrap, and inputs stay compact', async ({
  page,
}) => {
  await installMockTV(page, false, [
    { id: 'com.webos.app.lgchannels', title: 'LG Channels', visible: true },
    {
      id: 'com.example.long',
      title: 'An application with a much longer name that should remain completely readable',
      visible: true,
    },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  const label = page
    .locator('.library-grid .app-label')
    .filter({ hasText: 'An application with a much longer name' });
  const dimensions = await label.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
    whiteSpace: getComputedStyle(element).whiteSpace,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height);
  expect(dimensions.whiteSpace).toBe('normal');
  await expect(page.getByRole('button', { name: 'Open LG Channels', exact: true })).toBeVisible();
  const toolbar = await page.locator('.library-toolbar').boundingBox();
  const search = await page.getByRole('searchbox', { name: 'Find an app' }).boundingBox();
  expect(search!.y).toBeLessThan(toolbar!.y + toolbar!.height);
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(page.locator('.library-grid [data-app-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(page.locator('.library-grid [data-app-id]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Inputs', exact: true }).click();
  const input = await page.locator('.full-input-grid .input-card').first().boundingBox();
  expect(input!.height).toBeLessThan(140);
  expect(input!.y).toBeLessThan(250);
});

test('connection artwork follows the reported device labels without changing the input target', async ({
  page,
}) => {
  await installMockTV(page, false, undefined, [
    {
      appId: 'com.webos.app.hdmi1',
      id: 'HDMI_1',
      port: 1,
      label: 'PlayStation 5',
      connected: true,
    },
    { appId: 'com.webos.app.hdmi2', id: 'HDMI_2', port: 2, label: 'USB media', connected: true },
    { appId: 'com.webos.app.hdmi3', id: 'HDMI_3', port: 3, label: 'HDMI 3', connected: true },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Inputs', exact: true }).click();
  const playstation = page.locator('[data-focusable="input-com.webos.app.hdmi1"]');
  await expect(playstation.locator('[data-connection-icon="playstation"]')).toBeVisible();
  await expect(
    page.locator('[data-focusable="input-com.webos.app.hdmi2"] [data-connection-icon="usb"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-focusable="input-com.webos.app.hdmi3"] [data-connection-icon="hdmi"]'),
  ).toBeVisible();
  await playstation.click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__calls
          .filter((call: any) => call.uri.endsWith('/launch'))
          .map((call: any) => call.payload.id),
      ),
    )
    .toEqual(['com.webos.app.hdmi1']);
});

test('Home favorites move inline with hold OK and left/right, and Back keeps the order', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(700);
  await page.keyboard.up('Enter');
  const moving = page.getByRole('button', { name: 'Move Netflix', exact: true });
  await expect(moving).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() =>
      page
        .locator('.favorites-grid [data-app-id]')
        .evaluateAll((nodes) =>
          nodes.slice(0, 2).map((node) => (node as HTMLElement).dataset.appId),
        ),
    )
    .toEqual(['youtube.leanback.v4', 'netflix']);
  await expect(moving).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await expect(page.locator('.favorites-grid.is-reordering')).toHaveCount(0);
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator('.favorites-grid [data-app-id]')
        .evaluateAll((nodes) =>
          nodes.slice(0, 2).map((node) => (node as HTMLElement).dataset.appId),
        ),
    )
    .toEqual(['youtube.leanback.v4', 'netflix']);
  await page.getByRole('button', { name: 'Open Netflix', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Desktop preview');
});

test('moving up to the Apps categories restores the complete top of the scroller', async ({
  page,
}) => {
  const apps = Array.from({ length: 36 }, (_, index) => ({
    id: `com.example.scroll${index + 1}`,
    title: `App ${String(index + 1).padStart(2, '0')}`,
    visible: true,
  }));
  await installMockTV(page, false, apps);
  await page.goto('/');
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  await page.getByRole('button', { name: 'Open App 08', exact: true }).focus();
  await page.locator('main').evaluate((main) => main.scrollTo({ top: 200, behavior: 'instant' }));
  await expect.poll(() => page.locator('main').evaluate((main) => main.scrollTop)).toBe(200);
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('button', { name: 'Open App 02', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('button', { name: 'Utilities', exact: true })).toBeFocused();
  await expect.poll(() => page.locator('main').evaluate((main) => main.scrollTop)).toBe(0);
});

test('Home card captions are opt-in, persist, and do not affect library captions', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await expect(page.locator('.favorites-grid .app-label').first()).toBeHidden();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const names = page.getByRole('switch', { name: 'Show app names on Home', exact: true });
  await expect(names).toHaveAttribute('aria-checked', 'false');
  await names.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.favorites-grid .app-label').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('.favorites-grid .app-label').first()).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(names).toHaveAttribute('aria-checked', 'true');
  await names.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.favorites-grid .app-label').first()).toBeHidden();
  await page.getByRole('button', { name: 'Apps', exact: true }).click();
  await expect(page.locator('.library-grid .app-label').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('.favorites-grid .app-label').first()).toBeHidden();
});
