const fs = require('fs');
const path = require('path');
const { cache, CACHE_DIR } = require('./cache');
const { apiGet, getQuotaStatus } = require('./apiClient');
const {
  POPULAR_LEAGUE_IDS_SET,
  NOT_STARTED_STATUSES,
  FINISHED_STATUSES,
  mapDateFixtures,
  mapLeagueFixtures,
  mapStandings,
  mapLocation,
  parseFixtureStats,
  parseFixtureEvents,
  parsePredictions,
} = require('./mappers');

// ==========================================
// BACKGROUND SYNC ENGINE
// ==========================================
/**
 * Fetches everything the app shows for popular leagues on a fixed schedule and stores it
 * in the cache, so user requests are served from storage instead of triggering API calls.
 * Runs only in the primary process. All calls use the "sync" quota tier.
 *
 * Job              Checks   Refreshes                                     Est. calls/day
 * dates            5 min    today 30 min, yesterday 1 h, next 7 days 6 h   ~90
 * matchDetails     2 min    events/stats/lineups of live + about-to-start  ~300-700
 *                           matches, 20 fixtures per call (?ids=)
 * standings        15 min   every 6 h, plus ~15 min after a match ends    ~60-100
 * leagueFixtures   30 min   next 10 fixtures per league every 6 h          ~60
 * predictions      10 min   once per upcoming fixture (today/tomorrow)     ~30-80
 * prune            24 h     deletes entries expired for 30+ days           0
 *
 * Live scores (liveScoreManager) feed applyLiveUpdates(), which patches scores straight
 * into the cached fixture lists at no extra cost.
 */

const SYNC_TZ = 'Asia/Dhaka';
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Leagues with standings / league fixtures in the app (mirrors popularLeagues in server.js)
const SYNC_LEAGUE_IDS = ['39', '140', '135', '78', '61', '88', '94', '2', '3', '848', '71', '128', '253', '13', '307'];

const STATUS_FILE = path.join(CACHE_DIR, '_sync_status.json');
const TRIGGER_FILE = path.join(CACHE_DIR, '_sync_trigger.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// HELPERS
// ==========================================

/** Date in the sync timezone as "YYYYMMDD", offset by whole days */
function syncDateCompact(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * DAY);
  return d.toLocaleDateString('en-CA', { timeZone: SYNC_TZ }).replace(/-/g, '');
}

function dateFixturesKey(compact) {
  return `fixtures_date_${compact}_${SYNC_TZ.replace(/\//g, '_')}`;
}

function formatDate(compact) {
  return `${compact.substring(0, 4)}-${compact.substring(4, 6)}-${compact.substring(6, 8)}`;
}

function ageMs(entry) {
  return entry && entry.updatedAt ? Date.now() - entry.updatedAt : Infinity;
}

