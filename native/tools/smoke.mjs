import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, '.build/native');
await fs.mkdir(out, { recursive: true });
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', timeout: 120000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed`);
};
run('cargo', ['build', '--locked', '--manifest-path', 'native/Cargo.toml']);
const binary = path.resolve(
  root,
  process.env.CARGO_TARGET_DIR ?? 'native/target',
  'debug/luma-native',
);
const temporary = await fs.mkdtemp(path.join(out, 'smoke-'));
try {
  const preferences = path.join(temporary, 'preferences.json');
  const scenario = async (name, script) => {
    const screenshot = path.join(out, `${name}.png`);
    const dump = path.join(temporary, `${name}.json`);
    run(binary, [
      '--preferences',
      preferences,
      '--script',
      script,
      '--frames',
      '90',
      '--screenshot',
      screenshot,
      '--dump-state',
      dump,
    ]);
    const state = JSON.parse(await fs.readFile(dump, 'utf8'));
    assert.equal(state.error, null);
    const stats = await sharp(screenshot).stats();
    assert.equal(
      stats.channels[3].min,
      255,
      'UI compositing must preserve opaque framebuffer alpha',
    );
    assert.ok(
      stats.channels.slice(0, 3).some((channel) => channel.stdev > 10),
      'Framebuffer must contain rendered UI',
    );
    return state;
  };
  const home = await scenario('home', 'down');
  assert.deepEqual(home.focus, { App: 'netflix' });
  const hidden = await scenario('apps', 'apps,down,menu,down,enter');
  assert.ok(hidden.preferences.hidden.includes('netflix'));
  assert.deepEqual(hidden.focus, { App: 'youtube.leanback.v4' });
  // Reload from disk, find Netflix in Hidden, and restore it.
  const restored = await scenario(
    'restored',
    'apps,down,up,right,right,right,right,enter,down,menu,down,enter',
  );
  assert.deepEqual(restored.preferences.hidden, []);
  const searched = await scenario('search', 'apps,type:YouTube,back');
  assert.equal(searched.query, 'YouTube');
  assert.deepEqual(searched.apps, ['youtube.leanback.v4']);
  const settings = await scenario('settings', 'settings,down,down,enter,down,enter');
  assert.equal(settings.preferences.background, 'forest');
  const saved = await scenario('saved', 'down,hold,right,back');
  assert.equal(saved.preferences.background, 'forest');
  assert.deepEqual(saved.preferences.favorites.slice(0, 2), ['youtube.leanback.v4', 'netflix']);
  const clock = await scenario('clock', 'settings,click:900:284');
  assert.equal(clock.subpage, 'Clock');
  const input = await scenario('inputs', 'settings,down,down,down,enter,enter,up,enter');
  assert.equal(input.preferences.input_modes['com.webos.app.hdmi1'], 'Off');
  assert.equal(input.subpage, null);
  const closed = await scenario('dialog-closed', 'apps,down,menu,click:100:900');
  assert.equal(closed.modal, false);
  assert.deepEqual(closed.focus, { App: 'youtube.leanback.v4' });
  console.log(
    'Native smoke checks passed: rendering/alpha, navigation, hide/restore, search, backgrounds, reorder, nested settings, SDL pointer input and persistence.',
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
