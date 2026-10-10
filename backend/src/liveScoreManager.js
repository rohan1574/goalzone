const axios = require('axios');
const { getMessaging } = require('./firebase');
const { cache } = require('./cache');

// Configuration & Environment Variables
const rawBaseUrl = process.env.THIRD_PARTY_API_URL || process.env.APISPORTS_URL || 'https://v3.football.api-sports.io';
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const THIRD_PARTY_API_URL = cleanBaseUrl.includes('/fixtures') ? cleanBaseUrl : `${cleanBaseUrl}/fixtures?live=all`;
const THIRD_PARTY_API_KEY = process.env.THIRD_PARTY_API_KEY || process.env.APISPORTS_KEY || '';

// Axios Client with timeout to prevent hanging connections
const apiClient = axios.create({
  timeout: 10000,
  headers: {
    'x-apisports-key': THIRD_PARTY_API_KEY,
    'Accept': 'application/json'
  }
});

// ==========================================
// 1. IN-MEMORY & DISK-BACKED CACHE
// ==========================================
/**
 * Global cache object.
 * MUST ALWAYS BE REPLACED WITH A NEW OBJECT REFERENCE ON FETCH.
 */
let cachedLiveScores = Object.freeze({
  lastUpdated: null,
  count: 0,
  matches: []
});

/**
 * Reader function for API route endpoint (/api/live-scores)
 * Shared across PM2 cluster instances via disk fallback.
 */
function getCachedLiveScores() {
  if (cachedLiveScores && Array.isArray(cachedLiveScores.matches) && cachedLiveScores.matches.length > 0) {
    return cachedLiveScores;
  }
  const diskData = cache.get('live_scores_global');
  if (diskData && Array.isArray(diskData.matches)) {
    return diskData;
  }
  return cachedLiveScores;
}

// ==========================================
// 2. STATE TRACKING FOR GOAL DETECTOR
// ==========================================
/**
 * Keeps a duplicate copy of match scores from the previous poll cycle.
 * Key: matchId (string)
 * Value: { homeScore: number, awayScore: number, homeTeam: string, awayTeam: string }
 */
const previousMatchState = new Map();

// ==========================================
// DAILY QUOTA TRACKER
// ==========================================
/**
 * Tracks live-score API calls made today.
 * Resets automatically at midnight (server local time).
 *
 * Daily budget split:
 *   Live polling budget  : 3,600 / day  (~150/hr)
 *   CacheWarmer budget   : 700  / day  (~29/hr)
 *   User-triggered budget: 700  / day  (cache-miss buffer)
 *   Safety reserve       : 2,500 / day
 *   ──────────────────────────────────────────────
 *   Total                : 7,500 / day
 */
const DAILY_POLL_BUDGET = 3600; // max live-score polls per day
let dailyPollCount = 0;
let lastResetDay = new Date().toDateString();

function trackAndCheckQuota() {
  const today = new Date().toDateString();
  if (today !== lastResetDay) {
    // New day — reset counter
    dailyPollCount = 0;
    lastResetDay = today;
    console.log('[QuotaTracker] New day detected — daily poll counter reset to 0.');
  }
  dailyPollCount++;
  const remaining = DAILY_POLL_BUDGET - dailyPollCount;
  if (dailyPollCount % 50 === 0) {
    console.log(`[QuotaTracker] Daily poll count: ${dailyPollCount}/${DAILY_POLL_BUDGET} (remaining: ${remaining})`);
  }
  return remaining > 0; // false = budget exhausted
}

function getDailyQuotaStatus() {
  return { used: dailyPollCount, budget: DAILY_POLL_BUDGET, remaining: DAILY_POLL_BUDGET - dailyPollCount };
}

/**
 * Calculates dynamic poll interval based on number of active live matches.
 *
 * Conservative Quota Math (target ≤ 150 polls/hr from live poller):
 * - 0 live matches : 15 min  (900,000ms) → ~96 req/day  (very cheap)
 * - 1–3 live matches: 60 sec (60,000ms)  → ~1,440 req/day (~60/hr)
 * - 4–9 live matches: 45 sec (45,000ms)  → ~1,920 req/day (~80/hr)
 * - ≥10 live matches: 30 sec (30,000ms)  → ~2,880 req/day (~120/hr)
 *
 * Even worst-case (≥10 matches all day) = 2,880 → well under 3,600 budget.
 */
