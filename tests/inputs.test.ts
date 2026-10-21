import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visibleInputs } from '../src/inputs.ts';
import { parsePreferences } from '../src/storage.ts';
import type { TVInput } from '../src/types.ts';

const inputs: TVInput[] = [
  { id: 'com.webos.app.hdmi1', title: 'Console', port: 'HDMI 1', kind: 'console', connected: true },
  {
    id: 'com.webos.app.hdmi2',
    title: 'Streamer',
    port: 'HDMI 2',
    kind: 'streamer',
    connected: false,
  },
  { id: 'com.webos.app.hdmi3', title: 'HDMI 3', port: 'HDMI 3', kind: 'hdmi', connected: null },
  {
    id: 'com.webos.app.hdmi4',
    title: 'Computer',
    port: 'HDMI 4',
    kind: 'computer',
    connected: true,
  },
];

test('inputs default to Auto and require a confirmed connection', () => {
  const preferences = parsePreferences('{"version":1,"favorites":[]}');
  assert.deepEqual(preferences.inputVisibility, {});
  assert.deepEqual(
    visibleInputs(inputs, preferences.inputVisibility).map((input) => input.port),
    ['HDMI 1', 'HDMI 4'],
  );
  assert.deepEqual(preferences.favorites, []);
});

test('On includes disconnected and unknown inputs, Off excludes connected inputs, and Auto follows refreshes', () => {
  const visibility = {
    'com.webos.app.hdmi1': 'off',
    'com.webos.app.hdmi2': 'on',
    'com.webos.app.hdmi3': 'on',
    'com.webos.app.hdmi4': 'auto',
  } as const;
  assert.deepEqual(
    visibleInputs(inputs, visibility).map((input) => input.port),
    ['HDMI 2', 'HDMI 3', 'HDMI 4'],
  );
  const refreshed = inputs.map((input) => ({
    ...input,
    title: 'Renamed',
    connected: !input.connected,
  }));
  assert.deepEqual(
    visibleInputs(refreshed, visibility).map((input) => input.port),
    ['HDMI 2', 'HDMI 3'],
  );
  assert.equal(inputs[0].title, 'Console');
});

test('all enabled physical inputs are retained in inventory order', () => {
  const visibility = Object.fromEntries(inputs.map((input) => [input.id, 'on' as const]));
  assert.deepEqual(visibleInputs(inputs, visibility), inputs);
});

test('saved input modes are validated without losing choices for temporarily missing inputs', () => {
  const preferences = parsePreferences(
    JSON.stringify({
      version: 1,
      inputVisibility: {
        'com.webos.app.hdmi1': 'on',
        'com.webos.app.hdmi2': 'off',
        'com.webos.app.hdmi3': 'auto',
        'com.webos.app.hdmi9': 'on',
        'com.webos.app.hdmi4': true,
        'com.webos.app.hdmi5': 'sometimes',
        'bad;id': 'on',
      },
    }),
  );
  assert.deepEqual(preferences.inputVisibility, {
    'com.webos.app.hdmi1': 'on',
    'com.webos.app.hdmi2': 'off',
    'com.webos.app.hdmi3': 'auto',
    'com.webos.app.hdmi9': 'on',
  });
  for (const inputVisibility of [null, [], 'on', 1]) {
    assert.deepEqual(
      parsePreferences(JSON.stringify({ version: 1, inputVisibility })).inputVisibility,
      {},
    );
  }
});
