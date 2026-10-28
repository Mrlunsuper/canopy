/* Shared by extension pages and the classic service worker. No build required. */
(() => {
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const key = value => value?.id ?? value?.note?.id;

  // Apply only fields changed locally, preserving unrelated changes from other tabs.
  function merge(base, local, remote) {
    if (equal(base, local)) return clone(remote);
    if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)
        && [...base, ...local, ...remote].every(item => typeof key(item) === 'string')) {
      const before = new Map(base.map(item => [key(item), item]));
      const after = new Map(local.map(item => [key(item), item]));
      const result = remote.filter(item => !before.has(key(item)) || after.has(key(item)))
        .map(item => after.has(key(item))
          ? merge(before.get(key(item)), after.get(key(item)), item) : clone(item));
      for (const item of local) {
        if (!before.has(key(item)) && !result.some(entry => key(entry) === key(item))) result.push(clone(item));
      }
      // Preserve deliberate local reordering without dropping remote additions.
      if (!equal(base.map(key), local.map(key))) {
        const order = new Map(local.map((item, index) => [key(item), index]));
        result.sort((a, b) => (order.get(key(a)) ?? Infinity) - (order.get(key(b)) ?? Infinity));
      }
      return result;
    }
    if (object(local) && (object(base) || base === undefined) && object(remote)) {
      const result = clone(remote);
      for (const field of new Set([...Object.keys(base || {}), ...Object.keys(local)])) {
        if (equal(base?.[field], local[field])) continue;
        if (!(field in local)) delete result[field];
        else result[field] = merge(base?.[field], local[field], remote[field]);
      }
      return result;
    }
    return clone(local);
  }

  function chromeCall(method, ...args) {
    return new Promise((resolve, reject) => {
      chrome.storage.local[method](...args, result => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }

  async function locked(task) {
    if (!globalThis.navigator?.locks) throw new Error('Web Locks are required for safe storage updates');
    return navigator.locks.request('canopy-storage-write', task);
  }

  async function update(storageKey, base, local) {
    return locked(async () => {
      const values = await chromeCall('get', [storageKey]);
      const next = merge(base, local, values[storageKey] ?? base);
      await chromeCall('set', { [storageKey]: next });
      return next;
    });
  }

  globalThis.CanopyPersistence = { clone, merge, chromeCall, locked, update };
})();