function calculateNextPollInterval(liveMatchCount, quotaRemaining) {
  // If we've burned through the daily poll budget, back off to 30 min
  if (quotaRemaining <= 0) {
    console.warn('[QuotaTracker] Daily poll budget EXHAUSTED. Backing off to 30-min interval.');
    return 30 * 60 * 1000; // 30 minutes
  }

  // Scale back interval when budget is running low (< 20% remaining)
  const budgetLow = quotaRemaining < DAILY_POLL_BUDGET * 0.20;

  if (liveMatchCount === 0) {
    return 15 * 60 * 1000; // 15 minutes — no live matches
  } else if (liveMatchCount <= 3) {
    return budgetLow ? 90 * 1000 : 60 * 1000; // 60-90 sec for 1-3 matches
  } else if (liveMatchCount <= 9) {
    return budgetLow ? 60 * 1000 : 45 * 1000; // 45-60 sec for 4-9 matches
  } else {
    return budgetLow ? 45 * 1000 : 30 * 1000; // 30-45 sec for ≥10 matches
  }
}

// ==========================================
// 3. FCM GOAL NOTIFICATION SYSTEM
// ==========================================
/**
 * Sends a real-time FCM notification to match topic when a goal is scored.
 * Target topic format: match_{matchId}
 */
async function sendGoalNotification(matchId, scoringTeam, homeTeam, awayTeam, newHomeScore, newAwayScore) {
  const topicName = `match_${matchId}`;
  
  const message = {
    topic: topicName,
    notification: {
      title: `⚽ GOAL! ${scoringTeam}`,
      body: `${homeTeam} ${newHomeScore} - ${newAwayScore} ${awayTeam}`
    },
    data: {
      type: 'GOAL_ALERT',
      matchId: String(matchId),
      homeScore: String(newHomeScore),
      awayScore: String(newAwayScore),
      scoringTeam: scoringTeam
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'goal_alerts'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          contentAvailable: true
        }
      }
    }
  };

  try {
    const messaging = getMessaging();
    const response = await messaging.send(message);
    console.log(`[FCM Goal Alert] Notification sent to topic "${topicName}": ${response}`);
  } catch (err) {
    console.error(`[FCM Error] Failed to send goal alert for topic "${topicName}":`, err.message);
  }
}


// Set of popular / featured league IDs (Big 5, Champions League, Europa League, Saudi Pro, MLS, Brasil, Argentina, World Cup, Euros, etc.)
const POPULAR_LEAGUE_IDS = new Set([
  '39',   // Premier League
  '140',  // La Liga
  '135',  // Serie A
  '78',   // Bundesliga
  '61',   // Ligue 1
  '2',    // UEFA Champions League
  '3',    // UEFA Europa League
  '848',  // UEFA Conference League
  '88',   // Eredivisie
  '94',   // Primeira Liga
  '71',   // Brasileirão Série A
  '128',  // Liga Profesional Argentina
  '253',  // MLS
  '307',  // Saudi Pro League
  '13',   // Copa Libertadores
  '1',    // World Cup
  '4',    // Euro Championship
  '9',    // Copa America
  '10',   // International Friendlies
  '11',   // UEFA Nations League
  '15',   // FIFA Club World Cup
  '393',  // AFC Champions League
  '239'   // Süper Lig
]);

/**
 * Normalizes raw API response into standardized internal format
 */
function normalizeApiResponse(rawResponse) {
  const list = rawResponse?.response || rawResponse?.data || rawResponse || [];
  if (!Array.isArray(list)) return [];

  return list.map((item) => {
    const homeName = item.teams?.home?.name || item.homeTeam || 'Home Team';
    const awayName = item.teams?.away?.name || item.awayTeam || 'Away Team';
    const homeScore = Number(item.goals?.home ?? item.homeScore ?? 0);
    const awayScore = Number(item.goals?.away ?? item.awayScore ?? 0);
    const homeLogo = item.teams?.home?.logo || item.homeLogo || '';
    const awayLogo = item.teams?.away?.logo || item.awayLogo || '';
    const homeCode = item.teams?.home?.code || (homeName ? homeName.substring(0, 3).toUpperCase() : 'HOM');
    const awayCode = item.teams?.away?.code || (awayName ? awayName.substring(0, 3).toUpperCase() : 'AWY');

    return {
      id: String(item.fixture?.id || item.id),
      league: item.league?.name || item.leagueName || 'Unknown League',
      leagueId: String(item.league?.id || ''),
      leagueLogo: item.league?.logo || '',
      home: {
        id: item.teams?.home?.id,
        name: homeName,
        short: homeCode,
        logo: homeLogo,
      },
      away: {
        id: item.teams?.away?.id,
        name: awayName,
        short: awayCode,
        logo: awayLogo,
      },
      homeTeam: homeName,
      awayTeam: awayName,
      homeScore: homeScore,
      awayScore: awayScore,
      score: `${homeScore} - ${awayScore}`,
      minute: item.fixture?.status?.elapsed ? `${item.fixture.status.elapsed}'` : (item.status || 'LIVE'),
      status: item.fixture?.status?.short || item.status || 'LIVE'
    };
  });
}

