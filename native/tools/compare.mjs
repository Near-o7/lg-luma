import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, '.build/native/comparison');
await fs.mkdir(out, { recursive: true });
const time = '2026-10-21T20:41:00+02:00';
const scenarios = [
  { name: 'home', script: 'home,down' },
  { name: 'home-names', names: true, script: 'home,down' },
  { name: 'empty-home', empty: true, script: 'home,down' },
  {
    name: 'apps',
    script: 'apps,down',
    web: async (p) => {
      await click(p, 'nav-apps');
      await focus(p, 'library-netflix');
    },
  },
  {
    name: 'options',
    script: 'apps,down,menu',
    web: async (p) => {
      await click(p, 'nav-apps');
      await focus(p, 'library-netflix');
      await p.keyboard.press('m');
    },
  },
  {
    name: 'music',
    script: 'apps,down,up,right,enter,down',
    web: async (p) => {
      await click(p, 'nav-apps');
      await click(p, 'filter-Music');
      await focus(p, 'library-spotify-beehive');
    },
  },
  {
    name: 'hidden',
    hidden: true,
    script: 'apps,down,up,right,right,right,right,enter,down',
    web: async (p) => {
      await click(p, 'nav-apps');
      await click(p, 'filter-hidden');
      await focus(p, 'library-netflix');
    },
  },
  {
    name: 'search',
    script: 'apps,type:YouTube,back',
    web: async (p) => {
      await click(p, 'nav-apps');
      await p.locator('[data-focusable="search"]').fill('YouTube');
    },
  },
  {
    name: 'no-matches',
    script: 'apps,type:nonexistent,back',
    web: async (p) => {
      await click(p, 'nav-apps');
      await p.locator('[data-focusable="search"]').fill('nonexistent');
    },
  },
  {
    name: 'general',
    script: 'settings,down',
    web: async (p) => {
      await click(p, 'nav-settings');
      await focus(p, 'settings-section-interface');
    },
  },
  {
    name: 'clock',
    script: 'settings,down,enter,down,enter',
    web: async (p) => {
      await click(p, 'nav-settings');
      await click(p, 'setting-clock-format');
    },
  },
  {
    name: 'background',
    script: 'settings,down,down,enter',
    web: async (p) => {
      await click(p, 'nav-settings');
      await click(p, 'settings-section-background');
    },
  },
  {
    name: 'inputs',
    script: 'settings,down,down,down',
    web: async (p) => {
      await click(p, 'nav-settings');
      await focus(p, 'settings-section-inputs');
    },
  },
  {
    name: 'input-mode',
    script: 'settings,down,down,down,enter,enter',
    web: async (p) => {
      await click(p, 'nav-settings');
      await focus(p, 'settings-section-inputs');
      await click(p, 'setting-input-com.webos.app.hdmi1');
    },
  },
];
async function click(page, id) {
  await page.locator(`[data-focusable="${id}"]`).click();
}
async function focus(page, id) {
  await page.locator(`[data-focusable="${id}"]`).focus();
}

