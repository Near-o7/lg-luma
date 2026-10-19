import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const location = {
  name: 'Vienna',
  region: 'State of Vienna',
  country: 'Austria',
  latitude: 48.20849,
  longitude: 16.37208,
};

test('choose a city, show its weather, reuse cached data, and disable weather', async ({
  page,
}) => {
  let forecasts = 0;
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    expect(new URL(route.request().url()).searchParams.get('name')).toBe('Vienna');
    await route.fulfill({ json: { results: [{ ...location, admin1: location.region }] } });
  });
  await page.route('https://api.open-meteo.com/**', async (route) => {
    forecasts++;
    expect(new URL(route.request().url()).searchParams.get('latitude')).toBe(
      String(location.latitude),
    );
    await route.fulfill({
      json: { current: { temperature_2m: 14.2, weather_code: 2, is_day: 1 } },
    });
  });
  await page.goto('/');
  expect(forecasts).toBe(0);
  await page.getByRole('button', { name: 'Set weather location', exact: true }).click();
  await page.getByRole('searchbox', { name: 'City or postcode' }).fill('Vienna');
  await page.getByRole('button', { name: 'Search locations', exact: true }).click();
  await page.locator('.location-results button').click();
  await expect(page.locator('.saved-location')).toContainText('Vienna');
  await page.keyboard.press('Escape');
  await expect(page.locator('.weather-summary')).toContainText('Vienna');
  await expect(page.locator('.weather-summary')).toContainText('14°C');
  await expect(page.locator('.weather-summary')).toContainText('Partly cloudy');
  await page.reload();
  await expect(page.locator('.weather-summary')).toContainText('14°C');
  expect(forecasts).toBe(1);
  await page.getByRole('button', { name: 'Luma settings' }).click();
  await page.getByRole('button', { name: 'Remove weather location' }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Set weather location', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Set weather location', exact: true }),
  ).toBeVisible();
  expect(forecasts).toBe(1);
});

test('a configured city with failed weather remains usable and shows an honest fallback', async ({
  page,
}) => {
  await page.addInitScript(
    (location) =>
      localStorage.setItem(
        'luma.preferences.v1',
        JSON.stringify({ version: 1, weatherLocation: location }),
      ),
    location,
  );
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.locator('.weather-summary')).toContainText('Vienna');
  await expect(page.locator('.weather-summary')).toContainText('Weather unavailable');
  await expect(page.getByRole('button', { name: 'Open Netflix', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Open YouTube', exact: true })).toBeFocused();
});

test('packaged file weather works with the restricted CSP and no geolocation lookup', async ({
  page,
}) => {
  const remote: string[] = [];
  await page.addInitScript(
    (location) =>
      localStorage.setItem(
        'luma.preferences.v1',
        JSON.stringify({ version: 1, weatherLocation: location }),
      ),
    location,
  );
  page.on('request', (request) => {
    if (request.url().startsWith('https://')) remote.push(request.url());
  });
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: { current: { temperature_2m: 9.4, weather_code: 0, is_day: 0 } },
    }),
  );
  await page.goto(pathToFileURL(path.resolve('dist/app/index.html')).href);
  await expect(page.locator('.weather-summary')).toContainText('9°C');
  await expect(page.locator('.weather-summary')).toContainText('Clear night');
  expect(remote).toHaveLength(1);
  expect(new URL(remote[0]).hostname).toBe('api.open-meteo.com');
});

test('location search handles no matches and can be retried', async ({ page }) => {
  let requests = 0;
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => {
    requests++;
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Luma settings' }).click();
  await page.getByRole('searchbox', { name: 'City or postcode' }).fill('xx');
  await page.getByRole('button', { name: 'Search locations', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No locations found');
  await page.getByRole('button', { name: 'Search locations', exact: true }).click();
  await expect.poll(() => requests).toBe(2);
});
