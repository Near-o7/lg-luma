import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';
import { tsImport } from 'tsx/esm/api';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, '.build/native/assets');
const sources = path.join(root, '.build/native/vector-sources');

export async function generateVectorAssets() {
  await fs.mkdir(sources, { recursive: true });
  const assets = [];
  for (const file of await fs.readdir(path.join(root, 'public/logos'))) {
    if (!file.endsWith('.svg')) continue;
    const name = path.parse(file).name;
    assets.push({
      source: path.join(root, 'public/logos', file),
      output: path.join(out, 'logos', `${name}.lvec`),
      monochrome: ['apple-tv', 'disney-plus', 'prime-video', 'das-erste'].includes(name),
      reference_size: 1536,
    });
  }

  async function icon(name, element) {
    let svg = typeof element === 'string' ? element : renderToStaticMarkup(element);
    svg = svg.replace(
      /<svg[^>]*>/,
      (tag) =>
        `${tag.replace(/\s(?:width|height|color|xmlns)="[^"]*"/g, '').slice(0, -1)} xmlns="http://www.w3.org/2000/svg" width="128" height="128" color="#fff">`,
    );
    const source = path.join(sources, `${name}.svg`);
    await fs.writeFile(source, svg);
    assets.push({
      source,
      output: path.join(out, 'ui-icons', `${name}.lvec`),
      reference_size: 256,
    });
  }

  const uiIcons = {
    settings: 'Settings2',
    search: 'Search',
    close: 'X',
    check: 'Check',
    heart: 'Heart',
    'eye-off': 'EyeOff',
    eye: 'Eye',
    type: 'Type',
    clock: 'Clock3',
    motion: 'Accessibility',
    refresh: 'RefreshCw',
    power: 'Power',
    right: 'ChevronRight',
    left: 'ArrowLeft',
    arrow: 'ArrowRight',
    more: 'MoreHorizontal',
    grid: 'Grid2X2',
    alert: 'CircleAlert',
    sparkles: 'Sparkles',
    tv: 'Tv',
    coffee: 'Coffee',
    globe: 'Globe',
    moonlight: 'MonitorPlay',
    gaming: 'Gamepad2',
    generic: 'AppWindow',
    language: 'Languages',
    location: 'MapPin',
    thermometer: 'Thermometer',
    'weather-sun': 'Sun',
    'weather-moon': 'Moon',
    'weather-partly-cloudy': 'CloudSun',
    'weather-cloud': 'Cloud',
    'weather-fog': 'CloudFog',
    'weather-drizzle': 'CloudDrizzle',
    'weather-rain': 'CloudRain',
    'weather-snow': 'CloudSnow',
    'weather-storm': 'CloudLightning',
  };
  for (const [name, component] of Object.entries(uiIcons)) {
    await icon(name, createElement(lucide[component], { strokeWidth: 1.65 }));
  }
  await icon('heart-filled', createElement(lucide.Heart, { fill: '#fff', strokeWidth: 0 }));
  const { ConnectionIcon } = await tsImport(
    '../../src/components/connection-icon.tsx',
    import.meta.url,
  );
  for (const [name, title] of Object.entries({
    playstation: 'PlayStation 5',
    'apple-tv': 'Apple TV',
    usb: 'USB',
    hdmi: 'HDMI 1',
    console: 'Xbox',
    computer: 'PC',
    streamer: 'Roku',
  })) {
    await icon(
      `input-${name}`,
      createElement(ConnectionIcon, {
        input: { title, id: 'com.webos.app.hdmi1', port: 'HDMI 1', kind: name },
      }),
    );
  }
  await icon(
    'spotify',
    '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="white"/><g fill="none" stroke="#15271c" stroke-linecap="round"><path d="M11 18q15-6 27 2" stroke-width="4"/><path d="M13 25q13-5 23 2" stroke-width="3.5"/><path d="M15 32q10-4 18 1" stroke-width="3"/></g></svg>',
  );
  await icon(
    'kodi',
    '<svg viewBox="0 0 48 48"><g fill="white" transform="translate(24 24) rotate(45)"><rect x="-19" y="-19" width="15" height="15"/><rect x="4" y="-19" width="15" height="15"/><rect x="-19" y="4" width="15" height="15"/><rect x="4" y="4" width="15" height="15"/></g></svg>',
  );

  const manifest = path.join(sources, 'manifest.json');
  await fs.writeFile(manifest, JSON.stringify(assets));
  const result = spawnSync(
    'cargo',
    [
      'run',
      '--locked',
      '--release',
      '--manifest-path',
      path.join(root, 'native/tools/vector-assets/Cargo.toml'),
      '--',
      manifest,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        CARGO_TARGET_DIR: path.join(root, '.build/native/vector-assets-target'),
      },
      stdio: 'inherit',
      timeout: 120000,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Native SVG geometry compilation failed.');
  await fs.writeFile(
    path.join(out, 'vector-artwork.json'),
    JSON.stringify({
      version: 1,
      assets: assets.map((asset) => path.relative(out, asset.output)),
    }),
  );
  // These directories contain generated artwork only. Do not package stale raster
  // versions alongside the meshes when reusing an older native asset cache.
  for (const directory of ['logos', 'ui-icons']) {
    for (const file of await fs.readdir(path.join(out, directory))) {
      if (file.endsWith('.png')) await fs.rm(path.join(out, directory, file));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await generateVectorAssets();
}
