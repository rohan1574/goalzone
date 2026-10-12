const { getMessaging } = require('./firebase');
const { cache } = require('./cache');
const { apiGet, getQuotaStatus } = require('./apiClient');
const { applyLiveUpdates, onMatchesEnded, getNextKickoffMs, getNearbyFixtures } = require('./syncEngine');

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
// 2. STATE TRACKING FOR GOAL & KICKOFF ALERTS
// ==========================================
/**
 * Scores from the previous poll cycle, used to spot goals.
 * Key: matchId (string)
 * Value: { homeScore, awayScore, homeTeam, awayTeam, leagueId }
 */
const previousMatchState = new Map();

/**
 * Kickoff alerts already sent: matchId -> sentAt (ms). Stops a repeat "Match Started"
 * when the API briefly drops a live match from its feed and it reappears later.
 */
const kickoffSentAt = new Map();
const KICKOFF_MEMORY_MS = 4 * 60 * 60 * 1000;

/**
 * Lineup alerts already sent: matchId -> sentAt (ms). Prevents duplicate alerts.
 */
const lineupsSentAt = new Map();
const LINEUP_MEMORY_MS = 6 * 60 * 60 * 1000;

// A match first seen in the live feed only counts as "just started" this early on.
// With nothing live the poller can sleep up to 15 min, so the window has to cover that.
const KICKOFF_WINDOW_MINUTES = 20;

// Alert state is saved so a restart/deploy neither repeats alerts nor misses goals
const ALERT_STATE_CACHE_KEY = 'live_alert_state';
const ALERT_STATE_MAX_AGE_MS = 10 * 60 * 1000;

function saveAlertState() {
  cache.set(ALERT_STATE_CACHE_KEY, {
    savedAt: Date.now(),
    matches: [...previousMatchState.entries()],
    kickoffs: [...kickoffSentAt.entries()],
    lineups: [...lineupsSentAt.entries()],
  }, 24 * 3600);
}

function loadAlertState() {
  const saved = cache.getEntry(ALERT_STATE_CACHE_KEY)?.data;
  if (!saved) return;
  // Scores from before a long outage are too old to diff against (goals in between would be lost anyway)
  if (Date.now() - saved.savedAt < ALERT_STATE_MAX_AGE_MS) {
    for (const [id, state] of saved.matches || []) previousMatchState.set(id, state);
  }
  for (const [id, sentAt] of saved.kickoffs || []) {
    if (Date.now() - sentAt < KICKOFF_MEMORY_MS) kickoffSentAt.set(id, sentAt);
  }
  for (const [id, sentAt] of saved.lineups || []) {
    if (Date.now() - sentAt < LINEUP_MEMORY_MS) lineupsSentAt.set(id, sentAt);
  }
  console.log(`[Alerts] Restored state: ${previousMatchState.size} live matches, ${kickoffSentAt.size} kickoffs, ${lineupsSentAt.size} lineups already sent`);
}

const isJustKickedOff = (match) =>
  match.status === '1H' && (match.elapsed == null || match.elapsed <= KICKOFF_WINDOW_MINUTES);

/**
 * Compares this poll's matches with the previous poll and returns the alerts to send.
 * Pure (no I/O) so the rules can be tested on their own.
 */
function detectMatchAlerts(matches, prevState, sentKickoffs) {
  const alerts = [];
  for (const match of matches) {
    const old = prevState.get(match.id);
    if (old) {
      if (match.homeScore > old.homeScore) alerts.push({ type: 'goal', side: 'home', match });
      if (match.awayScore > old.awayScore) alerts.push({ type: 'goal', side: 'away', match });
    } else if (!sentKickoffs.has(match.id) && isJustKickedOff(match)) {
      alerts.push({ type: 'kickoff', match });
    }
  }
  return alerts;
}

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

  let interval = 60 * 1000; // 60 seconds interval is industry standard for live scores and saves 50% quota
  if (quotaRemaining < 800) interval *= 3;
  else if (quotaRemaining < 2500) interval *= 1.5;
  return interval;
}

