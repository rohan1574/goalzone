const fs = require('fs');
const path = require('path');

const CACHE_DIR = process.env.CACHE_DIR
  ? path.resolve(process.env.CACHE_DIR)
  : path.join(__dirname, '../.cache');

const FILE_PATH = path.join(CACHE_DIR, 'subscribers.json');

// In-memory cache of subscriptions: { [topicName: string]: Set<string> }
let subscriptions = {};
let saveTimeout = null;

function load() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) || {};
      subscriptions = {};
      Object.keys(parsed).forEach((topic) => {
        subscriptions[topic] = new Set(Array.isArray(parsed[topic]) ? parsed[topic] : []);
      });
      return;
    }
  } catch (err) {
    console.warn('[TokenManager] Failed to read subscribers file:', err.message);
  }
  subscriptions = {};
}

function flushSave() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const serializable = {};
    Object.keys(subscriptions).forEach((topic) => {
      serializable[topic] = Array.from(subscriptions[topic]);
    });
    fs.writeFileSync(FILE_PATH, JSON.stringify(serializable), 'utf-8');
  } catch (err) {
    console.warn('[TokenManager] Failed to write subscribers file:', err.message);
  }
}

function scheduleSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    flushSave();
  }, 2000);
}

// Initial load
load();

function addToken(token, topic = 'popular_matches') {
  if (!token) return;
  if (!subscriptions[topic]) subscriptions[topic] = new Set();
  if (!subscriptions[topic].has(token)) {
    subscriptions[topic].add(token);
    scheduleSave();
    console.log(`[TokenManager] Added device token to "${topic}". Total subscribers: ${subscriptions[topic].size}`);
  }
}

function removeToken(token, topic = 'popular_matches') {
  if (!token) return;
  if (subscriptions[topic] && subscriptions[topic].has(token)) {
    subscriptions[topic].delete(token);
    scheduleSave();
    console.log(`[TokenManager] Removed token from "${topic}". Remaining: ${subscriptions[topic].size}`);
  }
}

function getTokens(topic = 'popular_matches') {
  return subscriptions[topic] ? Array.from(subscriptions[topic]) : [];
}

function getTokensForMatch(matchId, isPopular) {
  const set = new Set();
  if (isPopular && subscriptions['popular_matches']) {
    subscriptions['popular_matches'].forEach((t) => set.add(t));
  }
  const matchTopic = `match_${matchId}`;
  if (subscriptions[matchTopic]) {
    subscriptions[matchTopic].forEach((t) => set.add(t));
  }
  return Array.from(set);
}

function getAllTokens() {
  const set = new Set();
  Object.values(subscriptions).forEach((tokenSet) => {
    if (tokenSet instanceof Set) tokenSet.forEach((t) => set.add(t));
    else if (Array.isArray(tokenSet)) tokenSet.forEach((t) => set.add(t));
  });
  return Array.from(set);
}

function removeInvalidTokens(invalidTokens) {
  if (!Array.isArray(invalidTokens) || invalidTokens.length === 0) return;
  let changed = false;
  invalidTokens.forEach((badToken) => {
    Object.keys(subscriptions).forEach((topic) => {
      if (subscriptions[topic]?.delete(badToken)) {
        changed = true;
      }
    });
  });
  if (changed) scheduleSave();
}

module.exports = {
  addToken,
  removeToken,
  getTokens,
  getTokensForMatch,
  getAllTokens,
  removeInvalidTokens,
};
