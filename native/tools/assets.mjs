import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const source = path.join(root, 'public');
const out = path.join(root, '.build/native/assets');
for (const directory of ['wallpapers', 'thumbnails', 'logos', 'app-icons']) {
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
await fs.copyFile(path.join(source, 'fonts/ofl.txt'), path.join(out, 'font-license.txt'));

for (const file of await fs.readdir(path.join(source, 'wallpapers'))) {
  if (!/\.(jpg|svg)$/.test(file)) continue;
  const id = path.parse(file).name;
  const input = path.join(source, 'wallpapers', file);
  await sharp(input)
    .resize(1920, 1080, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toFile(path.join(out, 'wallpapers', `${id}.jpg`));
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
await sharp(path.join(source, 'app-icon.svg'))
  .resize(130, 130)
  .png()
  .toFile(path.join(out, 'app-icon.png'));
console.log(`Native artwork ready: ${path.relative(root, out)}`);