// ==========================================
// 3. FCM GOAL & KICKOFF NOTIFICATIONS
// ==========================================
/**
 * Every app install with notifications allowed subscribes to "popular_matches".
 * Older app versions could also subscribe to "match_{id}" via the (now removed) bell, so
 * popular matches go out as one message to a topic *condition*: FCM then delivers it once
 * per device even when the device is in both topics.
 */
async function sendMatchAlert({ matchId, isPopular, title, body, data, channelId, tag }) {
  const tokenManager = require('./tokenManager');
  const tokens = tokenManager.getTokensForMatch(matchId, isPopular);

  const target = isPopular
    ? { condition: `'popular_matches' in topics || 'match_${matchId}' in topics` }
    : { topic: `match_${matchId}` };

  const message = {
    ...target,
    notification: { title, body },
    data: { ...data, matchId: String(matchId) },
    android: {
      priority: 'high',
      collapseKey: tag,
      notification: { sound: 'default', channelId, tag },
    },
    apns: {
      headers: { 'apns-collapse-id': tag },
      payload: { aps: { sound: 'default', contentAvailable: true } },
    },
  };

  // 1. Send to FCM topic
  try {
    const response = await getMessaging().send(message);
    console.log(`[FCM Topic] ${data.type} for match ${matchId} sent: ${response}`);
  } catch (err) {
    console.error(`[FCM Topic Error] Failed to send ${data.type} for match ${matchId}:`, err.message);
  }

  // 2. Also send multicast to registered device tokens
  if (tokens.length > 0) {
    try {
      const multicastMessage = {
        tokens,
        notification: { title, body },
        data: { ...data, matchId: String(matchId) },
        android: {
          priority: 'high',
          collapseKey: tag,
          notification: { sound: 'default', channelId, tag },
        },
        apns: {
          headers: { 'apns-collapse-id': tag },
          payload: { aps: { sound: 'default', contentAvailable: true } },
        },
      };
      const multiRes = await getMessaging().sendEachForMulticast(multicastMessage);
      console.log(`[FCM Multicast] ${data.type} sent to ${multiRes.successCount}/${tokens.length} devices (failed: ${multiRes.failureCount})`);

      // Prune invalid tokens
      const invalidTokens = [];
      multiRes.responses.forEach((resp, idx) => {
        if (resp.error && (
          resp.error.code === 'messaging/registration-token-not-registered' ||
          resp.error.code === 'messaging/invalid-registration-token'
        )) {
          invalidTokens.push(tokens[idx]);
        }
      });
      if (invalidTokens.length > 0) {
        tokenManager.removeInvalidTokens(invalidTokens);
      }
    } catch (err) {
      console.error(`[FCM Multicast Error] Failed to multicast ${data.type}:`, err.message);
    }
  }
}

// Latest goal by this team in the API's live event list, e.g. { player: "Saka", minute: "34'" }.
// Only trusted when the team's goal events add up to its score — the event feed can lag
// behind the score, and then the "latest" event would name an earlier scorer.
function findLatestGoal(rawFixture, teamId, teamScore) {
  const goals = (rawFixture?.events || []).filter(
    (e) => e.type === 'Goal' && e.detail !== 'Missed Penalty' && e.team?.id === teamId,
  );
  if (goals.length !== teamScore) return null;
  const goal = goals[goals.length - 1];
  if (!goal?.player?.name) return null;
  const minute = goal.time?.extra ? `${goal.time.elapsed}+${goal.time.extra}'` : `${goal.time?.elapsed}'`;
  const suffix = goal.detail === 'Penalty' ? ' (pen)' : goal.detail === 'Own Goal' ? ' (OG)' : '';
  return { player: `${goal.player.name}${suffix}`, minute };
}

function sendGoalNotification(match, side, rawFixture, isPopular) {
  const scoringTeam = side === 'home' ? match.homeTeam : match.awayTeam;
  const scoringTeamId = side === 'home' ? rawFixture?.teams?.home?.id : rawFixture?.teams?.away?.id;
  const goal = findLatestGoal(rawFixture, scoringTeamId, side === 'home' ? match.homeScore : match.awayScore);
  const scoreLine = `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}`;

  return sendMatchAlert({
    matchId: match.id,
    isPopular,
    title: `⚽ GOAL! ${scoringTeam}`,
    body: goal ? `${goal.player} ${goal.minute} · ${scoreLine}` : scoreLine,
    data: {
      type: 'GOAL_ALERT',
      homeScore: String(match.homeScore),
      awayScore: String(match.awayScore),
      scoringTeam,
    },
    channelId: 'goal_alerts',
    // Same tag per match: a newer goal replaces the previous one in the shade
    tag: `match_${match.id}`,
  });
}

