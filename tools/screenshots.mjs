import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, 'docs');
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.clock.setFixedTime(new Date('2026-10-19T20:41:00'));
  await page.goto(pathToFileURL(path.join(root, 'dist/app/index.html')).href);
  await page.getByRole('button', { name: 'Open Netflix', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(directory, 'home.png') });
  for (const [name, action] of [
    ['apps', () => page.getByRole('button', { name: 'Apps', exact: true }).click()],
    ['settings', () => page.getByRole('button', { name: 'Settings', exact: true }).click()],
    ['inputs', () => page.getByRole('button', { name: 'Inputs', exact: true }).click()],
  ]) {
    await action();
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(directory, `${name}.png`) });
  }
  console.log('Saved desktop-preview screenshots to docs/.');
} finally {
  await browser.close();
}
