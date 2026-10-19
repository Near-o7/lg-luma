import { test, expect, type Page } from '@playwright/test';
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
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(700);
  await page.keyboard.up('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Remove from favorites' }).click();
  await page.keyboard.press('Escape');
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

test('settings trap focus, change bundled backgrounds and preserve preferences', async ({
  page,
}, info) => {
  await page.goto('/');
  const settings = page.getByRole('button', { name: 'Luma settings' });
  await settings.click();
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'TV settings', exact: false })).toBeFocused();
  await page.getByRole('button', { name: 'Higher ground', exact: false }).click();
  await page.getByRole('switch', { name: '24-hour clock', exact: false }).click();
  await page.getByRole('switch', { name: 'Gentler motion', exact: false }).click();
  await page.screenshot({ path: info.outputPath('luma-settings.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(settings).toBeFocused();
  await page.reload();
  await expect(page.locator('.wallpaper')).toHaveClass(/wallpaper-alpine/);
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
  await expect(page.getByRole('heading', { name: 'Your favorites' })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Luma Sans"'))).toBe(true);
  await page.getByRole('button', { name: 'Inputs', exact: true }).click();
  await expect(page.getByRole('button', { name: /HDMI 1 PlayStation 5/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('luma-inputs.png') });
  expect(remote).toEqual([]);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

async function installMockTV(page: Page, denied: boolean) {
  await page.addInitScript(
    ({ denied }) => {
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
            else
              response = {
                returnValue: true,
                stdoutString: JSON.stringify(
                  payload.command.includes('listApps')
                    ? {
                        returnValue: true,
                        apps: [{ id: 'com.example.real', title: 'A real TV app', visible: true }],
                      }
                    : {
                        returnValue: true,
                        devices: [
                          {
                            appId: 'com.webos.app.hdmi2',
                            id: 'HDMI_2',
                            port: 2,
                            label: 'Real HDMI',
                            connected: true,
                          },
                        ],
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
    { denied },
  );
}

test('a TV uses its real inventory and sends a single validated launch', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Luma settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('ambient mode wakes without launching an app and restores remote focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter ambient mode' }).click();
  await expect(page.getByRole('button', { name: 'Return to Luma' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await expect(page.getByRole('status')).toHaveCount(0);
});
