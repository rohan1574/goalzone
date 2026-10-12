const fs = require('fs');
const path = require('path');

const CACHE_DIR = process.env.CACHE_DIR
  ? path.resolve(process.env.CACHE_DIR)
  : path.join(__dirname, '../.cache');

const FILE_PATH = path.join(CACHE_DIR, 'subscribers.json');

// In-memory cache of subscriptions: { [topicName: string]: string[] }
let subscriptions = {};

function load() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf-8');
      subscriptions = JSON.parse(raw) || {};
    }
  } catch (err) {
    console.warn('[TokenManager] Failed to read subscribers file:', err.message);
    subscriptions = {};
  }
}

function save() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(subscriptions, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[TokenManager] Failed to write subscribers file:', err.message);
  }
}

// Initial load
load();

function addToken(token, topic = 'popular_matches') {
  if (!token) return;
  load();
  if (!subscriptions[topic]) subscriptions[topic] = [];
  if (!subscriptions[topic].includes(token)) {
    subscriptions[topic].push(token);
    save();
    console.log(`[TokenManager] Added device token to "${topic}". Total subscribers: ${subscriptions[topic].length}`);
  }
}

function removeToken(token, topic = 'popular_matches') {
  if (!token) return;
  load();
  if (subscriptions[topic]) {
    const prev = subscriptions[topic].length;
    subscriptions[topic] = subscriptions[topic].filter((t) => t !== token);
    if (subscriptions[topic].length !== prev) {
      save();
      console.log(`[TokenManager] Removed token from "${topic}". Remaining: ${subscriptions[topic].length}`);
    }
  }
}

function getTokens(topic = 'popular_matches') {
  load();
  return subscriptions[topic] || [];
}

function getTokensForMatch(matchId, isPopular) {
  load();
  const set = new Set();
  if (isPopular && Array.isArray(subscriptions['popular_matches'])) {
    subscriptions['popular_matches'].forEach((t) => set.add(t));
  }
  const matchTopic = `match_${matchId}`;
  if (Array.isArray(subscriptions[matchTopic])) {
    subscriptions[matchTopic].forEach((t) => set.add(t));
  }
  return Array.from(set);
}

function getAllTokens() {
  load();
  const set = new Set();
  Object.values(subscriptions).forEach((list) => {
    if (Array.isArray(list)) list.forEach((t) => set.add(t));
  });
  return Array.from(set);
}

function removeInvalidTokens(invalidTokens) {
  if (!Array.isArray(invalidTokens) || invalidTokens.length === 0) return;
  load();
  const invalidSet = new Set(invalidTokens);
  let changed = false;
  Object.keys(subscriptions).forEach((topic) => {
    if (Array.isArray(subscriptions[topic])) {
      const prev = subscriptions[topic].length;
      subscriptions[topic] = subscriptions[topic].filter((t) => !invalidSet.has(t));
      if (subscriptions[topic].length !== prev) changed = true;
    }
  });
  if (changed) save();
}

module.exports = {
  addToken,
  removeToken,
  getTokens,
  getTokensForMatch,
  getAllTokens,
  removeInvalidTokens,
};
