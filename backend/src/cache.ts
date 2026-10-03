import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(__dirname, '../.cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const getCacheFilePath = (key: string): string => {
  // Replace characters not friendly for filenames (like slashes or colons) with underscores
  const safeKey = key.replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(CACHE_DIR, `${safeKey}.json`);
};

// In-memory cache layer for instant sub-millisecond retrieval
const inMemoryCache = new Map<string, { expireAt: number; data: any }>();

export const cache = {
  get: (key: string): any | null => {
    const now = Date.now();

    // 1. Fast in-memory check
    const memItem = inMemoryCache.get(key);
    if (memItem) {
      if (now <= memItem.expireAt) {
        console.log(`[Cache HIT Memory] Served data for key: ${key}`);
        return memItem.data;
      }
      inMemoryCache.delete(key);
    }

    // 2. Fallback to disk cache
    const filePath = getCacheFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const cacheItem = JSON.parse(fileContent);

      if (now > cacheItem.expireAt) {
        // Cache expired, delete the file asynchronously
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Error deleting expired cache file ${filePath}:`, err);
        });
        return null;
      }

      // Populate in-memory cache for subsequent instant calls
      inMemoryCache.set(key, cacheItem);
      console.log(`[Cache HIT Disk -> Mem] Served data for key: ${key}`);
      return cacheItem.data;
    } catch (err) {
      console.error(`Error reading cache file ${filePath}:`, err);
      return null;
    }
  },

  set: (key: string, data: any, ttlSeconds: number): void => {
    const expireAt = Date.now() + ttlSeconds * 1000;
    const cacheItem = {
      expireAt,
      data
    };

    // 1. Save to in-memory cache immediately
    inMemoryCache.set(key, cacheItem);

    // 2. Persist to disk asynchronously
    const filePath = getCacheFilePath(key);
    fs.writeFile(filePath, JSON.stringify(cacheItem), 'utf-8', (err) => {
      if (err) console.error(`Error writing cache file ${filePath}:`, err);
    });
    console.log(`[Cache SET Memory+Disk] Saved key: ${key} (TTL: ${ttlSeconds}s)`);
  },

  clear: (key: string): void => {
    inMemoryCache.delete(key);
    const filePath = getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Error clearing cache file ${filePath}:`, err);
      });
    }
  }
};
