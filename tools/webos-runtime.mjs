// SDL in the NDK is for linking, not TV display: its Wayland backend is disabled.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, '.build/sdl-webos');
const release = 'release-2.30.12-webos.5';
const filename = 'SDL2-2.30.12-webos.tar.gz';
const archiveHash = '4ad566453d113bdd9ee96878176b97d28d9fa70503a62d83d55a351545abb334';
const libraryHash = 'f564f7da624cec47168300d017f3ec822f41b5096f0ce1c96873eecd8614d446';
const sourceHash = '9c98be8f216721a01e1c23bfa55b70529aabfb2c999d2a1bd84f60632604dc91';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function verifyWebosSdl(bytes) {
  if (
    bytes.length < 52 ||
    bytes.subarray(0, 4).toString('hex') !== '7f454c46' ||
    bytes[4] !== 1 ||
    bytes[5] !== 1 ||
    bytes.readUInt16LE(18) !== 40 ||
    bytes.readUInt16LE(16) !== 3 ||
    (bytes.readUInt32LE(36) & 0x400) !== 0
  ) {
    throw new Error('SDL runtime must be an ARM soft-float shared library.');
  }
  // These are compiled backend strings, not merely exported SDL_webOS API stubs.
  if (
    !bytes.includes(Buffer.from('SDL Wayland video driver\0')) ||
    !bytes.includes(Buffer.from('APPID environment variable is not set\0'))
  ) {
    throw new Error('SDL has no webOS Wayland video backend. Do not package the SDK stub SDL.');
  }
}

