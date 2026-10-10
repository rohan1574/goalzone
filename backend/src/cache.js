const fs = require('fs');
const path = require('path');

const CACHE_DIR = process.env.CACHE_DIR
  ? path.resolve(process.env.CACHE_DIR)
  : path.join(__dirname, '../.cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const getCacheFilePath = (key) => {
  const safeKey = key.replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(CACHE_DIR, `${safeKey}.json`);
};

// How often a worker re-checks the disk file for writes made by another PM2 worker
// (the sync engine only runs in one process, so other workers must notice its updates).
const REVALIDATE_MS = 2000;

// Stale entries are kept on disk (served when the API is unavailable or out of quota)
// and only pruned once they have been expired for this long.
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// In-memory cache layer for instant sub-millisecond retrieval
// key -> { item: { expireAt, updatedAt, data }, mtimeMs, checkedAt }
const inMemoryCache = new Map();

function readFromDisk(key) {
  const filePath = getCacheFilePath(key);
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    const pending = inMemoryCache.get(key);
    if (pending && pending.mtimeMs === null) return pending.item;
    inMemoryCache.delete(key);
    return null;
  }

  const mem = inMemoryCache.get(key);
  // mtimeMs === null means this process has a write in flight; its memory copy is newest
  if (mem && (mem.mtimeMs === null || mem.mtimeMs === stat.mtimeMs)) {
    mem.checkedAt = Date.now();
    return mem.item;
  }

  try {
    const item = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    inMemoryCache.set(key, { item, mtimeMs: stat.mtimeMs, checkedAt: Date.now() });
    return item;
  } catch (err) {
    console.error(`Error reading cache file ${filePath}:`, err.message);
    return mem ? mem.item : null;
  }
}

function getItem(key) {
  const mem = inMemoryCache.get(key);
  if (mem && Date.now() - mem.checkedAt < REVALIDATE_MS) {
    return mem.item;
  }
  return readFromDisk(key);
}

function writeItem(key, item) {
  inMemoryCache.set(key, { item, mtimeMs: null, checkedAt: Date.now() });

  // Write to a temp file and rename so other workers never read a half-written file
  const filePath = getCacheFilePath(key);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFile(tmpPath, JSON.stringify(item), 'utf-8', (err) => {
    if (err) {
      console.error(`Error writing cache file ${filePath}:`, err);
      const mem = inMemoryCache.get(key);
      if (mem && mem.item === item) mem.mtimeMs = -1; // fall back to disk on next check
      return;
    }
    fs.rename(tmpPath, filePath, (renameErr) => {
      if (renameErr) {
        console.error(`Error renaming cache file ${filePath}:`, renameErr);
        return;
      }
      fs.stat(filePath, (statErr, stat) => {
        const mem = inMemoryCache.get(key);
        if (!statErr && mem && mem.item === item) mem.mtimeMs = stat.mtimeMs;
      });
    });
  });
}

const cache = {
  // Returns data only while it is fresh (unchanged behaviour for existing callers)
  get: (key) => {
    const item = getItem(key);
    if (!item || Date.now() > item.expireAt) return null;
    return item.data;
  },

  // Returns the entry even when expired: { data, expireAt, updatedAt, stale }
  getEntry: (key) => {
    const item = getItem(key);
    if (!item) return null;
    return {
      data: item.data,
      expireAt: item.expireAt,
      updatedAt: item.updatedAt || null,
      stale: Date.now() > item.expireAt,
    };
  },

  set: (key, data, ttlSeconds) => {
    const now = Date.now();
    writeItem(key, { expireAt: now + ttlSeconds * 1000, updatedAt: now, data });
    console.log(`[Cache SET Memory+Disk] Saved key: ${key} (TTL: ${ttlSeconds}s)`);
  },

  // Patches data in place without extending its expiry or its updatedAt (which records the
  // last full fetch from the API). Used to overlay live scores onto cached fixture lists.
  update: (key, updater) => {
    const item = getItem(key);
    if (!item) return false;
    const nextData = updater(item.data);
    if (nextData === undefined || nextData === item.data) return false;
    writeItem(key, { expireAt: item.expireAt, updatedAt: item.updatedAt, data: nextData });
    return true;
  },

  clear: (key) => {
    inMemoryCache.delete(key);
    const filePath = getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Error clearing cache file ${filePath}:`, err);
      });
    }
  },

  // Deletes entries that have been expired for a long time. Files starting with "_" hold
  // internal state (quota, sync status) and are never pruned.
  prune: () => {
    const cutoff = Date.now() - PRUNE_AFTER_MS;
    let removed = 0;
    for (const file of fs.readdirSync(CACHE_DIR)) {
      if (!file.endsWith('.json') || file.startsWith('_')) continue;
      const filePath = path.join(CACHE_DIR, file);
      try {
        const item = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (item.expireAt < cutoff) {
          fs.unlinkSync(filePath);
          inMemoryCache.delete(file.slice(0, -5));
          removed++;
        }
      } catch (err) {
        // Unreadable leftovers are not worth keeping
        try { fs.unlinkSync(filePath); removed++; } catch (e) {}
      }
    }
    return removed;
  },
};

module.exports = { cache, CACHE_DIR };
