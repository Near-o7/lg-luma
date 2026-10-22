import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareWebosRuntime, verifyWebosSdl } from './webos-runtime.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const highResolution = process.argv.includes('--4k');
const version = JSON.parse(await fs.readFile(path.join(root, 'appinfo.json'), 'utf8')).version;
const binary = path.join(root, 'native/target/armv7-unknown-linux-gnueabi/release/luma-native');
const bytes = await fs.readFile(binary);
if (
  bytes.length < 52 ||
  bytes.subarray(0, 4).toString('hex') !== '7f454c46' ||
  bytes[4] !== 1 ||
  bytes[5] !== 1 ||
  bytes.readUInt16LE(18) !== 40 ||
  (bytes.readUInt32LE(36) & 0x400) !== 0
) {
  throw new Error(
    'Packaging requires a 32-bit little-endian ARM soft-float ELF from build-webos.sh.',
  );
}
const out = path.join(root, '.build/native');
let vectorManifest;
try {
  vectorManifest = JSON.parse(
    await fs.readFile(path.join(out, 'assets/vector-artwork.json'), 'utf8'),
  );
} catch (error) {
  throw new Error('Prepare vector artwork with pnpm native:vector-assets before packaging.', {
    cause: error,
  });
}
if (
  vectorManifest.version !== 1 ||
  !Array.isArray(vectorManifest.assets) ||
  vectorManifest.assets.length === 0
) {
  throw new Error('Invalid native vector artwork manifest. Regenerate native assets.');
}
for (const file of vectorManifest.assets) {
  if (typeof file !== 'string' || !/^(logos|ui-icons)\/[a-z0-9-]+\.lvec$/.test(file)) {
    throw new Error('Invalid native vector artwork path.');
  }
  const mesh = await fs.readFile(path.join(out, 'assets', file));
  if (
    mesh.length < 20 ||
    mesh.subarray(0, 8).toString() !== 'LUMAVEC1' ||
    mesh.readUInt32LE(16) === 0 ||
    mesh.readUInt32LE(16) % 3 !== 0 ||
    mesh.length !== 20 + mesh.readUInt32LE(16) * 36
  ) {
    throw new Error(`Invalid native vector geometry: ${file}`);
  }
}
const stage = path.join(out, 'package');
await fs.rm(stage, { recursive: true, force: true });
await fs.mkdir(stage, { recursive: true });
await fs.mkdir(path.join(out, 'dist'), { recursive: true });
await fs.copyFile(binary, path.join(stage, 'luma-native'));
await fs.chmod(path.join(stage, 'luma-native'), 0o755);
await fs.cp(path.join(out, 'assets'), path.join(stage, 'assets'), {
  recursive: true,
  filter: (source) =>
    path.basename(source) !== '.DS_Store' &&
    (highResolution || !source.endsWith('@2x.jpg')) &&
    !(
      source.endsWith('.png') && ['logos', 'ui-icons'].includes(path.basename(path.dirname(source)))
    ),
});
await fs.copyFile(path.join(out, 'assets/app-icon.png'), path.join(stage, 'app-icon.png'));
await fs.copyFile(path.join(root, 'license'), path.join(stage, 'LICENSE'));
await fs.copyFile(path.join(root, 'assets.md'), path.join(stage, 'ASSETS.md'));
await fs.mkdir(path.join(stage, 'lib'));
async function copyLibrary(directory, name) {
  const library = await fs.readFile(path.join(directory, name));
  if (
    library.length < 52 ||
    library.subarray(0, 4).toString('hex') !== '7f454c46' ||
    library[4] !== 1 ||
    library[5] !== 1 ||
    library.readUInt16LE(18) !== 40 ||
    (library.readUInt32LE(36) & 0x400) !== 0
  ) {
    throw new Error(`Not an ARM soft-float webOS library: ${name}`);
  }
  if (/^libSDL2(?:-2\.0)?\.so(?:\.[0-9]+)*$/.test(name)) verifyWebosSdl(library);
  await fs.writeFile(path.join(stage, 'lib', name), library);
}
// Explicitly selected ARM libraries can override the pinned SDL-webOS runtime.
if (process.env.WEBOS_NATIVE_LIBS) {
  const directory = path.resolve(process.env.WEBOS_NATIVE_LIBS);
  for (const name of await fs.readdir(directory)) {
    if (!/\.so(?:\.[0-9]+)*$/.test(name)) continue;
    await copyLibrary(directory, name);
  }
}
const sdlName = 'libSDL2-2.0.so.0';
if (!(await fs.readdir(path.join(stage, 'lib'))).includes(sdlName)) {
  const runtime = await prepareWebosRuntime();
  await copyLibrary(path.join(runtime, 'lib'), sdlName);
}
await fs.mkdir(path.join(stage, 'licenses'));
await fs.copyFile(
  path.join(root, 'native/assets/licenses/sdl2.txt'),
  path.join(stage, 'licenses/sdl2.txt'),
);
await fs.writeFile(
  path.join(stage, 'appinfo.json'),
  `${JSON.stringify(
    {
      id: 'com.luma.launcher.native',
      version,
      vendor: 'Luma',
      type: 'native',
      main: 'luma-native',
      title: 'Luma Native',
      icon: 'app-icon.png',
      appDescription: 'Experimental Rust/SDL2 launcher.',
      resolution: '1920x1080',
      requiredACG: ['application.launcher', 'application.query', 'lunabus.query'],
    },
    null,
    2,
  )}\n`,
);
const state = path.join(out, 'cli-state');
await fs.mkdir(state, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules/@webos-tools/cli/bin/ares-package.js'),
    '--no-minify',
    '--outdir',
    path.join(out, 'dist'),
    stage,
  ],
  { cwd: root, env: { ...process.env, APPDATA: state }, stdio: 'inherit', timeout: 120000 },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
