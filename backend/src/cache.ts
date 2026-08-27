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

export const cache = {
  get: (key: string): any | null => {
    const filePath = getCacheFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const cacheItem = JSON.parse(fileContent);
      const now = Date.now();

      if (now > cacheItem.expireAt) {
        // Cache expired, delete the file asynchronously
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Error deleting expired cache file ${filePath}:`, err);
        });
        return null;
      }

      console.log(`[Cache HIT] Served data for key: ${key}`);
      return cacheItem.data;
    } catch (err) {
      console.error(`Error reading cache file ${filePath}:`, err);
      return null;
    }
  },

  set: (key: string, data: any, ttlSeconds: number): void => {
    const filePath = getCacheFilePath(key);
    const expireAt = Date.now() + ttlSeconds * 1000;
    const cacheItem = {
      expireAt,
      data
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(cacheItem, null, 2), 'utf-8');
      console.log(`[Cache SET] Saved key: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (err) {
      console.error(`Error writing cache file ${filePath}:`, err);
    }
  },

  clear: (key: string): void => {
    const filePath = getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Error clearing cache file ${filePath}:`, err);
      });
    }
  }
};
