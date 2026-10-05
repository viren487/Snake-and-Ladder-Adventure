export const GAME_STORAGE_KEYS = [
  'snack-ladder-adventure-v5', 'snack-ladder-adventure-v4',
  'snack-ladder-adventure-v3', 'snack-ladder-adventure-v2',
  'snack-ladder-adventure-v1', 'snake-ladder-online-seat-v1',
  'snake-ladder-online-pending-v1',
] as const;
export const BRIDGE_TYPE = 'snack-ladder-mobile-storage-v1';
export type StorageChange = { type: typeof BRIDGE_TYPE; key: string; value: string | null };
export type StorageSnapshot = Record<string, string | null>;

export function parseStorageChange(value: unknown): StorageChange | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<StorageChange>;
  if (item.type !== BRIDGE_TYPE || !GAME_STORAGE_KEYS.some((key) => key === item.key) ||
      (item.value !== null && typeof item.value !== 'string') ||
      (typeof item.value === 'string' && item.value.length > 2000000)) return null;
  return item as StorageChange;
}

interface NativeStore {
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// A failed write stays pending; Retry writes the newest value, never an older round.
export class StorageWriter {
  private pending = new Map<string, string | null>();
  private queue: Promise<void> = Promise.resolve();
  private store: NativeStore;
  constructor(store: NativeStore) { this.store = store; }
  write(change?: StorageChange): Promise<void> {
    if (change) this.pending.set(change.key, change.value);
    this.queue = this.queue.catch(() => undefined).then(async () => {
      for (const [key, value] of this.pending) {
        if (value === null) await this.store.removeItem(key);
        else await this.store.setItem(key, value);
        if (this.pending.get(key) === value) this.pending.delete(key);
      }
    });
    return this.queue;
  }
}

export function createMobileHtml(template: string, snapshot: StorageSnapshot, apiOrigin: string | null) {
  const config = JSON.stringify({ snapshot, apiOrigin, keys: GAME_STORAGE_KEYS, type: BRIDGE_TYPE })
    .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  const bootstrap = `<script>
    (function() {
      var config = ${config};
      window.__SNACK_LADDER_MOBILE__ = {apiOrigin: config.apiOrigin};
      var isOnlineKey = function(key) { return key === 'snake-ladder-online-seat-v1' ||
        key === 'snake-ladder-online-pending-v1'; };
      var notify = function(key, value) {
        if (restoring || config.keys.indexOf(key) < 0 || (!config.apiOrigin && isOnlineKey(key))) return;
        var change = {type: config.type, key: key, value: value};
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(change));
        else window.parent.postMessage(change, window.location.origin === 'null' ? '*' : window.location.origin);
      };
      var storage;
      try {
        storage = window.localStorage;
        storage.length;
        var probeKey = '__snack_ladder_mobile_storage_probe__';
        var previousProbe = storage.getItem(probeKey);
        storage.setItem(probeKey, '1');
        storage.removeItem(probeKey);
        if (previousProbe !== null) storage.setItem(probeKey, previousProbe);
      }
      catch { storage = null; }
      var memory = Object.create(null);
      if (!storage) {
        storage = {
          get length() { return Object.keys(memory).length; },
          clear: function() { Object.keys(memory).forEach(function(key) { delete memory[key]; notify(key, null); }); },
          getItem: function(key) { key = String(key); return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
          key: function(index) { return Object.keys(memory)[index] || null; },
          removeItem: function(key) { key = String(key); delete memory[key]; notify(key, null); },
          setItem: function(key, value) { key = String(key); value = String(value); memory[key] = value; notify(key, value); }
        };
        Object.defineProperty(window, 'localStorage', {configurable: true, value: storage});
      }
      var restoring = true;
      config.keys.forEach(function(key) {
        var value = config.snapshot[key];
        if (!config.apiOrigin && isOnlineKey(key)) value = null;
        if (typeof value === 'string') storage.setItem(key, value);
        else storage.removeItem(key);
      });
      restoring = false;
      if (storage === window.localStorage && typeof Storage !== 'undefined' && storage instanceof Storage) {
        var set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
        Storage.prototype.setItem = function(key, value) {
          set.call(this, key, value);
          if (this === storage) notify(String(key), String(value));
        };
        Storage.prototype.removeItem = function(key) {
          remove.call(this, key);
          if (this === storage) notify(String(key), null);
        };
      }
    })();
  </script>`;
  if (!template.includes('<!--SNACK_LADDER_MOBILE_BOOTSTRAP-->'))
    throw new Error('The shared game package is missing its storage bootstrap.');
  return template.replace('<!--SNACK_LADDER_MOBILE_BOOTSTRAP-->', bootstrap);
}