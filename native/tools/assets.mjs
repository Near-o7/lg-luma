import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';
import { tsImport } from 'tsx/esm/api';

const root = path.resolve(import.meta.dirname, '../..');
const source = path.join(root, 'public');
const out = path.join(root, '.build/native/assets');
const highResolution = process.argv.includes('--4k');
for (const directory of [
  'wallpapers',
  'thumbnails',
  'logos',
  'app-icons',
  'ui-icons',
  'surfaces',
]) {
  await fs.mkdir(path.join(out, directory), { recursive: true });
}

// Decode the existing licensed font, rather than introducing a different font.
const font = path.join(out, 'font.woff2');
await fs.copyFile(path.join(source, 'fonts/inter-latin.woff2'), font);
const decoded = spawnSync('woff2_decompress', [font], { encoding: 'utf8' });
if (decoded.error || decoded.status !== 0) {
  throw new Error(
    'Font conversion needs woff2_decompress. Run: nix-shell -p woff2 --run "node native/tools/assets.mjs"',
    { cause: decoded.error ?? new Error(decoded.stderr) },
  );
}
await fs.rm(font);
const weights = spawnSync('python3', [path.join(import.meta.dirname, 'font-weights.py'), out], {
  encoding: 'utf8',
});
if (weights.error || weights.status !== 0) {
  throw new Error(
    'Font weights need Python/fontTools. Use nix-shell -p pkg-config SDL2 woff2 python3Packages.fonttools.',
    { cause: weights.error ?? new Error(weights.stderr) },
  );
}
await fs.copyFile(path.join(source, 'fonts/ofl.txt'), path.join(out, 'font-license.txt'));

