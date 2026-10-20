// One-time asset preparation. Downloads are build-time only, never TV runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const assets = [
  [
    'public/wallpapers/dunes.jpg',
    'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/wallpapers/summit.jpg',
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/wallpapers/san-francisco.jpg',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/wallpapers/forest.jpg',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/wallpapers/yosemite.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Tunnel_View%2C_Yosemite_Valley%2C_Yosemite_NP_-_Diliff.jpg/3840px-Tunnel_View%2C_Yosemite_Valley%2C_Yosemite_NP_-_Diliff.jpg',
  ],
  [
    'public/wallpapers/northern-lights.jpg',
    'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/fonts/inter-latin.woff2',
    'https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@latest/latin-wght-normal.woff2',
  ],
  ['public/fonts/ofl.txt', 'https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt'],
  [
    'public/logos/apple-tv.svg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f7/Apple_TV_logo.svg',
  ],
  [
    'public/logos/prime-video.svg',
    'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
  ],
  [
    'public/logos/disney-plus.svg',
    'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
  ],
  [
    'public/logos/jellyfin.svg',
    'https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/SVG/banner-dark.svg',
  ],
  [
    'public/logos/netflix.svg',
    'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
  ],
  [
    'public/logos/youtube.svg',
    'https://upload.wikimedia.org/wikipedia/commons/2/20/YouTube_2024.svg',
  ],
  [
    'public/logos/arte.svg',
    'https://upload.wikimedia.org/wikipedia/commons/e/ee/Arte_Logo_2026.svg',
  ],
  ['public/logos/zdf.svg', 'https://upload.wikimedia.org/wikipedia/commons/c/c1/ZDF_logo.svg'],
  [
    'public/logos/das-erste.svg',
    'https://upload.wikimedia.org/wikipedia/commons/c/ca/Das_Erste_2014.svg',
  ],
];
for (const [relative, url] of assets) {
  const destination = path.join(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.access(destination);
    console.log(`Already bundled: ${relative}`);
    continue;
  } catch {}
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100) throw new Error(`Unexpectedly small asset: ${relative}`);
  if (relative.endsWith('.svg') && !bytes.toString('utf8').includes('<svg'))
    throw new Error(`Not an SVG asset: ${relative}`);
  let prepared = bytes;
  if (relative === 'public/logos/youtube.svg') {
    const original = bytes.toString('utf8');
    const whiteWordmark = original.replace('id="g2362"', 'id="g2362" fill="#ffffff"');
    if (whiteWordmark === original) throw new Error('YouTube wordmark group was not found.');
    prepared = Buffer.from(whiteWordmark);
  }
  const output = relative.endsWith('.jpg')
    ? await sharp(prepared)
        .rotate()
        .resize({ width: 2560, withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer()
    : prepared;
  await fs.writeFile(destination, output);
  console.log(`Bundled ${relative} (${output.length} bytes)`);
}

const thumbnails = path.join(root, 'public/wallpaper-thumbnails');
await fs.mkdir(thumbnails, { recursive: true });
for (const [relative] of assets) {
  if (!relative.endsWith('.jpg')) continue;
  await sharp(path.join(root, relative))
    .resize(480, 270, { fit: 'cover' })
    .jpeg({ quality: 78 })
    .toFile(path.join(thumbnails, path.basename(relative)));
  console.log(`Prepared thumbnail: ${path.basename(relative)}`);
}