if (!process.argv.includes('--native-only')) {
  const browser = await chromium.launch();
  try {
    for (const scenario of scenarios) {
      const page = await browser.newPage({
        viewport: { width: 1920, height: 1080 },
        timezoneId: 'Europe/Berlin',
      });
      await page.clock.setFixedTime(new Date(time));
      await page.addInitScript(
        ({ names, hidden, empty }) =>
          localStorage.setItem(
            'luma.preferences.v1',
            JSON.stringify({
              version: 1,
              wallpaper: 'dunes',
              reducedMotion: true,
              showWeather: false,
              clock24: false,
              showHomeAppNames: names,
              language: 'en',
              hidden: hidden ? ['netflix'] : [],
              favorites: empty ? [] : null,
            }),
          ),
        { names: !!scenario.names, hidden: !!scenario.hidden, empty: !!scenario.empty },
      );
      await page.goto(pathToFileURL(path.join(root, 'dist/app/index.html')).href);
      await page
        .locator(
          scenario.empty ? '[data-focusable="browse-apps"]' : '.favorites-grid [data-focusable]',
        )
        .first()
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      // Compare only the features requested for native parity.
      await page.addStyleTag({
        content:
          '[data-focusable="settings-section-weather"], [data-focusable="setting-language"] { display: none !important; }',
      });
      await scenario.web?.(page);
      await page.mouse.move(1, 1);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(out, `${scenario.name}-web.png`) });
      const metrics = await page.evaluate(() => {
        const selectors = [
          '.navigation',
          '.nav-item',
          '.settings-button',
          '.header-time',
          '.main',
          '.hero',
          '.hero-date',
          '.hero h1',
          '.section-heading',
          '.app-face',
          '.app-label',
          '.input-card',
          '.library-toolbar',
          '.filter-tab',
          '.search-field',
          '.settings-page',
          '.settings-sidebar-item',
          '.setting-row',
          '.wallpaper-thumbnail',
          '.dialog',
          '.dialog h2',
          '.dialog-subtitle',
          '.dialog-footer',
          '.footer',
        ];
        return Object.fromEntries(
          selectors.map((selector) => [
            selector,
            [...document.querySelectorAll(selector)].map((el) => {
              const { x, y, width, height } = el.getBoundingClientRect();
              const s = getComputedStyle(el);
              return {
                text: el.textContent?.trim().slice(0, 90),
                x,
                y,
                width,
                height,
                font: s.fontSize,
                weight: s.fontWeight,
                tracking: s.letterSpacing,
                lineHeight: s.lineHeight,
              };
            }),
          ]),
        );
      });
      await fs.writeFile(
        path.join(out, `${scenario.name}-metrics.json`),
        JSON.stringify(metrics, null, 2),
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
if (!process.argv.includes('--web-only')) {
  const report = {};
  const build = spawnSync('cargo', ['build', '--locked', '--manifest-path', 'native/Cargo.toml'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (build.error || build.status !== 0) throw build.error ?? new Error('Native build failed');
  for (const scenario of scenarios) {
    const preferences = path.join(out, `${scenario.name}-preferences.json`);
    await fs.writeFile(
      preferences,
      JSON.stringify({
        background: 'dunes',
        reduced_motion: true,
        hour_24: false,
        show_names: !!scenario.names,
        hidden: scenario.hidden ? ['netflix'] : [],
        favorites: scenario.empty ? [] : null,
      }),
    );
    const run = spawnSync(
      path.join(root, 'native/target/debug/luma-native'),
      [
        '--preferences',
        preferences,
        '--script',
        scenario.script,
        '--frames',
        '70',
        '--time',
        time,
        '--screenshot',
        path.join(out, `${scenario.name}-native.png`),
      ],
      { cwd: root, stdio: 'inherit', timeout: 30000 },
    );
    if (run.error || run.status !== 0)
      throw run.error ?? new Error(`Native scenario ${scenario.name} failed`);
    const web = path.join(out, `${scenario.name}-web.png`);
    const native = path.join(out, `${scenario.name}-native.png`);
    await sharp({ create: { width: 1920, height: 540, channels: 3, background: '#17191c' } })
      .composite([
        { input: await sharp(web).resize(960, 540).toBuffer(), left: 0, top: 0 },
        { input: await sharp(native).resize(960, 540).toBuffer(), left: 960, top: 0 },
      ])
      .png()
      .toFile(path.join(out, `${scenario.name}-side-by-side.png`));
    const webPixels = await sharp(web).removeAlpha().raw().toBuffer();
    const nativePixels = await sharp(native).removeAlpha().raw().toBuffer();
    if (webPixels.length !== nativePixels.length)
      throw new Error('Comparison surfaces must have identical dimensions');
    let error = 0;
    for (let i = 0; i < webPixels.length; i++) error += Math.abs(webPixels[i] - nativePixels[i]);
    report[scenario.name] = {
      meanAbsoluteChannelDifference: +(error / webPixels.length).toFixed(3),
      range: '0–255; informational, not a cross-renderer pixel-perfect gate',
    };
  }
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(`Visual references: ${path.relative(root, out)} (web left, native right)`);
