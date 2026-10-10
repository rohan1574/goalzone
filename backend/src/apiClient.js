const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { CACHE_DIR } = require('./cache');

// ==========================================
// SHARED API-FOOTBALL CLIENT + DAILY QUOTA GUARD
// ==========================================
/**
 * Every call to API-Football goes through apiGet() so the remaining daily quota is
 * known exactly (read from the x-ratelimit-requests-remaining response header) and
 * shared by all PM2 workers through a small state file.
 *
 * Each call has a tier. A tier may only spend quota while the remaining requests for
 * the day are above its floor, so live scores keep working long after user-triggered
 * cache misses have been cut off:
 *
 *   live     : remaining > QUOTA_FLOOR_LIVE      (default 100)
 *   sync     : remaining > QUOTA_FLOOR_SYNC      (default 800)
 *   ondemand : remaining > QUOTA_FLOOR_ONDEMAND  (default 1500)
 *
 * API-Football resets the daily counter at 00:00 UTC.
 */

const APISPORTS_URL = (
  process.env.APISPORTS_URL ||
  process.env.THIRD_PARTY_API_URL ||
  'https://v3.football.api-sports.io'
).replace(/\/+$/, '');
const APISPORTS_KEY =
  process.env.APISPORTS_KEY || process.env.THIRD_PARTY_API_KEY || '';

const DAILY_LIMIT = Number(process.env.API_DAILY_LIMIT) || 7500;
const TIER_FLOORS = {
  live: Number(process.env.QUOTA_FLOOR_LIVE) || 100,
  sync: Number(process.env.QUOTA_FLOOR_SYNC) || 800,
  ondemand: Number(process.env.QUOTA_FLOOR_ONDEMAND) || 1500,
};

const STATE_FILE = path.join(CACHE_DIR, '_quota_state.json');
const STATE_REFRESH_MS = 2000;

const http = axios.create({
  baseURL: APISPORTS_URL,
  timeout: 15000,
  headers: {
    'x-apisports-key': APISPORTS_KEY,
    Accept: 'application/json',
  },
});

class QuotaError extends Error {
  constructor(tier, remaining) {
    super(`Quota floor reached for tier "${tier}" (remaining: ${remaining})`);
    this.name = 'QuotaError';
    this.isQuotaError = true;
  }
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function freshState() {
  return {
    day: utcDay(),
    limit: DAILY_LIMIT,
    remaining: DAILY_LIMIT,
    exhausted: false,
    pausedUntil: 0,
    calls: { live: 0, sync: 0, ondemand: 0 },
    denied: { live: 0, sync: 0, ondemand: 0 },
    updatedAt: Date.now(),
  };
}

let state = freshState();
let stateLoadedAt = 0;

function loadState() {
  if (Date.now() - stateLoadedAt < STATE_REFRESH_MS) return state;
  stateLoadedAt = Date.now();
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    state = saved.day === utcDay() ? saved : freshState();
  } catch (err) {
    if (state.day !== utcDay()) state = freshState();
  }
  return state;
}

function saveState() {
  state.updatedAt = Date.now();
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, STATE_FILE);
  } catch (err) {
    console.error('[Quota] Failed to persist quota state:', err.message);
  }
}

function canSpend(tier) {
  const s = loadState();
  if (s.exhausted) return false;
  if (Date.now() < s.pausedUntil) return false;
  return s.remaining > (TIER_FLOORS[tier] ?? TIER_FLOORS.ondemand);
}

function getQuotaStatus() {
  const s = loadState();
  const nextReset = new Date();
  nextReset.setUTCHours(24, 0, 0, 0);
  return {
    day: s.day,
    limit: s.limit,
    remaining: s.remaining,
    used: s.limit - s.remaining,
    exhausted: s.exhausted,
    callsByTier: s.calls,
    deniedByTier: s.denied,
    floors: TIER_FLOORS,
    tiersAllowed: {
      live: canSpend('live'),
      sync: canSpend('sync'),
      ondemand: canSpend('ondemand'),
    },
    resetsAt: nextReset.toISOString(),
  };
}

function recordHeaders(headers) {
  const remaining = Number(headers['x-ratelimit-requests-remaining']);
  const limit = Number(headers['x-ratelimit-requests-limit']);
  if (Number.isFinite(limit) && limit > 0) state.limit = limit;
  if (Number.isFinite(remaining)) state.remaining = remaining;

  // Per-minute limit (300/min on Pro): pause briefly instead of getting rate-limit errors
  const minuteRemaining = Number(headers['x-ratelimit-remaining']);
  if (Number.isFinite(minuteRemaining) && minuteRemaining <= 3) {
    state.pausedUntil = Date.now() + 60 * 1000;
  }
}

/**
 * GET an API-Football endpoint. Resolves with the response body; throws QuotaError
 * when the tier may not spend quota, or Error when the API reports an error.
 */
async function apiGet(endpoint, params, tier = 'ondemand') {
  loadState();
  if (!canSpend(tier)) {
    state.denied[tier] = (state.denied[tier] || 0) + 1;
    // Throttled: denied requests can be frequent and don't need an exact count
    if (Date.now() - state.updatedAt > 5000) saveState();
    throw new QuotaError(tier, state.remaining);
  }

  const response = await http.get(endpoint, { params });
  loadState();
  recordHeaders(response.headers);
  state.calls[tier] = (state.calls[tier] || 0) + 1;

  const errors = response.data && response.data.errors;
  if (errors && Object.keys(errors).length > 0) {
    if (errors.requests) {
      // Daily limit reached: stop every tier until the 00:00 UTC reset
      state.exhausted = true;
      state.remaining = 0;
      console.error('[Quota] API-Football daily request limit reached. All API calls paused until 00:00 UTC.');
    } else if (errors.rateLimit) {
      state.pausedUntil = Date.now() + 60 * 1000;
    }
    saveState();
    console.error(`[API Error] Errors returned from api-football for ${endpoint}:`, errors);
    throw new Error(JSON.stringify(errors));
  }

  saveState();
  return response.data;
}

module.exports = { apiGet, canSpend, getQuotaStatus, QuotaError };