/** Fixtures cached for yesterday, today and tomorrow (sync timezone) */
function getNearbyFixtures() {
  const fixtures = [];
  for (const offset of [-1, 0, 1]) {
    const entry = cache.getEntry(dateFixturesKey(syncDateCompact(offset)));
    if (entry && Array.isArray(entry.data)) fixtures.push(...entry.data);
  }
  return fixtures;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ==========================================
// LIVE SCORE OVERLAY (zero API cost)
// ==========================================
let lastLiveIds = new Set();

/**
 * Called by liveScoreManager after every live poll. Writes the live score/minute/status
 * into the cached fixture lists so date screens and the dashboard stay live without
 * re-fetching /fixtures?date=.
 */
function applyLiveUpdates(liveMatches) {
  const updates = new Map();
  for (const m of liveMatches) {
    if (!POPULAR_LEAGUE_IDS_SET.has(String(m.leagueId))) continue;
    updates.set(String(m.id), {
      score: `${m.homeScore} - ${m.awayScore}`,
      minute: m.minute,
      status: m.status,
    });
  }
  lastLiveIds = new Set(updates.keys());
  patchDateFixtures(updates);
}

/** updates: Map(fixtureId -> partial fields) */
function patchDateFixtures(updates) {
  if (updates.size === 0) return;
  for (const offset of [-1, 0, 1]) {
    cache.update(dateFixturesKey(syncDateCompact(offset)), (list) => {
      if (!Array.isArray(list)) return list;
      let changed = false;
      const next = list.map((f) => {
        const u = updates.get(String(f.id));
        if (!u) return f;
        if (Object.keys(u).every((k) => f[k] === u[k])) return f;
        changed = true;
        return { ...f, ...u };
      });
      return changed ? next : list;
    });
  }
}

// Matches that just left the live feed get one final detail fetch (FT score, final events)
const pendingFinalize = new Set();
// leagueId -> time after which its standings should be refreshed
const dirtyStandings = new Map();

function onMatchesEnded(fixtureIds) {
  for (const id of fixtureIds) pendingFinalize.add(String(id));
}

/** Earliest kickoff (ms) among nearby fixtures still scheduled, used by the live poller */
function getNextKickoffMs() {
  const now = Date.now();
  let next = null;
  for (const f of getNearbyFixtures()) {
    if (f.status !== 'NS' || !f.timestamp) continue;
    const kickoff = f.timestamp * 1000;
    // Include kickoffs up to 15 min ago: kick-offs are often a few minutes late
    if (kickoff < now - 15 * MIN) continue;
    if (next === null || kickoff < next) next = kickoff;
  }
  return next;
}

// ==========================================
// JOBS
// ==========================================

/** Fixtures by date for yesterday .. +7 days */
async function syncDates({ force }) {
  const plan = [
    { offset: -1, every: HOUR, ttl: 2 * HOUR },
    { offset: 0, every: 30 * MIN, ttl: HOUR },
  ];
  for (let offset = 1; offset <= 7; offset++) plan.push({ offset, every: 6 * HOUR, ttl: 12 * HOUR });

  let calls = 0;
  for (const { offset, every, ttl } of plan) {
    const compact = syncDateCompact(offset);
    const key = dateFixturesKey(compact);
    if (!force && ageMs(cache.getEntry(key)) < every) continue;

    const data = await apiGet('/fixtures', { date: formatDate(compact), timezone: SYNC_TZ }, 'sync');
    calls++;
    cache.set(key, mapDateFixtures(data), ttl / 1000);

    // Venue info is already in this response: store it so match screens need no extra call
    for (const item of data.response || []) {
      if (!POPULAR_LEAGUE_IDS_SET.has(String(item.league.id))) continue;
      const locKey = `location_${item.fixture.id}`;
      if (!cache.get(locKey)) cache.set(locKey, mapLocation(item), 7 * 24 * 3600);
    }
    await sleep(300);
  }
  return { calls };
}

/** Events, statistics and lineups for live and about-to-start fixtures, 20 per request */
let batchDetailsSupported = true;

async function syncMatchDetails({ force }) {
  if (!batchDetailsSupported) return { calls: 0, skipped: 'batch ids not supported by plan' };

  const now = Date.now();
  const candidates = new Set(pendingFinalize);
  for (const id of lastLiveIds) candidates.add(id);

  for (const f of getNearbyFixtures()) {
    if (!f.timestamp) continue;
    const kickoff = f.timestamp * 1000;
    // From 45 min before kickoff (lineups) until the match is finished
    if (kickoff - 45 * MIN > now || kickoff < now - 4 * HOUR) continue;
    if (FINISHED_STATUSES.has(f.status) && !force) {
      // Finished: only fetch once more if we never stored final details
      const events = cache.getEntry(`events_fixture_${f.id}`);
      if (events && events.expireAt - now > 7 * DAY) continue;
    }
    candidates.add(String(f.id));
  }

  // Skip fixtures whose final details are already stored permanently
  const ids = [...candidates].filter((id) => {
    const events = cache.getEntry(`events_fixture_${id}`);
    const isFinal = events && events.expireAt - now > 7 * DAY;
    if (isFinal) pendingFinalize.delete(id);
    return !isFinal;
  }).slice(0, 60);

  let calls = 0;
  const scoreUpdates = new Map();

  for (const group of chunk(ids, 20)) {
    const data = await apiGet('/fixtures', { ids: group.join('-') }, 'sync');
    calls++;
    // One final attempt per ended match; still-running matches stay candidates via the date window
    group.forEach((id) => pendingFinalize.delete(id));

    for (const item of data.response || []) {
      if (!('events' in item) || !('statistics' in item) || !('lineups' in item)) {
        batchDetailsSupported = false;
        console.warn('[Sync] /fixtures?ids= did not include events/statistics/lineups — match details will be fetched on demand instead.');
        return { calls };
      }

      const id = String(item.fixture.id);
      const status = item.fixture.status.short || 'NS';
      const finished = FINISHED_STATUSES.has(status);
      const ttl = finished ? 30 * 24 * 3600 : 300;

      cache.set(`events_fixture_${id}`, parseFixtureEvents({ response: item.events }), ttl);
      cache.set(`stats_event_${id}`, parseFixtureStats({ response: item.statistics }), ttl);
      if (item.lineups.length > 0) {
        cache.set(`lineup_raw_fixture_${id}`, { response: item.lineups }, finished ? 30 * 24 * 3600 : 6 * 3600);
      }
      if (!cache.get(`location_${id}`)) cache.set(`location_${id}`, mapLocation(item), 7 * 24 * 3600);

      scoreUpdates.set(id, {
        score: NOT_STARTED_STATUSES.has(status) ? 'VS' : `${item.goals.home ?? 0} - ${item.goals.away ?? 0}`,
        minute: item.fixture.status.elapsed ? `${item.fixture.status.elapsed}'` : status,
        status,
      });

      if (finished) {
        dirtyStandings.set(String(item.league.id), now + 15 * MIN);
      }
    }
    await sleep(300);
  }

  patchDateFixtures(scoreUpdates);
  return { calls, fixtures: ids.length };
}

/** League tables: every 6 h, and shortly after a match in the league finishes */
const lastStandingsAttempt = new Map();

async function syncStandings({ force }) {
  const now = Date.now();
  const currentYear = new Date().getFullYear();
  let calls = 0;

  for (const leagueId of SYNC_LEAGUE_IDS) {
    const bestSeason = cache.getEntry(`standings_best_season_${leagueId}`)?.data;
    const seasons = [...new Set([bestSeason, currentYear, currentYear - 1].filter(Boolean))];
    const current = cache.getEntry(`standings_${leagueId}_${seasons[0]}`);

    const dirtyAt = dirtyStandings.get(leagueId);
    const isDirty = dirtyAt && now >= dirtyAt;
    const attemptedRecently = now - (lastStandingsAttempt.get(leagueId) || 0) < 6 * HOUR;
    if (!force && !isDirty && (ageMs(current) < 6 * HOUR || attemptedRecently)) continue;
    lastStandingsAttempt.set(leagueId, now);

    for (const season of seasons) {
      let data;
      try {
        data = await apiGet('/standings', { league: leagueId, season }, 'sync');
      } catch (err) {
        if (err.isQuotaError) throw err;
        calls++;
        continue; // season not available on this plan → try the next one
      }
      calls++;
      const mapped = mapStandings(data);
      if (mapped.length > 0) {
        cache.set(`standings_${leagueId}_${season}`, mapped, 12 * 3600);
        cache.set(`standings_best_season_${leagueId}`, season, 7 * 24 * 3600);
        break;
      }
      await sleep(300);
    }
    dirtyStandings.delete(leagueId);
    await sleep(300);
  }
  return { calls };
}

/** Next 10 fixtures per league */
async function syncLeagueFixtures({ force }) {
  const todayStr = new Date().toISOString().split('T')[0];
  let calls = 0;
  for (const leagueId of SYNC_LEAGUE_IDS) {
    const key = `fixtures_league_${leagueId}_${todayStr}`;
    if (!force && ageMs(cache.getEntry(key)) < 6 * HOUR) continue;
    const data = await apiGet('/fixtures', { league: leagueId, next: 10 }, 'sync');
    calls++;
    cache.set(key, mapLeagueFixtures(data), 12 * 3600);
    await sleep(300);
  }
  return { calls };
}

/** Predictions for upcoming fixtures today and tomorrow, fetched once each */
const failedPredictions = new Set();

async function syncPredictions({ force }) {
  const upcoming = [];
  for (const offset of [0, 1]) {
    const entry = cache.getEntry(dateFixturesKey(syncDateCompact(offset)));
    if (entry && Array.isArray(entry.data)) {
      upcoming.push(...entry.data.filter((f) => f.status === 'NS'));
    }
  }

  const missing = upcoming.filter((f) =>
    !failedPredictions.has(f.id) && (force || !cache.getEntry(`predictions_event_${f.id}`)));
  let calls = 0;
  for (const f of missing.slice(0, force ? 40 : 8)) {
    try {
      const data = await apiGet('/predictions', { fixture: f.id }, 'sync');
      cache.set(`predictions_event_${f.id}`, parsePredictions(data), 3 * 24 * 3600);
    } catch (err) {
      if (err.isQuotaError) throw err;
      failedPredictions.add(f.id); // don't retry a broken fixture every 10 min
    }
    calls++;
    await sleep(300);
  }
  return { calls, remaining: Math.max(0, missing.length - calls) };
}

async function pruneCache() {
  return { removed: cache.prune() };
}

const JOBS = {
  dates: { every: 5 * MIN, run: syncDates },
  matchDetails: { every: 2 * MIN, run: syncMatchDetails },
  standings: { every: 15 * MIN, run: syncStandings },
  leagueFixtures: { every: 30 * MIN, run: syncLeagueFixtures },
  predictions: { every: 10 * MIN, run: syncPredictions },
  prune: { every: DAY, run: pruneCache },
};

// Order matters on startup: fixture lists first, everything else derives from them
const JOB_ORDER = ['dates', 'matchDetails', 'standings', 'leagueFixtures', 'predictions', 'prune'];

// ==========================================
// SCHEDULER
// ==========================================
const jobState = {};
for (const name of JOB_ORDER) {
  jobState[name] = { nextRunAt: 0, lastRunAt: null, lastDurationMs: null, lastResult: null, lastError: null };
}

let tickTimer = null;
let isRunning = false;
let isTicking = false;

function saveStatus() {
  try {
    const tmp = `${STATUS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ updatedAt: Date.now(), jobs: jobState }));
    fs.renameSync(tmp, STATUS_FILE);
  } catch (err) {
    console.error('[Sync] Failed to save sync status:', err.message);
  }
}

/** Manual triggers can arrive in any PM2 worker; they are handed to the primary via a file */
function takeTriggers() {
  try {
    const raw = fs.readFileSync(TRIGGER_FILE, 'utf-8');
    fs.unlinkSync(TRIGGER_FILE);
    const { jobs } = JSON.parse(raw);
    return Array.isArray(jobs) ? jobs : [];
  } catch (err) {
    return [];
  }
}

async function runJob(name, force = false) {
  const job = JOBS[name];
  const s = jobState[name];
  const startedAt = Date.now();
  try {
    s.lastResult = await job.run({ force });
    s.lastError = null;
  } catch (err) {
    s.lastError = err.message;
    if (!err.isQuotaError) console.error(`[Sync] Job "${name}" failed:`, err.message);
  }
  s.lastRunAt = startedAt;
  s.lastDurationMs = Date.now() - startedAt;

  // Slow match detail refreshes down when the day's quota is getting tight
  let every = job.every;
  if (name === 'matchDetails' && getQuotaStatus().remaining < 2500) every *= 2;
  s.nextRunAt = Date.now() + every;
}

async function tick() {
  if (!isRunning || isTicking) return;
  isTicking = true;
  try {
    const forced = new Set();
    for (const name of takeTriggers()) {
      if (name === 'all') JOB_ORDER.filter((j) => j !== 'prune').forEach((j) => forced.add(j));
      else if (JOBS[name]) forced.add(name);
    }

    const now = Date.now();
    for (const name of JOB_ORDER) {
      const due = now >= jobState[name].nextRunAt;
      const finalizeNow = name === 'matchDetails' && pendingFinalize.size > 0 &&
        now - (jobState[name].lastRunAt || 0) > 30 * 1000;
      if (forced.has(name) || due || finalizeNow) {
        await runJob(name, forced.has(name));
      }
    }
    saveStatus();
  } finally {
    isTicking = false;
    if (isRunning) tickTimer = setTimeout(tick, 15 * 1000);
  }
}

function startSyncEngine() {
  if (isRunning) return;
  isRunning = true;
  console.log('[Sync] Background sync engine started.');
  tickTimer = setTimeout(tick, 5 * 1000);
}

function stopSyncEngine() {
  isRunning = false;
  if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
  console.log('[Sync] Sync engine stopped.');
}

/** Queue jobs to run on the next tick of the primary process (callable from any worker) */
function requestSync(jobs) {
  const valid = jobs.filter((j) => j === 'all' || JOBS[j]);
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(TRIGGER_FILE, 'utf-8')).jobs || [];
  } catch (err) {}
  fs.writeFileSync(TRIGGER_FILE, JSON.stringify({ jobs: [...new Set([...existing, ...valid])] }));
  return valid;
}

function getSyncStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
  } catch (err) {
    return { updatedAt: null, jobs: {} };
  }
}

module.exports = {
  startSyncEngine,
  stopSyncEngine,
  requestSync,
  getSyncStatus,
  applyLiveUpdates,
  onMatchesEnded,
  getNextKickoffMs,
  JOB_NAMES: JOB_ORDER,
};
