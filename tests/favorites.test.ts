import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveFavorite } from '../src/favorites.ts';

test('moving a favorite changes one visible position without mutating its saved source', () => {
  const ids = ['netflix', 'youtube', 'apple'];
  assert.deepEqual(moveFavorite(ids, 'netflix', 1, new Set(ids)), ['youtube', 'netflix', 'apple']);
  assert.deepEqual(ids, ['netflix', 'youtube', 'apple']);
});

test('hidden and unavailable slots survive moves between the visible favorites', () => {
  const ids = ['netflix', 'hidden', 'youtube', 'missing', 'apple'];
  const visible = new Set(['netflix', 'youtube', 'apple']);
  assert.deepEqual(moveFavorite(ids, 'youtube', -1, visible), [
    'youtube',
    'hidden',
    'netflix',
    'missing',
    'apple',
  ]);
  assert.equal(moveFavorite(ids, 'netflix', -1, visible), ids);
  assert.equal(moveFavorite(ids, 'apple', 1, visible), ids);
  assert.equal(moveFavorite(ids, 'not-saved', 1, visible), ids);
});
