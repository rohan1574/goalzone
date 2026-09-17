const axios = require('axios');
const { getMessaging } = require('./firebase');

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
// 1. IN-MEMORY CACHE (ATOMIC OVERWRITE)
// ==========================================
/**
 * Global cache object.
 * MUST ALWAYS BE REPLACED WITH A NEW OBJECT REFERENCE ON FETCH.
 * Never use .push() or mutate nested arrays directly to ensure V8 Garbage Collector 
 * can clean up old memory allocations cleanly.
 */
let cachedLiveScores = Object.freeze({
  lastUpdated: null,
  count: 0,
  matches: []
});

/**
 * Reader function for API route endpoint (/api/live-scores)
 * O(1) response time, zero third-party API hits from client requests.
 */
function getCachedLiveScores() {
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

/**
 * Calculates dynamic poll interval based on number of active live matches.
 * Quota Math (7,500 daily quota = 312 req/hr max):
 * - 0 live matches: 10 mins (600,000ms) -> 6 req/hr
 * - 1 to 5 live matches: 30 secs (30,000ms) -> 120 req/hr
 * - > 5 live matches: 20 secs (20,000ms) -> 180 req/hr
 */
function calculateNextPollInterval(liveMatchCount) {
  if (liveMatchCount === 0) {
    return 10 * 60 * 1000; // 10 minutes
  } else if (liveMatchCount <= 5) {
    return 30 * 1000; // 30 seconds
  } else {
    return 20 * 1000; // 20 seconds
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


/**
 * Normalizes raw API response into standardized internal format
 */
function normalizeApiResponse(rawResponse) {
  const list = rawResponse?.response || rawResponse?.data || rawResponse || [];
  if (!Array.isArray(list)) return [];

  return list.map((item) => ({
    id: String(item.fixture?.id || item.id),
    league: item.league?.name || item.leagueName || 'Unknown League',
    homeTeam: item.teams?.home?.name || item.homeTeam || 'Home Team',
    awayTeam: item.teams?.away?.name || item.awayTeam || 'Away Team',
    homeScore: Number(item.goals?.home ?? item.homeScore ?? 0),
    awayScore: Number(item.goals?.away ?? item.awayScore ?? 0),
    minute: item.fixture?.status?.elapsed ? `${item.fixture.status.elapsed}'` : (item.status || 'LIVE'),
    status: item.fixture?.status?.short || item.status || 'LIVE'
  }));
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
    // Drops old object reference so V8 GC cleans up old data automatically
    cachedLiveScores = Object.freeze({
      lastUpdated: new Date().toISOString(),
      count: normalizedMatches.length,
      matches: normalizedMatches
    });

    console.log(`[Poll Engine] Success. Matches active: ${normalizedMatches.length}`);
    return normalizedMatches.length;

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

  const matchCount = await fetchAndProcessLiveScores();

  // If fetch failed (null), back off safely for 30s before retrying
  let nextDelay = 30 * 1000;

  if (matchCount !== null) {
    nextDelay = calculateNextPollInterval(matchCount);
  }

  console.log(`[Poll Engine] Next poll scheduled in ${nextDelay / 1000} seconds.`);

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
  fetchAndProcessLiveScores
};