export async function prepareWebosRuntime() {
  await fs.mkdir(directory, { recursive: true });
  const archive = path.join(directory, filename);
  let bytes;
  try {
    bytes = await fs.readFile(archive);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log(`Downloading SDL-webOS ${release} (standard SDL ABI).`);
    const url = `https://github.com/webosbrew/SDL-webOS/releases/download/${release}/${filename}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`SDL-webOS download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== archiveHash) throw new Error('SDL-webOS archive checksum mismatch.');
    await fs.writeFile(archive, bytes);
  }
  if (hash(bytes) !== archiveHash) throw new Error('SDL-webOS archive checksum mismatch.');

  const library = path.join(directory, 'lib/libSDL2-2.0.so.0');
  let current;
  try {
    current = await fs.readFile(library);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!current || hash(current) !== libraryHash) {
    const result = spawnSync('tar', ['-xzf', archive, '-C', directory], {
      stdio: 'inherit',
      timeout: 60000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('SDL-webOS extraction failed.');
    current = await fs.readFile(library);
  }
  if (hash(current) !== libraryHash) throw new Error('SDL-webOS library checksum mismatch.');
  verifyWebosSdl(current);

  // The pinned binary drops More (evdev 994) before SDL emits an event.
  // Build the same pinned SDL-webOS source with a narrow Wayland key patch.
  // Keep the verified upstream binary untouched for provenance and cache reuse.
  const patchedDirectory = path.join(directory, 'remote-keys');
  const patchedLibrary = path.join(patchedDirectory, 'lib/libSDL2-2.0.so.0');
  const patch = await fs.readFile(path.join(root, 'tools/sdl-remote-keys.patch'));
  const buildKey = hash(
    Buffer.concat([Buffer.from(sourceHash), patch, await fs.readFile(new URL(import.meta.url))]),
  );
  const stampPath = path.join(patchedDirectory, 'build.json');
  let patched;
  try {
    const stamp = JSON.parse(await fs.readFile(stampPath, 'utf8'));
    patched = await fs.readFile(patchedLibrary);
    if (stamp.key !== buildKey || stamp.sha256 !== hash(patched)) patched = undefined;
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  if (!patched) {
    const ndk = process.env.WEBOS_NDK;
    if (!ndk) throw new Error('Set WEBOS_NDK to build SDL-webOS remote key support.');
    const sourceArchive = path.join(directory, `source-${release}.tar.gz`);
    let sourceBytes;
    try {
      sourceBytes = await fs.readFile(sourceArchive);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const response = await fetch(
        `https://codeload.github.com/webosbrew/SDL-webOS/tar.gz/refs/tags/${release}`,
        { signal: AbortSignal.timeout(60000) },
      );
      if (!response.ok) throw new Error(`SDL-webOS source download failed: ${response.status}`);
      sourceBytes = Buffer.from(await response.arrayBuffer());
      if (hash(sourceBytes) !== sourceHash) throw new Error('SDL-webOS source checksum mismatch.');
      await fs.writeFile(sourceArchive, sourceBytes);
    }
    if (hash(sourceBytes) !== sourceHash) throw new Error('SDL-webOS source checksum mismatch.');
    const source = path.join(directory, `source-${buildKey}`);
    const sysroot = path.resolve(ndk, 'arm-webos-linux-gnueabi/sysroot');
    const run = (command, args, cwd = root) => {
      const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        timeout: 600000,
        env: {
          ...process.env,
          PKG_CONFIG_PATH: '',
          PKG_CONFIG_LIBDIR: `${sysroot}/usr/lib/pkgconfig:${sysroot}/usr/share/pkgconfig`,
          PKG_CONFIG_SYSROOT_DIR: sysroot,
        },
      });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${command} failed building SDL-webOS remote keys.`);
    };
    await fs.mkdir(source, { recursive: true });
    run('tar', ['-xzf', sourceArchive, '--strip-components=1', '-C', source]);
    run('patch', ['-p1', '--batch', '-i', path.join(root, 'tools/sdl-remote-keys.patch')], source);
    const build = path.join(source, 'build');
    run('cmake', [
      '-S',
      source,
      '-B',
      build,
      `-DCMAKE_TOOLCHAIN_FILE=${path.resolve(ndk, 'share/buildroot/toolchainfile.cmake')}`,
      `-DCMAKE_INSTALL_PREFIX=${patchedDirectory}`,
      '-DCMAKE_BUILD_TYPE=Release',
      '-DWEBOS=ON',
      '-DSDL_WEBOS_BROKEN_ABI=OFF',
      '-DSDL_OFFSCREEN=OFF',
      '-DSDL_DISKAUDIO=OFF',
      '-DSDL_DUMMYAUDIO=OFF',
      '-DSDL_DUMMYVIDEO=OFF',
      '-DSDL_KMSDRM=OFF',
    ]);
    run('cmake', ['--build', build, '--parallel', '4']);
    run('cmake', ['--install', build]);
    patched = await fs.readFile(patchedLibrary);
    verifyWebosSdl(patched);
    await fs.writeFile(
      stampPath,
      JSON.stringify({ key: buildKey, sha256: hash(patched), sourceSha256: sourceHash }),
    );
  }
  verifyWebosSdl(patched);

  // Upstream metadata embeds /usr/local and an rpath. Generate relocatable build-host
  // lookup metadata instead; the TV executable keeps only its $ORIGIN/lib rpath.
  const pkgconfig = path.join(directory, 'pkgconfig');
  await fs.mkdir(pkgconfig, { recursive: true });
  await fs.writeFile(
    path.join(pkgconfig, 'sdl2.pc'),
    `prefix=${patchedDirectory}
libdir=\${prefix}/lib
includedir=\${prefix}/include/SDL2
Name: sdl2
Description: SDL-webOS with the Wayland/webOS backend and standard SDL ABI
Version: 2.30.12
Libs: -L\${libdir} -lSDL2
Cflags: -I\${includedir} -D_REENTRANT
`,
  );
  console.log(
    `Verified SDL-webOS ${release}: ARM soft-float, Wayland/webOS backend, remote key patch.`,
  );
  return patchedDirectory;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await prepareWebosRuntime();
}