// ==========================================
// 4. MAIN FETCH & GOAL DIFF PROCESSING
// ==========================================
async function fetchAndProcessLiveScores() {
  console.log(`[Poll Engine] Polling third-party API at ${new Date().toISOString()}...`);

  try {
    const response = await apiClient.get(THIRD_PARTY_API_URL);
    const normalizedMatches = normalizeApiResponse(response.data);
    const activeMatchIds = new Set();

    // Filter strictly to popular leagues only (no minor/unknown leagues displayed)
    const displayMatches = normalizedMatches.filter((m) => POPULAR_LEAGUE_IDS.has(String(m.leagueId)));

    // Goal Detection & State Comparison
    for (const match of normalizedMatches) {
      const matchId = match.id;
      activeMatchIds.add(matchId);

      const oldState = previousMatchState.get(matchId);

      if (oldState) {
        // Check Home Goal
        if (match.homeScore > oldState.homeScore) {
          console.log(`[Goal Detected] ${match.homeTeam} scored! Match ID: ${matchId}`);
          sendGoalNotification(
            matchId,
            match.homeTeam,
            match.homeTeam,
            match.awayTeam,
            match.homeScore,
            match.awayScore
          );
        }

        // Check Away Goal
        if (match.awayScore > oldState.awayScore) {
          console.log(`[Goal Detected] ${match.awayTeam} scored! Match ID: ${matchId}`);
          sendGoalNotification(
            matchId,
            match.awayTeam,
            match.homeTeam,
            match.awayTeam,
            match.homeScore,
            match.awayScore
          );
        }
      }

      // Update State Tracking for Next Cycle
      previousMatchState.set(matchId, {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam
      });
    }

    // MEMORY MANAGEMENT: Prune matches no longer live to prevent unbounded Map memory growth
    for (const matchId of previousMatchState.keys()) {
      if (!activeMatchIds.has(matchId)) {
        previousMatchState.delete(matchId);
      }
    }

    // MEMORY MANAGEMENT: Complete Atomic Overwrite (Re-assignment)
    cachedLiveScores = Object.freeze({
      lastUpdated: new Date().toISOString(),
      count: displayMatches.length,
      matches: displayMatches
    });

    cache.set('live_scores_global', cachedLiveScores, 120);

    console.log(`[Poll Engine] Success. Total live: ${normalizedMatches.length}, Displaying popular: ${displayMatches.length}`);
    return displayMatches.length;

  } catch (err) {
    console.error(`[Poll Engine Error] Third-party fetch failed:`, err.message);
    // Return null to signal error condition to dynamic scheduler
    return null;
  }
}

// ==========================================
// 5. SMART DYNAMIC POLLING LOOP (RECURSIVE SETTIMEOUT)
// ==========================================
let pollingTimer = null;
let isPollingRunning = false;

async function pollCycle() {
  if (!isPollingRunning) return;

  // Check quota before hitting the API
  const allowed = trackAndCheckQuota();
  if (!allowed) {
    console.warn('[Poll Engine] Daily poll budget exhausted — skipping fetch, sleeping 30 min.');
    pollingTimer = setTimeout(pollCycle, 30 * 60 * 1000);
    return;
  }

  const matchCount = await fetchAndProcessLiveScores();

  // If fetch failed (null), back off safely for 2 min before retrying
  let nextDelay = 2 * 60 * 1000;

  if (matchCount !== null) {
    const { remaining } = getDailyQuotaStatus();
    nextDelay = calculateNextPollInterval(matchCount, remaining);
  }

  console.log(`[Poll Engine] Next poll in ${(nextDelay / 1000).toFixed(0)}s | quota used today: ${dailyPollCount}/${DAILY_POLL_BUDGET}`);

  // Recursive setTimeout ensures zero request overlap if network latency spikes
  pollingTimer = setTimeout(pollCycle, nextDelay);
}

function startLiveScorePolling() {
  if (isPollingRunning) return;
  isPollingRunning = true;
  console.log('[Poll Engine] Starting dynamic live score background polling system...');
  pollCycle();
}

function stopLiveScorePolling() {
  isPollingRunning = false;
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
  console.log('[Poll Engine] Stopped polling system.');
}

module.exports = {
  getCachedLiveScores,
  startLiveScorePolling,
  stopLiveScorePolling,
  fetchAndProcessLiveScores,
  getDailyQuotaStatus
};
