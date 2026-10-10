const { getMessaging } = require('./firebase');
const { cache } = require('./cache');
const { apiGet, getQuotaStatus } = require('./apiClient');
const { applyLiveUpdates, onMatchesEnded, getNextKickoffMs } = require('./syncEngine');

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
// POLL PACING
// ==========================================
/**
 * Live polls use the "live" quota tier (see apiClient.js), so they keep running after
 * user-triggered and scheduled calls have been paused. Remaining quota is read from the
 * API-Football response headers, shared across PM2 workers.
 *
 * Intervals (healthy quota):
 * - 0 live matches  : until the next kickoff, between 60 sec and 15 min
 * - 1–3 live matches: 60 sec
 * - 4–9 live matches: 45 sec
 * - ≥10 live matches: 30 sec
 * Below 2,500 remaining requests the live intervals stretch by 1.5x, below 800 by 3x.
 */
function getDailyQuotaStatus() {
  const q = getQuotaStatus();
  return { used: q.used, budget: q.limit, remaining: q.remaining };
}

function calculateNextPollInterval(liveMatchCount, quotaRemaining) {
  if (quotaRemaining <= 0) {
    console.warn('[QuotaTracker] Daily quota EXHAUSTED. Backing off to 30-min interval.');
    return 30 * 60 * 1000;
  }

  if (liveMatchCount === 0) {
    // Sleep until the next scheduled kickoff so matches show as live straight away
    const nextKickoff = getNextKickoffMs();
    const untilKickoff = nextKickoff === null ? Infinity : nextKickoff - Date.now();
    return Math.min(15 * 60 * 1000, Math.max(60 * 1000, untilKickoff));
  }

  let interval;
  if (liveMatchCount <= 3) interval = 60 * 1000;
  else if (liveMatchCount <= 9) interval = 45 * 1000;
  else interval = 30 * 1000;

  if (quotaRemaining < 800) interval *= 3;
  else if (quotaRemaining < 2500) interval *= 1.5;
  return interval;
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
    const data = await apiGet('/fixtures', { live: 'all' }, 'live');
    const normalizedMatches = normalizeApiResponse(data);
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
        awayTeam: match.awayTeam,
        leagueId: match.leagueId
      });
    }

    // MEMORY MANAGEMENT: Prune matches no longer live to prevent unbounded Map memory growth
    const endedPopularIds = [];
    for (const [matchId, oldState] of previousMatchState.entries()) {
      if (!activeMatchIds.has(matchId)) {
        if (POPULAR_LEAGUE_IDS.has(String(oldState.leagueId))) endedPopularIds.push(matchId);
        previousMatchState.delete(matchId);
      }
    }
    // Matches that left the live feed: sync engine fetches their final score & events
    if (endedPopularIds.length > 0) onMatchesEnded(endedPopularIds);

    // MEMORY MANAGEMENT: Complete Atomic Overwrite (Re-assignment)
    cachedLiveScores = Object.freeze({
      lastUpdated: new Date().toISOString(),
      count: displayMatches.length,
      matches: displayMatches
    });

    // TTL outlasts the longest idle poll interval (15 min) so other PM2 workers keep serving it
    cache.set('live_scores_global', cachedLiveScores, 20 * 60);

    // Push live scores into cached fixture lists (date screens, dashboard) — no API cost
    applyLiveUpdates(displayMatches);

    console.log(`[Poll Engine] Success. Total live: ${normalizedMatches.length}, Displaying popular: ${displayMatches.length}`);
    return displayMatches.length;

  } catch (err) {
    if (err.isQuotaError) {
      console.warn(`[Poll Engine] Skipped: ${err.message}`);
      return null;
    }
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
  const { remaining } = getDailyQuotaStatus();

  // If fetch failed (null), back off safely for 2 min before retrying
  let nextDelay = 2 * 60 * 1000;
  if (remaining <= 0) {
    nextDelay = 30 * 60 * 1000;
  } else if (matchCount !== null) {
    nextDelay = calculateNextPollInterval(matchCount, remaining);
  }

  console.log(`[Poll Engine] Next poll in ${(nextDelay / 1000).toFixed(0)}s | API quota remaining today: ${remaining}`);

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
