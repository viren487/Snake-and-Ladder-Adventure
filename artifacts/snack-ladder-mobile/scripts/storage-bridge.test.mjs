import test from 'node:test';
import assert from 'node:assert/strict';
import { BRIDGE_TYPE, GAME_STORAGE_KEYS, StorageWriter, createMobileHtml, parseStorageChange }
  from '../lib/storage-bridge.ts';

test('storage messages may change only the game and recoverable room keys', () => {
  const item = { type: BRIDGE_TYPE, key: GAME_STORAGE_KEYS[0], value: '{"players":[]}' };
  assert.deepEqual(parseStorageChange(item), item);
  assert.equal(parseStorageChange({ ...item, key: 'settings' }), null);
  assert.equal(parseStorageChange({ ...item, value: { players: [] } }), null);
  assert.equal(parseStorageChange({ ...item, value: 'x'.repeat(2_000_001) }), null);
});

test('mobile HTML restores old rounds, persists current turns, and stays offline-safe', () => {
  const snapshot = { [GAME_STORAGE_KEYS[0]]: '{"players":[]}', [GAME_STORAGE_KEYS[5]]: '{"code":"ABC123"}' };
  const html = createMobileHtml('<head><!--SNACK_LADDER_MOBILE_BOOTSTRAP--></head>', snapshot, null);
  assert.match(html, /snack-ladder-adventure-v5/);
  assert.match(html, /snake-ladder-online-seat-v1/);
  assert.match(html, /"apiOrigin":null/);
  assert.match(html, /config\.apiOrigin/);
  assert.doesNotMatch(html, /API_TOKEN|API_KEY/);
  assert.match(createMobileHtml('<head><!--SNACK_LADDER_MOBILE_BOOTSTRAP--></head>', {}, 'https://api.example.com'),
    /"apiOrigin":"https:\/\/api\.example\.com"/);
  assert.throws(() => createMobileHtml('<head></head>', {}, null), /bootstrap/);
});

test('failed round writes survive and retry saves the latest game state', async () => {
  let fail = true;
  const saved = new Map();
  const store = {
    async setItem(key, value) {
      if (fail) { fail = false; throw new Error('simulated storage failure'); }
      saved.set(key, value);
    },
    async removeItem(key) { saved.delete(key); },
  };
  const writer = new StorageWriter(store);
  const change = (value) => ({ type: BRIDGE_TYPE, key: GAME_STORAGE_KEYS[0], value });
  await assert.rejects(writer.write(change('older')));
  await writer.write(change('newest'));
  assert.equal(saved.get(GAME_STORAGE_KEYS[0]), 'newest');
  await writer.write(change(null));
  assert.equal(saved.has(GAME_STORAGE_KEYS[0]), false);
});