for (const file of await fs.readdir(path.join(source, 'wallpapers'))) {
  if (!/\.(jpg|svg)$/.test(file)) continue;
  const id = path.parse(file).name;
  const input = path.join(source, 'wallpapers', file);
  for (const scale of highResolution ? [1, 2] : [1]) {
    const width = 1920 * scale;
    const height = 1080 * scale;
    // Match background-size:cover and each CSS background-position exactly.
    const photo = await sharp(input, { density: 72 * scale })
      .resize(width, height, { fit: 'outside' })
      .png()
      .toBuffer({ resolveWithObject: true });
    const position = id === 'dunes' || id === 'summit' ? 0.4 : id === 'san-francisco' ? 0.42 : 0.45;
    let image = sharp(photo.data).extract({
      left: Math.round((photo.info.width - width) / 2),
      top: Math.round((photo.info.height - height) * position),
      width,
      height,
    });
    const saturation =
      id === 'san-francisco'
        ? 0.75
        : id === 'summit'
          ? 0.7
          : ['forest', 'yosemite', 'northern-lights'].includes(id)
            ? 0.8
            : 1;
    const brightness = id === 'san-francisco' ? 0.82 : id === 'summit' ? 0.8 : 1;
    if (saturation !== 1) {
      const s = saturation;
      image = image.recomb([
        [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
      ]);
    }
    const data = await image.linear(brightness).png().toBuffer();
    const shaded = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1920 1080"><defs>
    <linearGradient id="v" x2="0" y2="1"><stop stop-color="#0d1013" stop-opacity=".24"/><stop offset=".19" stop-color="#0e1115" stop-opacity=".08"/><stop offset=".35" stop-color="#0f1114" stop-opacity=".35"/><stop offset=".63" stop-color="#111317" stop-opacity=".86"/><stop offset=".85" stop-color="#17191d" stop-opacity=".92157"/><stop offset="1" stop-color="#17191d" stop-opacity=".96078"/></linearGradient>
    <linearGradient id="h"><stop stop-color="#111417" stop-opacity=".42"/><stop offset=".75" stop-color="#111417" stop-opacity="0"/></linearGradient></defs>
    <path fill="#17191c" d="M0 0h1920v1080H0z"/><image href="data:image/png;base64,${data.toString('base64')}" width="1920" height="1080" opacity=".92"/><path fill="url(#h)" d="M0 0h1920v1080H0z"/><path fill="url(#v)" d="M0 0h1920v1080H0z"/></svg>`;
    // This generated SVG embeds a trusted bundled photograph; its data URL can
    // exceed libxml's default 10 MiB attribute limit at 4K.
    await sharp(Buffer.from(shaded), { unlimited: true })
      .jpeg({ quality: 96 })
      .toFile(path.join(out, 'wallpapers', `${id}${scale === 2 ? '@2x' : ''}.jpg`));
  }
  await sharp(input)
    .resize(480, 270, { fit: 'cover' })
    .jpeg({ quality: 82 })
    .toFile(path.join(out, 'thumbnails', `${id}.jpg`));
}
for (const file of await fs.readdir(path.join(source, 'logos'))) {
  if (!file.endsWith('.svg')) continue;
  const name = path.parse(file).name;
  const { data, info } = await sharp(path.join(source, 'logos', file), { density: 192 })
    .resize({ width: 720, height: 360, fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Match the white-logo CSS treatment while preserving the SVG's alpha channel.
  if (['apple-tv', 'disney-plus', 'prime-video', 'das-erste'].includes(name)) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
  await sharp(data, { raw: info })
    .png()
    .toFile(path.join(out, 'logos', `${name}.png`));
}
const icons = {};
const map = JSON.parse(await fs.readFile(path.join(root, 'src/app-icons.json'), 'utf8'));
for (const [id, relative] of Object.entries(map)) {
  const clean = relative.replace(/^\.\//, '');
  if (!/^app-icons\/[a-zA-Z0-9._-]+\.(png|jpg)$/.test(clean)) continue;
  try {
    await fs.copyFile(path.join(source, clean), path.join(out, clean));
    icons[id] = clean;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
await fs.writeFile(path.join(out, 'icons.json'), `${JSON.stringify(icons, null, 2)}\n`);
const colors = {};
const css = await fs.readFile(path.join(root, 'src/icon-colours.css'), 'utf8');
for (const match of css.matchAll(
  /data-app-id='([^']+)'[^}]+background: rgb\((\d+), (\d+), (\d+)\)/g,
)) {
  colors[match[1]] = match.slice(2).map(Number);
}
await fs.writeFile(path.join(out, 'colors.json'), JSON.stringify(colors));
await fs.writeFile(
  path.join(out, 'version.txt'),
  JSON.parse(await fs.readFile(path.join(root, 'appinfo.json'), 'utf8')).version,
);

// Reuse the actual web icon components. This is build-time SVG rasterization;
// the native application has no React/JavaScript runtime.
const { ConnectionIcon } = await tsImport(
  '../../src/components/connection-icon.tsx',
  import.meta.url,
);
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
};
async function rasterIcon(name, element) {
  let svg = renderToStaticMarkup(element);
  svg = svg.replace(
    /<svg[^>]*>/,
    (tag) =>
      `${tag.replace(/\s(?:width|height|color|xmlns)="[^"]*"/g, '').slice(0, -1)} xmlns="http://www.w3.org/2000/svg" width="128" height="128" color="#fff">`,
  );
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(out, 'ui-icons', `${name}.png`));
}
for (const [name, component] of Object.entries(uiIcons)) {
  await rasterIcon(name, createElement(lucide[component], { strokeWidth: 1.65 }));
}
await rasterIcon('heart-filled', createElement(lucide.Heart, { fill: '#fff', strokeWidth: 0 }));
for (const [name, title] of Object.entries({
  playstation: 'PlayStation 5',
  'apple-tv': 'Apple TV',
  usb: 'USB',
  hdmi: 'HDMI 1',
  console: 'Xbox',
  computer: 'PC',
  streamer: 'Roku',
})) {
  await rasterIcon(
    `input-${name}`,
    createElement(ConnectionIcon, {
      input: { title, id: 'com.webos.app.hdmi1', port: 'HDMI 1', kind: name },
    }),
  );
}
const surfaces = {
  generic: ['#4e5c6b', '#243c4e'],
  netflix: ['#141414', '#141414'],
  youtube: ['#0f0f0f', '#0f0f0f'],
  'apple-tv': ['#252525', '#080808'],
  'disney-plus': ['#0b244c', '#091936'],
  'prime-video': ['#0786bd', '#005ba7'],
  arte: ['#242323', '#121212'],
  zdf: ['#121b22', '#121b22'],
  'das-erste': ['#064c84', '#00254e'],
  plex: ['#343434', '#232323'],
  spotify: ['#192d23', '#101a16'],
  jellyfin: ['#25283f', '#101422'],
  homebrew: ['#7c6042', '#3f392d'],
  kodi: ['#0a749b', '#08445e'],
  moonlight: ['#435d8f', '#252e59'],
  gaming: ['#435d8f', '#252e59'],
  browser: ['#648890', '#2e525b'],
};
for (const [brand, [top, bottom]] of Object.entries(surfaces)) {
  const fill =
    brand === 'disney-plus'
      ? '<radialGradient id="base" cx="50%" cy="110%" r="110%"><stop stop-color="#16466b"/><stop offset=".6" stop-color="#0b244c"/><stop offset="1" stop-color="#091936"/></radialGradient>'
      : `<linearGradient id="base" x2="1" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="309"><defs>${fill}<linearGradient id="sheen" x2="1" y2="1"><stop stop-color="white" stop-opacity=".04"/><stop offset=".48" stop-color="white" stop-opacity="0"/></linearGradient></defs><path fill="url(#base)" d="M0 0h540v309H0z"/><path fill="url(#sheen)" d="M0 0h540v309H0z"/></svg>`,
    ),
  )
    .png()
    .toFile(path.join(out, 'surfaces', `${brand}.png`));
}
await sharp(
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="white"/><g fill="none" stroke="#15271c" stroke-linecap="round"><path d="M11 18q15-6 27 2" stroke-width="4"/><path d="M13 25q13-5 23 2" stroke-width="3.5"/><path d="M15 32q10-4 18 1" stroke-width="3"/></g></svg>',
  ),
)
  .png()
  .toFile(path.join(out, 'ui-icons/spotify.png'));
await sharp(
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 48 48"><g fill="white" transform="translate(24 24) rotate(45)"><rect x="-19" y="-19" width="15" height="15"/><rect x="4" y="-19" width="15" height="15"/><rect x="-19" y="4" width="15" height="15"/><rect x="4" y="4" width="15" height="15"/></g></svg>',
  ),
)
  .png()
  .toFile(path.join(out, 'ui-icons/kodi.png'));
await sharp(path.join(source, 'app-icon.svg'))
  .resize(130, 130)
  .png()
  .toFile(path.join(out, 'app-icon.png'));
console.log(`Native artwork ready: ${path.relative(root, out)}`);