function sendKickoffNotification(match, isPopular) {
  return sendMatchAlert({
    matchId: match.id,
    isPopular,
    title: '⚡ Match Started!',
    body: `${match.homeTeam} vs ${match.awayTeam} has kicked off! ⚽`,
    data: { type: 'MATCH_STARTED' },
    channelId: 'match_alerts',
    tag: `kickoff_${match.id}`,
  });
}

function sendLineupNotification(match, isPopular) {
  const home = match.home?.name || match.homeTeam || 'Home Team';
  const away = match.away?.name || match.awayTeam || 'Away Team';
  return sendMatchAlert({
    matchId: match.id,
    isPopular,
    title: '📋 Lineups Announced!',
    body: `${home} vs ${away} starting XIs are officially out! Tap to see the lineups.`,
    data: {
      type: 'LINEUP_ANNOUNCED',
      matchId: String(match.id),
      screen: 'lineup',
    },
    channelId: 'match_alerts',
    tag: `lineup_${match.id}`,
  });
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
  '5',    // UEFA Nations League
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
  '239',  // Primera A
  '40',   // Championship
  '45',   // FA Cup
  '48',   // EFL Cup
  '143',  // Copa del Rey
  '16'    // CONCACAF Champions Cup
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
      minute: item.fixture?.status?.elapsed
        ? (() => {
            const el = item.fixture.status.elapsed;
            const ex = item.fixture.status.extra != null ? parseInt(item.fixture.status.extra, 10) : null;
            const st = item.fixture.status.short;
            const ts = item.fixture?.timestamp;
            const minsSinceKO = ts ? (Date.now() - ts * 1000) / 60000 : null;
            if (minsSinceKO !== null && minsSinceKO >= 115) return 'FT';
            if (st === '1H' && el >= 45) {
              const cur = el > 45 ? el - 45 : 0;
              const targetExtra = ex !== null ? ex : (cur > 0 ? cur : null);
              if (targetExtra !== null && cur >= targetExtra) return 'HT';
              return targetExtra !== null ? `45+${cur}' (+${targetExtra})` : `45'`;
            }
            if (st === '2H' && el >= 90) {
              const cur = el > 90 ? el - 90 : 0;
              const targetExtra = ex !== null ? ex : (cur > 0 ? cur : null);
              if (targetExtra !== null && cur >= targetExtra) return 'FT';
              return targetExtra !== null ? `90+${cur}' (+${targetExtra})` : `90'`;
            }
            if (ex) return `${el}' (+${ex})`;
            return `${el}'`;
          })()
        : (item.status || 'LIVE'),
      status: (() => {
        const el = item.fixture?.status?.elapsed;
        const ex = item.fixture?.status?.extra != null ? parseInt(item.fixture.status.extra, 10) : null;
        const st = item.fixture?.status?.short || item.status || 'LIVE';
        const ts = item.fixture?.timestamp;
        const minsSinceKO = ts ? (Date.now() - ts * 1000) / 60000 : null;
        if (minsSinceKO !== null && minsSinceKO >= 115) return 'FT';
        if (st === '1H' && el >= 45) {
          const cur = el > 45 ? el - 45 : 0;
          const targetExtra = ex !== null ? ex : (cur > 0 ? cur : null);
          if (targetExtra !== null && cur >= targetExtra) return 'HT';
        }
        if (st === '2H' && el >= 90) {
          const cur = el > 90 ? el - 90 : 0;
          const targetExtra = ex !== null ? ex : (cur > 0 ? cur : null);
          if (targetExtra !== null && cur >= targetExtra) return 'FT';
        }
        return st;
      })(),
      elapsed: item.fixture?.status?.elapsed ?? null,
      extra: item.fixture?.status?.extra ?? null,
      timestamp: item.fixture?.timestamp ?? null,
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

    // Filter strictly to popular leagues (never show obscure/unknown regional leagues)
    const displayMatches = normalizedMatches.filter((m) => POPULAR_LEAGUE_IDS.has(String(m.leagueId)));

    // Goal & kickoff alerts (all leagues go to their match topic, popular ones to everyone)
    const rawById = new Map(
      (Array.isArray(data?.response) ? data.response : []).map((item) => [String(item.fixture?.id), item]),
    );
    for (const alert of detectMatchAlerts(normalizedMatches, previousMatchState, kickoffSentAt)) {
      const { match } = alert;
      const isPopular = POPULAR_LEAGUE_IDS.has(String(match.leagueId));
      if (alert.type === 'goal') {
        console.log(`[Goal Detected] ${alert.side === 'home' ? match.homeTeam : match.awayTeam} scored! Match ID: ${match.id}`);
        sendGoalNotification(match, alert.side, rawById.get(match.id), isPopular);
      } else {
        console.log(`[Kickoff Detected] ${match.homeTeam} vs ${match.awayTeam} started! Match ID: ${match.id}`);
        kickoffSentAt.set(match.id, Date.now());
        sendKickoffNotification(match, isPopular);
      }
    }

    for (const match of normalizedMatches) {
      activeMatchIds.add(match.id);
      previousMatchState.set(match.id, {
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
    for (const [matchId, sentAt] of kickoffSentAt.entries()) {
      if (Date.now() - sentAt > KICKOFF_MEMORY_MS) kickoffSentAt.delete(matchId);
    }
    saveAlertState();

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

// Fixture ID -> timestamp of last lineup check (ms)
const lastLineupCheck = new Map();

/**
 * Checks upcoming matches in popular leagues scheduled to start in 5 to 55 minutes.
 * If starting XIs are published by API-Sports, broadcasts a push notification.
 */
async function checkAndSendLineupAlerts() {
  const now = Date.now();
  let nearby = [];
  try {
    nearby = getNearbyFixtures();
  } catch (err) {
    return;
  }
  if (!Array.isArray(nearby) || nearby.length === 0) return;

  for (const f of nearby) {
    if (!f || !f.id || f.status !== 'NS' || !f.timestamp) continue;
    const fixtureId = String(f.id);

    // Skip if lineup alert was already sent for this match
    if (lineupsSentAt.has(fixtureId)) continue;

    const leagueId = String(f.leagueId || f.league?.id || '');
    const isPopular = POPULAR_LEAGUE_IDS.has(leagueId);
    if (!isPopular) continue;

    const kickoffMs = f.timestamp * 1000;
    const diffMinutes = (kickoffMs - now) / (60 * 1000);

    // Check window: 5 to 55 minutes before scheduled kickoff
    if (diffMinutes < 5 || diffMinutes > 55) continue;

    // Throttle checks per fixture: check at most once every 3.5 minutes
    const lastCheck = lastLineupCheck.get(fixtureId) || 0;
    if (now - lastCheck < 3.5 * 60 * 1000) continue;
    lastLineupCheck.set(fixtureId, now);

    try {
      const lineupData = await apiGet('/fixtures/lineups', { fixture: fixtureId }, 'sync');
      const list = lineupData?.response || lineupData?.data || [];
      const hasLineup = Array.isArray(list) && list.length >= 2 && (list[0]?.startXI?.length > 0 || list[1]?.startXI?.length > 0);

      if (hasLineup) {
        const homeName = f.home?.name || f.homeTeam || 'Home';
        const awayName = f.away?.name || f.awayTeam || 'Away';
        console.log(`[Lineup Detected] Lineups announced for match ${fixtureId} (${homeName} vs ${awayName})`);
        lineupsSentAt.set(fixtureId, now);
        saveAlertState();
        sendLineupNotification(f, isPopular);
      }
    } catch (err) {
      if (err.isQuotaError) break; // Don't burn quota
    }
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
  await checkAndSendLineupAlerts().catch((err) => console.warn('[Lineup Check Error]:', err.message));
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
  loadAlertState();
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
  getDailyQuotaStatus,
  detectMatchAlerts,
  findLatestGoal
};
