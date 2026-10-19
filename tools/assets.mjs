// One-time asset preparation. Downloads are build-time only, never TV runtime.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const assets = [
  [
    'public/wallpapers/dunes.jpg',
    'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/wallpapers/alpine.jpg',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/wallpapers/san-francisco.jpg',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/wallpapers/munich.jpg',
    'https://images.unsplash.com/photo-1595867818082-083862f3d630?auto=format&fit=crop&w=2560&q=88',
  ],
  [
    'public/wallpapers/tokyo.jpg',
    'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?auto=format&fit=crop&w=2560&q=88',
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
  await fs.writeFile(destination, bytes);
  console.log(`Bundled ${relative} (${bytes.length} bytes)`);
}
