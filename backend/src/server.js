// MUST be first — loads .env before any module reads process.env
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { initFirebase } = require("./firebase");
const {
  getCachedLiveScores,
  startLiveScorePolling,
  stopLiveScorePolling,
} = require("./liveScoreManager");
const { cache } = require("./cache");
const predictionStore = require("./predictionStore");
// cacheWarmer is replaced by syncEngine — kept only for the /admin/warm route
const { apiGet, getQuotaStatus } = require("./apiClient");
const {
  startSyncEngine,
  stopSyncEngine,
  requestSync,
  getSyncStatus,
  JOB_NAMES,
} = require("./syncEngine");
const {
  POPULAR_LEAGUE_IDS_SET,
  mapDateFixtures,
  mapLeagueFixtures,
  mapStandings,
  mapLocation,
  mapPlayerRatings,
  parseFixtureStats,
  parseFixtureEvents,
  parsePredictions,
} = require("./mappers");

// Initialize Firebase Admin SDK
initFirebase();

const app = express();
const PORT = process.env.PORT || 3000;
const APISPORTS_KEY =
  process.env.APISPORTS_KEY || process.env.THIRD_PARTY_API_KEY || "";

if (!APISPORTS_KEY) {
  console.error("[Error] APISPORTS_KEY is not defined in .env file!");
}

app.use(cors());
app.use(express.json());

// Clean up any stale empty lineup cache files from previous versions
try {
  const fs = require("fs");
  const path = require("path");
  const { CACHE_DIR } = require("./cache");
  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      if (f.startsWith("lineup_raw_fixture_") && f.endsWith(".json")) {
        try {
          const filePath = path.join(CACHE_DIR, f);
          const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const d = raw?.data;
          if (!d || (Array.isArray(d.response) && d.response.length === 0)) {
            fs.unlinkSync(filePath);
            console.log(`[Cache Cleanup] Removed stale empty lineup file: ${f}`);
          }
        } catch (_) {}
      }
    }
  }
} catch (_) {}

function isDataEmpty(data) {
  if (!data) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (Array.isArray(data.response)) return data.response.length === 0;
  if (Array.isArray(data.starters)) return data.starters.length === 0;
  if (data.lineup === null) return true;
  return false;
}

// In-flight request deduplication map
// Prevents duplicate API calls when the same cache key is requested simultaneously
// (e.g., 10 users all open the same match page at the same moment)
const inFlightRequests = new Map();

function requestFromApi(cacheKey, endpoint, params, ttlSeconds, mapper, { keepOnEmpty = null } = {}) {
  // Deduplicate: if an identical request is already in-flight, wait for it instead of making another
  if (inFlightRequests.has(cacheKey)) {
    console.log(`[API Dedup] Waiting on in-flight request for key: ${cacheKey}`);
    return inFlightRequests.get(cacheKey);
  }

  console.log(`[API Call] Requesting ${endpoint} with params:`, params);

  const requestPromise = (async () => {
    try {
      const apiResponse = await apiGet(endpoint, params, "ondemand");
      const mappedData = mapper(apiResponse);
      const isEmpty = isDataEmpty(mappedData);
      // A background refresh that comes back empty keeps the data we already had (re-checked in 5 min)
      if (isEmpty && keepOnEmpty !== null) {
        cache.set(cacheKey, keepOnEmpty, Math.min(ttlSeconds, 300));
        return keepOnEmpty;
      }
      // On empty result: cache for a reasonable cooldown (10m to 1h) instead of hammering API every 60s
      const emptyTtl = Math.max(Math.min(ttlSeconds, 3600), 600);
      const effectiveTtl = isEmpty ? emptyTtl : ttlSeconds;
      cache.set(cacheKey, mappedData, effectiveTtl);
      return mappedData;
    } catch (err) {
      if (!err.isQuotaError) {
        console.error(
          `[API Request Failed] Endpoint: ${endpoint}, Error:`,
          err.message || err,
        );
      }
      throw err;
    } finally {
      // Always clean up the in-flight map when done (success or error)
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Serves data from the cache, calling API-Football only when nothing usable is stored.
 * Most popular-league data is kept fresh by the background sync engine (syncEngine.js).
 *
 * - Fresh entry   → returned immediately (if not empty, or if empty and within 60s cooldown).
 * - Stale entry   → returned immediately if it has real data, and refreshed in the background
 *                   (the background sync engine is off, so nothing else would ever update it).
 * - No entry / empty entry ready for recheck → fetched from the API.
 */
async function fetchAndCache(cacheKey, endpoint, params, ttlSeconds, mapper) {
  const entry = cache.getEntry(cacheKey);

  // 1. Fresh cache: return immediately (both non-empty and empty within TTL)
  if (entry && !entry.stale) {
    return entry.data;
  }

  // 2. Stale cache: return existing data immediately only if it has real content,
  //    and refresh it in the background so the next request gets current data
  if (entry && !isDataEmpty(entry.data)) {
    if (!inFlightRequests.has(cacheKey)) {
      requestFromApi(cacheKey, endpoint, params, ttlSeconds, mapper, { keepOnEmpty: entry.data })
        .catch(() => {}); // quota / network errors: keep serving the stale copy
    }
    return entry.data;
  }

  // 3. Cold cache (no entry or expired empty entry): fetch once from API and cache
  try {
    return await requestFromApi(cacheKey, endpoint, params, ttlSeconds, mapper);
  } catch (err) {
    if (err.isQuotaError) return mapper({ response: [] });
    throw err;
  }
}

// ==========================================
// 1. LIVE SCORES ENDPOINTS
// ==========================================
app.get("/api/live-scores", (req, res) => {
  const data = getCachedLiveScores();
  res.setHeader("Cache-Control", "public, max-age=15");
  res.json(data);
});

app.post("/api/match-notifications", async (req, res) => {
  const { token, matchId, action } = req.body;
  if (!token || !matchId) {
    return res.status(400).json({ error: "Missing token or matchId" });
  }

  const topicName = matchId === "popular" ? "popular_matches" : `match_${matchId}`;
  const verb = action === "unsubscribe" ? "unsubscribe" : "subscribe";

  // 1. Always register/unregister in tokenManager for reliable multicast delivery
  const tokenManager = require("./tokenManager");
  if (verb === "unsubscribe") {
    tokenManager.removeToken(token, topicName);
  } else {
    tokenManager.addToken(token, topicName);
  }

  // 2. Also attempt Firebase topic subscription as best effort
  try {
    const { getMessaging } = require("./firebase");
    const messaging = getMessaging();
    const result = verb === "unsubscribe"
      ? await messaging.unsubscribeFromTopic([token], topicName)
      : await messaging.subscribeToTopic([token], topicName);

    if (result.failureCount > 0) {
      console.warn(`[FCM Topic Best-Effort] Topic ${verb} returned non-fatal error (fallback to multicast):`, result.errors?.[0]?.error?.message);
    } else {
      console.log(`[FCM Topic] ${verb} token for topic "${topicName}"`);
    }
  } catch (err) {
    console.warn(`[FCM Topic Best-Effort] Topic ${verb} failed (fallback to multicast):`, err.message);
  }

  // Return success because token is saved in tokenManager and will receive alerts directly!
  res.json({ success: true, topic: topicName });
});

/** Test endpoint to fire an instant test push notification to all devices */
app.all("/api/test-notification", async (req, res) => {
  try {
    const { getMessaging } = require("./firebase");
    const messaging = getMessaging();
    const tokenManager = require("./tokenManager");
    const tokens = tokenManager.getAllTokens();

    const isLineup = req.query.type === "lineup" || req.body?.type === "lineup";
    const title = req.query.title || req.body?.title || (isLineup ? "📋 Lineups Announced!" : "GoalZone Test ⚽");
    const body = req.query.body || req.body?.body || (isLineup ? "Real Madrid vs Barcelona starting XIs are officially out! Tap to see the lineups." : "Test notification: Push alerts are active and working!");
    const alertType = isLineup ? "LINEUP_ANNOUNCED" : "TEST_ALERT";

    const results = {
      timestamp: new Date().toISOString(),
      type: alertType,
      tokensCount: tokens.length,
      topicSent: false,
      multicastSent: false,
    };

    // 1. Send to topic
    try {
      const topicMsg = {
        topic: "popular_matches",
        notification: { title, body },
        data: { type: alertType },
        android: {
          priority: "high",
          notification: { sound: "default", channelId: "match_alerts" },
        },
      };
      const topicRes = await messaging.send(topicMsg);
      results.topicSent = true;
      results.topicResponse = topicRes;
    } catch (err) {
      results.topicError = err.message;
    }

    // 2. Send multicast directly to registered device tokens
    if (tokens.length > 0) {
      try {
        const multicastMsg = {
          tokens,
          notification: { title, body },
          data: { type: alertType },
          android: {
            priority: "high",
            notification: { sound: "default", channelId: "match_alerts" },
          },
        };
        const multiRes = await messaging.sendEachForMulticast(multicastMsg);
        results.multicastSent = true;
        results.multicastSuccess = multiRes.successCount;
        results.multicastFailure = multiRes.failureCount;

        // Prune invalid tokens
        const invalidTokens = [];
        multiRes.responses.forEach((resp, idx) => {
          if (resp.error && (
            resp.error.code === "messaging/registration-token-not-registered" ||
            resp.error.code === "messaging/invalid-registration-token"
          )) {
            invalidTokens.push(tokens[idx]);
          }
        });
        if (invalidTokens.length > 0) {
          tokenManager.removeInvalidTokens(invalidTokens);
        }
      } catch (err) {
        results.multicastError = err.message;
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/football-current-live", (req, res) => {
  const data = getCachedLiveScores();
  res.setHeader("Cache-Control", "public, max-age=15");

  // Always return cached live score matches array if populated (even if [] when 0 live matches)
  if (data && Array.isArray(data.matches)) {
    return res.json(data.matches);
  }

  // Fallback only if in-memory poller has never run on cold server startup
  const cacheKey = "current_live_matches_fallback";
  fetchAndCache(cacheKey, "/fixtures", { live: "all" }, 300, (apiResponse) => {
    const list = apiResponse.response || [];
    return list.map((item) => ({
      id: String(item.fixture.id),
      league: item.league.name,
      leagueId: String(item.league.id),
      leagueLogo: item.league.logo,
      home: {
        id: item.teams.home.id,
        name: item.teams.home.name,
        short:
          item.teams.home.code ||
          item.teams.home.name.substring(0, 3).toUpperCase(),
        logo: item.teams.home.logo,
      },
      away: {
        id: item.teams.away.id,
        name: item.teams.away.name,
        short:
          item.teams.away.code ||
          item.teams.away.name.substring(0, 3).toUpperCase(),
        logo: item.teams.away.logo,
      },
      score: `${item.goals.home ?? 0} - ${item.goals.away ?? 0}`,
      minute: item.fixture.status.elapsed
        ? (() => {
            const el = item.fixture.status.elapsed;
            const ex = item.fixture.status.extra != null ? parseInt(item.fixture.status.extra, 10) : null;
            const st = item.fixture.status.short;
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
        : item.fixture.status.short,
      status: (() => {
        const el = item.fixture?.status?.elapsed;
        const ex = item.fixture?.status?.extra != null ? parseInt(item.fixture.status.extra, 10) : null;
        const st = item.fixture?.status?.short;
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
      extra: item.fixture.status.extra ?? null,
    }));
  })
    .then((data) => res.json(data))
    .catch((err) =>
      res
        .status(500)
        .json({ error: "Failed to fetch live matches", message: err.message }),
    );
});

// ==========================================
// 2. POPULAR LEAGUES (curated top leagues)
// ==========================================
const popularLeagues = [
  // ── England ──
  { leagueId: "39",  leagueName: "Premier League",      country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/39.png" },
  { leagueId: "45",  leagueName: "FA Cup",              country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/45.png" },
  { leagueId: "48",  leagueName: "League Cup",          country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/48.png" },
  { leagueId: "528", leagueName: "Community Shield",    country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/528.png" },
  { leagueId: "40",  leagueName: "Championship",        country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/40.png" },

  // ── Spain ──
  { leagueId: "140", leagueName: "La Liga",              country: "Spain",    leagueLogo: "https://media.api-sports.io/football/leagues/140.png" },
  { leagueId: "143", leagueName: "Copa del Rey",         country: "Spain",    leagueLogo: "https://media.api-sports.io/football/leagues/143.png" },
  { leagueId: "556", leagueName: "Supercopa de España",  country: "Spain",    leagueLogo: "https://media.api-sports.io/football/leagues/556.png" },
  { leagueId: "141", leagueName: "Segunda División",     country: "Spain",    leagueLogo: "https://media.api-sports.io/football/leagues/141.png" },

  // ── Italy ──
  { leagueId: "135", leagueName: "Serie A",              country: "Italy",    leagueLogo: "https://media.api-sports.io/football/leagues/135.png" },
  { leagueId: "137", leagueName: "Coppa Italia",         country: "Italy",    leagueLogo: "https://media.api-sports.io/football/leagues/137.png" },
  { leagueId: "547", leagueName: "Supercoppa Italiana",  country: "Italy",    leagueLogo: "https://media.api-sports.io/football/leagues/547.png" },
  { leagueId: "136", leagueName: "Serie B",              country: "Italy",    leagueLogo: "https://media.api-sports.io/football/leagues/136.png" },

  // ── Germany ──
  { leagueId: "78",  leagueName: "Bundesliga",           country: "Germany",  leagueLogo: "https://media.api-sports.io/football/leagues/78.png" },
  { leagueId: "81",  leagueName: "DFB Pokal",            country: "Germany",  leagueLogo: "https://media.api-sports.io/football/leagues/81.png" },
  { leagueId: "529", leagueName: "DFL-Supercup",         country: "Germany",  leagueLogo: "https://media.api-sports.io/football/leagues/529.png" },
  { leagueId: "79",  leagueName: "2. Bundesliga",        country: "Germany",  leagueLogo: "https://media.api-sports.io/football/leagues/79.png" },

  // ── France ──
  { leagueId: "61",  leagueName: "Ligue 1",              country: "France",   leagueLogo: "https://media.api-sports.io/football/leagues/61.png" },
  { leagueId: "66",  leagueName: "Coupe de France",      country: "France",   leagueLogo: "https://media.api-sports.io/football/leagues/66.png" },
  { leagueId: "526", leagueName: "Trophée des Champions",country: "France",   leagueLogo: "https://media.api-sports.io/football/leagues/526.png" },
  { leagueId: "62",  leagueName: "Ligue 2",              country: "France",   leagueLogo: "https://media.api-sports.io/football/leagues/62.png" },

  // ── Brazil ──
  { leagueId: "71",  leagueName: "Brasileirão Série A",  country: "Brazil",   leagueLogo: "https://media.api-sports.io/football/leagues/71.png" },
  { leagueId: "73",  leagueName: "Copa do Brasil",       country: "Brazil",   leagueLogo: "https://media.api-sports.io/football/leagues/73.png" },
  { leagueId: "632", leagueName: "Supercopa do Brasil",  country: "Brazil",   leagueLogo: "https://media.api-sports.io/football/leagues/632.png" },
  { leagueId: "72",  leagueName: "Brasileirão Série B",  country: "Brazil",   leagueLogo: "https://media.api-sports.io/football/leagues/72.png" },

  // ── USA ──
  { leagueId: "253", leagueName: "MLS",                  country: "USA",      leagueLogo: "https://media.api-sports.io/football/leagues/253.png" },
  { leagueId: "257", leagueName: "US Open Cup",          country: "USA",      leagueLogo: "https://media.api-sports.io/football/leagues/257.png" },
  { leagueId: "772", leagueName: "Leagues Cup",          country: "USA",      leagueLogo: "https://media.api-sports.io/football/leagues/772.png" },

  // ── Middle East & Saudi Arabia ──
  { leagueId: "307", leagueName: "Saudi Pro League",     country: "Saudi Arabia", leagueLogo: "https://media.api-sports.io/football/leagues/307.png" },
  { leagueId: "504", leagueName: "King Cup of Champions",country: "Saudi Arabia", leagueLogo: "https://media.api-sports.io/football/leagues/504.png" },
  { leagueId: "826", leagueName: "Saudi Super Cup",      country: "Saudi Arabia", leagueLogo: "https://media.api-sports.io/football/leagues/826.png" },

  // ── Europe & International ──
  { leagueId: "2",   leagueName: "UEFA Champions League",country: "UEFA",     leagueLogo: "https://media.api-sports.io/football/leagues/2.png" },
  { leagueId: "3",   leagueName: "UEFA Europa League",   country: "UEFA",     leagueLogo: "https://media.api-sports.io/football/leagues/3.png" },
  { leagueId: "848", leagueName: "UEFA Conference League",country: "UEFA",    leagueLogo: "https://media.api-sports.io/football/leagues/848.png" },
  { leagueId: "5",   leagueName: "UEFA Nations League",  country: "UEFA",     leagueLogo: "https://media.api-sports.io/football/leagues/5.png" },
  { leagueId: "17",  leagueName: "AFC Champions League Elite", country: "Asia",   leagueLogo: "https://media.api-sports.io/football/leagues/17.png" },
  { leagueId: "18",  leagueName: "AFC Champions League Two",   country: "Asia",   leagueLogo: "https://media.api-sports.io/football/leagues/18.png" },
  { leagueId: "13",  leagueName: "Copa Libertadores",    country: "South America", leagueLogo: "https://media.api-sports.io/football/leagues/13.png" },
  { leagueId: "88",  leagueName: "Eredivisie",           country: "Netherlands", leagueLogo: "https://media.api-sports.io/football/leagues/88.png" },
  { leagueId: "94",  leagueName: "Primeira Liga",        country: "Portugal", leagueLogo: "https://media.api-sports.io/football/leagues/94.png" },
  { leagueId: "128", leagueName: "Liga Profesional",     country: "Argentina",leagueLogo: "https://media.api-sports.io/football/leagues/128.png" },
];

app.get("/football-popular-leagues", (req, res) => {
  res.json(popularLeagues);
});

const popularTeams = [
  // International Teams
  {
    id: "8066",
    name: "Argentina",
    category: "International Teams",
    country: "Argentina",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8066.png",
  },
  {
    id: "8550",
    name: "Brazil",
    category: "International Teams",
    country: "Brazil",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8550.png",
  },
  {
    id: "8490",
    name: "France",
    category: "International Teams",
    country: "France",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8490.png",
  },
  {
    id: "8489",
    name: "England",
    category: "International Teams",
    country: "England",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8489.png",
  },
  {
    id: "8205",
    name: "Portugal",
    category: "International Teams",
    country: "Portugal",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8205.png",
  },
  {
    id: "8322",
    name: "Spain",
    category: "International Teams",
    country: "Spain",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8322.png",
  },
  {
    id: "8141",
    name: "Germany",
    category: "International Teams",
    country: "Germany",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8141.png",
  },
  {
    id: "8142",
    name: "Italy",
    category: "International Teams",
    country: "Italy",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8142.png",
  },
  {
    id: "8145",
    name: "Netherlands",
    category: "International Teams",
    country: "Netherlands",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8145.png",
  },
  {
    id: "8256",
    name: "Belgium",
    category: "International Teams",
    country: "Belgium",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8256.png",
  },
  {
    id: "8514",
    name: "Croatia",
    category: "International Teams",
    country: "Croatia",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8514.png",
  },
  {
    id: "8492",
    name: "Uruguay",
    category: "International Teams",
    country: "Uruguay",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8492.png",
  },
  {
    id: "8093",
    name: "Morocco",
    category: "International Teams",
    country: "Morocco",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8093.png",
  },
  {
    id: "8143",
    name: "Japan",
    category: "International Teams",
    country: "Japan",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8143.png",
  },

  // Club Teams
  {
    id: "8633",
    name: "Real Madrid",
    category: "Club Teams",
    country: "Spain",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png",
  },
  {
    id: "8634",
    name: "FC Barcelona",
    category: "Club Teams",
    country: "Spain",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8634.png",
  },
  {
    id: "8457",
    name: "Manchester City",
    category: "Club Teams",
    country: "England",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8457.png",
  },
  {
    id: "8455",
    name: "Chelsea",
    category: "Club Teams",
    country: "England",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png",
  },
  {
    id: "9825",
    name: "Arsenal",
    category: "Club Teams",
    country: "England",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9825.png",
  },
  {
    id: "8650",
    name: "Liverpool",
    category: "Club Teams",
    country: "England",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8650.png",
  },
  {
    id: "9823",
    name: "Bayern Munich",
    category: "Club Teams",
    country: "Germany",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9823.png",
  },
  {
    id: "9847",
    name: "Paris Saint-Germain",
    category: "Club Teams",
    country: "France",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9847.png",
  },
  {
    id: "9885",
    name: "Juventus",
    category: "Club Teams",
    country: "Italy",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9885.png",
  },
  {
    id: "8636",
    name: "Inter Milan",
    category: "Club Teams",
    country: "Italy",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8636.png",
  },
  {
    id: "102643",
    name: "Al Nassr",
    category: "Club Teams",
    country: "Saudi Arabia",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/102643.png",
  },
  {
    id: "102534",
    name: "Inter Miami CF",
    category: "Club Teams",
    country: "USA",
    logo: "https://images.fotmob.com/image_resources/logo/teamlogo/102534.png",
  },
];

app.get("/football-get-popular-teams", (req, res) => {
  res.json(popularTeams);
});

function sanitizeFixturesStatus(data) {
  if (!Array.isArray(data)) return data;
  return data.map((item) => {
    if (!item) return item;
    const stUpper = String(item.status || "").trim().toUpperCase();
    const minUpper = String(item.minute || "").trim().toUpperCase();
    if (stUpper === "FT" || stUpper === "AET" || stUpper === "PEN") return item;

    // Check dynamic extra time in minute string or extra field
    const bracketMatch = minUpper.match(/[\(\[]\+?(\d+)[\)\]]/);
    const bracketExtra = bracketMatch ? parseInt(bracketMatch[1], 10) : null;
    const propExtra = item.extra != null ? parseInt(item.extra, 10) : null;
    const plusMatch = minUpper.match(/\+(\d+)/);
    const plusExtra = plusMatch ? parseInt(plusMatch[1], 10) : null;
    const targetExtra = bracketExtra || propExtra || plusExtra;
    const elapsedExtra = plusExtra || 0;

    // Dynamic completion: if elapsed extra time >= target extra time
    if (targetExtra && elapsedExtra >= targetExtra) {
      if (stUpper === "2H" || minUpper.startsWith("90")) {
        return { ...item, status: "FT", minute: "FT" };
      }
      if (stUpper === "1H" || minUpper.startsWith("45")) {
        return { ...item, status: "HT", minute: "HT" };
      }
    }

    const ts = item.timestamp || (item.date ? Math.floor(new Date(item.date).getTime() / 1000) : null);
    const minsSinceKO = ts ? (Date.now() - ts * 1000) / 60000 : null;

    if (minsSinceKO !== null && minsSinceKO >= 115) {
      if (stUpper === "2H" || stUpper === "1H" || stUpper === "LIVE" || minUpper.includes("+") || minUpper.includes("'")) {
        return {
          ...item,
          status: "FT",
          minute: "FT",
        };
      }
    }
    if (minsSinceKO !== null && minsSinceKO >= 55 && minsSinceKO < 75 && stUpper === "1H") {
      return {
        ...item,
        status: "HT",
        minute: "HT",
      };
    }
    return item;
  });
}

// ==========================================
// 2.1 AGGREGATED DASHBOARD ENDPOINT
// ==========================================
app.get("/football-dashboard", async (req, res) => {
  const dateQuery = req.query.date || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  
  // 1. Get latest live matches from liveScoreManager / shared cache
  let live = [];
  const liveScoreData = getCachedLiveScores();
  if (liveScoreData && Array.isArray(liveScoreData.matches) && liveScoreData.matches.length > 0) {
    live = liveScoreData.matches;
  } else {
    const fallback = cache.get("current_live_matches_fallback");
    if (Array.isArray(fallback) && fallback.length > 0) {
      live = fallback;
    }
  }

  // Filter out any matches that have exceeded regular match duration (115+ mins since kickoff)
  live = (live || []).filter((m) => {
    const ts = m.timestamp;
    const diff = ts ? (Date.now() - ts * 1000) / 60000 : null;
    return diff === null || diff < 115;
  });

  try {
    // 2. Fixtures by date
    // IMPORTANT: Use the SAME cache key as /football-get-matches-by-date (Asia/Dhaka timezone)
    // so both screens share one cached list. The sync engine keeps today's list fresh and
    // patches live scores into it, so the payload is built on every request (it is cheap)
    // instead of being cached separately and going stale.
    const formattedDate = `${dateQuery.substring(0, 4)}-${dateQuery.substring(4, 6)}-${dateQuery.substring(6, 8)}`;
    const DEFAULT_TZ = "Asia/Dhaka";
    const fixturesCacheKey = `fixtures_date_${dateQuery}_${DEFAULT_TZ.replace(/\//g, "_")}`;
    const fixtures = await fetchAndCache(
      fixturesCacheKey,
      "/fixtures",
      { date: formattedDate, timezone: DEFAULT_TZ },
      getFixtureTtlByDate(dateQuery),
      mapDateFixtures,
    );

    const payload = {
      live: sanitizeFixturesStatus(live),
      leagues: popularLeagues,
      fixtures: sanitizeFixturesStatus(fixtures || []),
      teams: popularTeams,
    };

    res.setHeader("Cache-Control", "public, max-age=15");
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: "Failed to load dashboard data", message: err.message });
  }
});

// ==========================================
// SMART DATE-AWARE TTL HELPER
// ==========================================
/**
 * Returns the appropriate cache TTL based on whether the date is in the past, today, or future.
 *
 * Past dates   : 7 days  (604800s) — results are final, never change again
 * Today        : 50 min  (3000s)   — live updates needed during match day
 * Future dates : 6 hours (21600s)  — schedule can change but rarely does
 *
 * This saves significant quota: a user browsing back through last week's
 * matches will only ever trigger ONE API call per past date — ever.
 */
function getFixtureTtlByDate(dateQuery) {
  // dateQuery format: "YYYYMMDD"
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // "YYYYMMDD"

  if (dateQuery < todayStr) {
    return 7 * 24 * 60 * 60; // Past: 7 days — results are permanent
  } else if (dateQuery === todayStr) {
    return 7200;              // Today: 2 hours (saves 60% quota while keeping today fresh)
  } else {
    return 24 * 60 * 60;     // Future: 24 hours — schedule rarely changes
  }
}

// ==========================================
// 3. MATCHES BY DATE
// ==========================================
app.get("/football-get-matches-by-date", async (req, res) => {
  const dateQuery = req.query.date;
  // Always use Asia/Dhaka timezone for unified caching across all user devices
  const timezone = "Asia/Dhaka";
  if (!dateQuery || dateQuery.length !== 8) {
    return res
      .status(400)
      .json({ error: "Invalid date format. Expected YYYYMMDD" });
  }

  const formattedDate = `${dateQuery.substring(0, 4)}-${dateQuery.substring(4, 6)}-${dateQuery.substring(6, 8)}`;
  const cacheKey = `fixtures_date_${dateQuery}_Asia_Dhaka`;
  // Smart TTL: past=7 days, today=50 min, future=6 hours
  const ttl = getFixtureTtlByDate(dateQuery);

  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures",
      { date: formattedDate, timezone },
      ttl,
      mapDateFixtures,
    );

    res.json(sanitizeFixturesStatus(data));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch matches by date", message: err.message });
  }
});

app.get("/football-get-fixtures-by-league", async (req, res) => {
  const leagueid = req.query.leagueid;
  if (!leagueid) {
    return res.status(400).json({ error: "Missing leagueid parameter" });
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const cacheKey = `fixtures_league_${leagueid}_${todayStr}`;

  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures",
      { league: leagueid, next: 10 },
      86400, // 24 hours cache (previously 30 min)
      mapLeagueFixtures,
    );

    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch league fixtures", message: err.message });
  }
});

// /fixtures?team= → one fixture row as the team screen uses it
function mapTeamFixture(item, teamid) {
  const fixtureDate = item.fixture.date ? new Date(item.fixture.date) : new Date();
  const time = fixtureDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = `${String(fixtureDate.getDate()).padStart(2, "0")}/${String(fixtureDate.getMonth() + 1).padStart(2, "0")}`;
  const isHome = String(item.teams.home.id) === String(teamid);
  const opponent = isHome ? item.teams.away : item.teams.home;
  const hasScore = item.goals?.home !== null && item.goals?.home !== undefined;

  return {
    id: String(item.fixture.id),
    status: item.fixture.status.short || "NS",
    time,
    date,
    rawDate: item.fixture.date,
    timestamp: item.fixture.timestamp,
    isHome,
    opponent: opponent.name,
    opponentLogo: opponent.logo,
    score: hasScore ? `${item.goals.home} - ${item.goals.away}` : "VS",
    league: item.league?.name || "",
    leagueId: item.league?.id ? String(item.league.id) : "",
    leagueLogo: item.league?.logo || "",
    home: { id: item.teams.home.id, name: item.teams.home.name, logo: item.teams.home.logo },
    away: { id: item.teams.away.id, name: item.teams.away.name, logo: item.teams.away.logo },
  };
}

app.get("/football-get-fixtures-by-team", async (req, res) => {
  const teamid = req.query.teamid;
  if (!teamid) {
    return res.status(400).json({ error: "Missing teamid parameter" });
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const mapList = (apiResponse) => (apiResponse.response || []).map((item) => mapTeamFixture(item, teamid));

  try {
    // Upcoming matches plus the last few results: national teams often have nothing scheduled
    const [upcoming, results] = await Promise.all([
      // v2: adds home/away team objects, league info and score
      fetchAndCache(`fixtures_team_v2_${teamid}_${todayStr}`, "/fixtures", { team: teamid, next: 20 }, 86400, mapList),
      fetchAndCache(`results_team_${teamid}_${todayStr}`, "/fixtures", { team: teamid, last: 5 }, 86400, mapList)
        .catch(() => []),
    ]);
    const seen = new Set(upcoming.map((m) => m.id));
    res.json([
      ...upcoming,
      ...results.filter((m) => !seen.has(m.id)).sort((a, b) => b.timestamp - a.timestamp),
    ]);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch team fixtures", message: err.message });
  }
});

app.get("/football-get-team-squad", async (req, res) => {
  const teamid = req.query.teamid;
  if (!teamid) {
    return res.status(400).json({ error: "Missing teamid parameter" });
  }

  // v2: players are objects (name, number, age, photo) instead of plain names
  const cacheKey = `squad_v2_team_${teamid}`;

  try {
    const data = await fetchAndCache(
      cacheKey,
      "/players/squads",
      { team: teamid },
      86400,
      (apiResponse) => {
        const list = apiResponse.response || [];
        if (list.length === 0) return [];

        const players = list[0].players || [];
        const positions = {
          Goalkeepers: [],
          Defenders: [],
          Midfielders: [],
          Forwards: [],
        };

        players.forEach((p) => {
          const player = {
            id: p.id,
            name: p.name,
            number: p.number ?? null,
            age: p.age ?? null,
            photo: p.photo || (p.id ? `https://media.api-sports.io/football/players/${p.id}.png` : null),
          };
          const pos = p.position;
          if (pos === "Goalkeeper") positions.Goalkeepers.push(player);
          else if (pos === "Defender") positions.Defenders.push(player);
          else if (pos === "Midfielder") positions.Midfielders.push(player);
          else if (pos === "Attacker") positions.Forwards.push(player);
        });

        return Object.keys(positions).map((pos) => ({
          position: pos,
          players: positions[pos],
        }));
      },
    );

    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch team squad", message: err.message });
  }
});

app.get("/football-find-team-by-country", async (req, res) => {
  const country = req.query.country;
  if (!country) {
    return res.status(400).json({ error: "Missing country parameter" });
  }

  const cacheKey = `find_team_${country}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/teams",
      { name: country, country: country },
      86400,
      (apiResponse) => {
        const teams = apiResponse.response || [];
        const nationalTeam = teams.find((t) => t.team.national === true);
        if (nationalTeam) {
          return {
            id: String(nationalTeam.team.id),
            name: nationalTeam.team.name,
            logo: nationalTeam.team.logo,
          };
        }
        return null;
      },
    );
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to find team", message: err.message });
  }
});

// ==========================================
// 4. LINEUPS HELPERS & ADAPTERS
// ==========================================
const translateLineup = (apiResponse, side) => {
  const list = apiResponse.response || [];
  if (list.length === 0) {
    console.log(`[Lineup] No lineup data from API for side: ${side}. Response length: 0`);
    return { teamName: "", formation: "", starters: [], startXI: [], subs: [], substitutes: [] };
  }

  const idx = side === "home" ? 0 : 1;
  const apiLineup = list[idx];
  if (!apiLineup) {
    console.log(`[Lineup] No lineup entry at index ${idx} for side: ${side}`);
    return { teamName: "", formation: "", starters: [], startXI: [], subs: [], substitutes: [] };
  }

  const starters = apiLineup.startXI || [];
  const subs = apiLineup.substitutes || [];

  const rowPlayersMap = {};
  starters.forEach((item) => {
    const p = item.player;
    const grid = p.grid || "";
    const [rowStr, colStr] = grid.split(":");
    const row = parseInt(rowStr, 10) || 1;
    const col = parseInt(colStr, 10) || 1;

    if (!rowPlayersMap[row]) {
      rowPlayersMap[row] = [];
    }
    rowPlayersMap[row].push({ player: p, col });
  });

  const maxRow = Math.max(...Object.keys(rowPlayersMap).map(Number), 4);

  const mappedStarters = starters.map((item) => {
    const p = item.player;
    const grid = p.grid || "";
    const [rowStr, colStr] = grid.split(":");
    const row = parseInt(rowStr, 10) || 1;
    const col = parseInt(colStr, 10) || 1;

    const rowPlayers = rowPlayersMap[row] || [];
    rowPlayers.sort((a, b) => a.col - b.col);
    const count = rowPlayers.length;
    const index = rowPlayers.findIndex((pr) => pr.player.id === p.id);

    let y = 0.5;
    if (maxRow > 1) {
      y = 0.1 + (row - 1) * (0.75 / (maxRow - 1));
    } else {
      y = 0.1;
    }

    let x = 0.5;
    if (count > 1) {
      x = 0.1 + index * (0.8 / (count - 1));
    } else {
      x = 0.5;
    }

    return {
      id: p.id,
      name: p.name,
      shirtNumber: String(p.number || ""),
      grid: p.grid || null,
      row,
      col,
      pos: p.pos || null,
      photo: p.photo || (p.id ? `https://media.api-sports.io/football/players/${p.id}.png` : null),
      verticalLayout: { x, y },
    };
  });

  const mappedSubs = subs.map((item) => {
    const p = item.player;
    return {
      id: p.id,
      name: p.name,
      shirtNumber: String(p.number || ""),
      pos: p.pos || null,
      photo: p.photo || (p.id ? `https://media.api-sports.io/football/players/${p.id}.png` : null),
    };
  });

  return {
    teamName: apiLineup.team.name,
    formation: apiLineup.formation || "N/A",
    starters: mappedStarters,
    startXI: mappedStarters,
    subs: mappedSubs,
    substitutes: mappedSubs,
    lineup: {
      id: apiLineup.team.id,
      name: apiLineup.team.name,
      teamName: apiLineup.team.name,
      formation: apiLineup.formation || "N/A",
      starters: mappedStarters,
      startXI: mappedStarters,
      subs: mappedSubs,
      substitutes: mappedSubs,
    },
  };
};

function getMockLineup(eventid, side) {
  const isHome = side === "home";
  if (isHome) {
    return {
      lineup: {
        id: 9991,
        name: "Home Team",
        formation: "4-4-2",
        starters: [
          {
            id: 501,
            name: "Goalkeeper H",
            shirtNumber: "1",
            verticalLayout: { x: 0.5, y: 0.9 },
          },
          {
            id: 502,
            name: "Defender HL",
            shirtNumber: "3",
            verticalLayout: { x: 0.15, y: 0.7 },
          },
          {
            id: 503,
            name: "Defender HC1",
            shirtNumber: "4",
            verticalLayout: { x: 0.38, y: 0.75 },
          },
          {
            id: 504,
            name: "Defender HC2",
            shirtNumber: "5",
            verticalLayout: { x: 0.62, y: 0.75 },
          },
          {
            id: 505,
            name: "Defender HR",
            shirtNumber: "2",
            verticalLayout: { x: 0.85, y: 0.7 },
          },
          {
            id: 506,
            name: "Midfielder HL",
            shirtNumber: "6",
            verticalLayout: { x: 0.15, y: 0.45 },
          },
          {
            id: 507,
            name: "Midfielder HC1",
            shirtNumber: "8",
            verticalLayout: { x: 0.38, y: 0.45 },
          },
          {
            id: 508,
            name: "Midfielder HC2",
            shirtNumber: "10",
            verticalLayout: { x: 0.62, y: 0.45 },
          },
          {
            id: 509,
            name: "Midfielder HR",
            shirtNumber: "7",
            verticalLayout: { x: 0.85, y: 0.45 },
          },
          {
            id: 510,
            name: "Forward HL",
            shirtNumber: "9",
            verticalLayout: { x: 0.35, y: 0.2 },
          },
          {
            id: 511,
            name: "Forward HR",
            shirtNumber: "11",
            verticalLayout: { x: 0.65, y: 0.2 },
          },
        ],
        subs: [
          { id: 512, name: "Substitute H1", shirtNumber: "12" },
          { id: 513, name: "Substitute H2", shirtNumber: "14" },
        ],
      },
    };
  } else {
    return {
      lineup: {
        id: 9992,
        name: "Away Team",
        formation: "4-3-3",
        starters: [
          {
            id: 601,
            name: "Goalkeeper A",
            shirtNumber: "1",
            verticalLayout: { x: 0.5, y: 0.9 },
          },
          {
            id: 602,
            name: "Defender AL",
            shirtNumber: "3",
            verticalLayout: { x: 0.15, y: 0.7 },
          },
          {
            id: 603,
            name: "Defender AC1",
            shirtNumber: "4",
            verticalLayout: { x: 0.38, y: 0.75 },
          },
          {
            id: 604,
            name: "Defender AC2",
            shirtNumber: "5",
            verticalLayout: { x: 0.62, y: 0.75 },
          },
          {
            id: 605,
            name: "Defender AR",
            shirtNumber: "2",
            verticalLayout: { x: 0.85, y: 0.7 },
          },
          {
            id: 606,
            name: "Midfielder AL",
            shirtNumber: "8",
            verticalLayout: { x: 0.25, y: 0.45 },
          },
          {
            id: 607,
            name: "Midfielder AC",
            shirtNumber: "6",
            verticalLayout: { x: 0.5, y: 0.5 },
          },
          {
            id: 608,
            name: "Midfielder AR",
            shirtNumber: "10",
            verticalLayout: { x: 0.75, y: 0.45 },
          },
          {
            id: 609,
            name: "Forward AL",
            shirtNumber: "7",
            verticalLayout: { x: 0.2, y: 0.2 },
          },
          {
            id: 610,
            name: "Forward AC",
            shirtNumber: "9",
            verticalLayout: { x: 0.5, y: 0.15 },
          },
          {
            id: 611,
            name: "Forward AR",
            shirtNumber: "11",
            verticalLayout: { x: 0.8, y: 0.2 },
          },
        ],
        subs: [
          { id: 612, name: "Substitute A1", shirtNumber: "12" },
          { id: 613, name: "Substitute A2", shirtNumber: "14" },
        ],
      },
    };
  }
}

async function getRawFixtureLineups(eventid, force = false) {
  const cacheKey = `lineup_raw_fixture_${eventid}`;
  if (force) {
    cache.clear(cacheKey);
  }
  return fetchAndCache(
    cacheKey,
    "/fixtures/lineups",
    { fixture: eventid },
    86400,
    (apiResponse) => apiResponse
  );
}

app.get("/football-get-hometeam-lineup", async (req, res) => {
  const eventid = req.query.eventid;
  const force = req.query.force === "true" || req.query.refresh === "true";
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (!/^\d+$/.test(eventid)) {
    return res.json(getMockLineup(eventid, "home"));
  }

  try {
    const rawData = await getRawFixtureLineups(eventid, force);
    const data = translateLineup(rawData, "home");
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch home team lineup",
      message: err.message,
    });
  }
});

app.get("/football-get-awayteam-lineup", async (req, res) => {
  const eventid = req.query.eventid;
  const force = req.query.force === "true" || req.query.refresh === "true";
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (!/^\d+$/.test(eventid)) {
    return res.json(getMockLineup(eventid, "away"));
  }

  try {
    const rawData = await getRawFixtureLineups(eventid, force);
    const data = translateLineup(rawData, "away");
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch away team lineup",
      message: err.message,
    });
  }
});

// ==========================================
// 5. STANDINGS TABLE
// ==========================================
app.get("/football-get-standing-all", async (req, res) => {
  const leagueid = req.query.leagueid;
  if (!leagueid || leagueid === "undefined" || leagueid === "null") {
    return res
      .status(400)
      .json({ error: "Missing or invalid leagueid parameter" });
  }

  const currentYear = new Date().getFullYear();

  // Season that worked last time for this league (kept up to date by the sync engine)
  const bestSeasonKey = `standings_best_season_${leagueid}`;
  const bestSeason = cache.getEntry(bestSeasonKey)?.data;
  const seasonsToTry = [...new Set([bestSeason, currentYear, currentYear - 1].filter(Boolean))];

  let lastError = null;

  for (const season of seasonsToTry) {
    // v2: rows also carry win/draw/lose, form and qualification zone
    const cacheKey = `standings_v3_${leagueid}_${season}`;
    try {
      const data = await fetchAndCache(
        cacheKey,
        "/standings",
        { league: leagueid, season },
        86400, // 24 hours cache (previously 4 hours)
        mapStandings,
      );

      if (Array.isArray(data) && data.length > 0) {
        // Remember which season worked
        if (season !== bestSeason) cache.set(bestSeasonKey, season, 7 * 24 * 3600);
        return res.json(data);
      }
      // Empty table: the season may not have started yet, try the previous one
    } catch (err) {
      lastError = err;
      if (
        err.message &&
        (err.message.includes("plan") ||
          err.message.includes("plans") ||
          err.message.includes("access"))
      ) {
        continue;
      }
      break; // Non-plan error — stop retrying immediately
    }
  }

  if (!lastError) return res.json([]);
  res
    .status(500)
    .json({ error: "Failed to fetch standings", message: lastError?.message });
});

// ==========================================
// 6. MATCH LOCATION & COUNTRIES
// ==========================================
app.get("/football-get-match-location", async (req, res) => {
  const eventid = req.query.eventid;
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (!/^\d+$/.test(String(eventid))) {
    return res.json({ venue: "", city: "", round: "" });
  }

  // v2: entries now also carry the round (older entries only had venue/city)
  const cacheKey = `location_v2_${eventid}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures",
      { id: eventid },
      86400,
      (apiResponse) => mapLocation((apiResponse.response || [])[0]),
    );

    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch match location", message: err.message });
  }
});

// ==========================================
// 6.1 PLAYER RATINGS
// ==========================================
// Ratings move during a live match, so unlike fetchAndCache this refetches once the
// entry goes stale and only falls back to the stale copy when the API call fails.
app.get("/football-get-player-ratings", async (req, res) => {
  const eventid = req.query.eventid;
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (!/^\d+$/.test(String(eventid))) {
    return res.json([]);
  }

  const finished = req.query.finished === "true";
  if (req.query.upcoming === "true") {
    return res.json([]);
  }
  const cacheKey = `player_ratings_${eventid}`;
  const entry = cache.getEntry(cacheKey);
  if (entry && !entry.stale) {
    return res.json(entry.data);
  }

  try {
    const data = await requestFromApi(
      cacheKey,
      "/fixtures/players",
      { fixture: eventid },
      finished ? 86400 : 120, // final ratings never change; live ones every couple of minutes
      mapPlayerRatings,
    );
    res.json(data);
  } catch (err) {
    if (entry) return res.json(entry.data);
    if (err.isQuotaError) return res.json([]);
    res.status(500).json({
      error: "Failed to fetch player ratings",
      message: err.message,
    });
  }
});

// ==========================================
// 6.2 COMMUNITY PREDICTIONS ("Who will win?")
// ==========================================
app.get("/football-get-match-prediction", async (req, res) => {
  const { eventid, deviceId } = req.query;
  if (!predictionStore.isValidMatchId(eventid)) {
    return res.status(400).json({ error: "Missing or invalid eventid parameter" });
  }

  try {
    const tally = await predictionStore.getTally(
      eventid,
      predictionStore.isValidDeviceId(deviceId) ? deviceId : null,
    );
    res.json(tally);
  } catch (err) {
    res.status(500).json({ error: "Failed to load predictions", message: err.message });
  }
});

app.post("/football-match-prediction", async (req, res) => {
  const { eventid, deviceId, choice } = req.body || {};
  if (!predictionStore.isValidMatchId(eventid)) {
    return res.status(400).json({ error: "Missing or invalid eventid" });
  }
  if (!predictionStore.isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: "Missing or invalid deviceId" });
  }
  if (!predictionStore.isValidChoice(choice)) {
    return res.status(400).json({ error: "choice must be one of home, draw, away" });
  }

  try {
    const tally = await predictionStore.castVote(eventid, deviceId, choice);
    res.json(tally);
  } catch (err) {
    res.status(500).json({ error: "Failed to save prediction", message: err.message });
  }
});

app.get("/football-get-all-countries", async (req, res) => {
  const cacheKey = "all_countries";
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/countries",
      {},
      86400,
      (apiResponse) => {
        return apiResponse.response || [];
      },
    );
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch countries list", message: err.message });
  }
});

// ==========================================
// 7. FOOTBALL NEWS RSS
// ==========================================
// Decodes the HTML entities RSS/Atom feeds put in titles ("&quot;", "&#39;", "&amp;")
const decodeEntities = (text) =>
  String(text || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

// "Mon, 12 Oct 2026 16:35:00 BST" → ISO. Neither V8 nor Hermes parse zone names like "BST".
const RSS_ZONES = { GMT: "+0000", UTC: "+0000", BST: "+0100", CET: "+0100", CEST: "+0200" };
function rssDateToIso(value) {
  const m = String(value || "").match(/(\d{1,2}) (\w{3}) (\d{4}) (\d{2}):(\d{2})(?::(\d{2}))? ?([+-]\d{4}|[A-Z]{2,4})?/);
  if (!m) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months.indexOf(m[2]);
  if (month < 0) return "";
  const zone = /^[+-]/.test(m[7] || "") ? m[7] : RSS_ZONES[m[7]] || "+0000";
  const offsetMin = (zone[0] === "-" ? -1 : 1) * (parseInt(zone.slice(1, 3), 10) * 60 + parseInt(zone.slice(3), 10));
  const utc = Date.UTC(+m[3], month, +m[1], +m[4], +m[5], +(m[6] || 0)) - offsetMin * 60000;
  return new Date(utc).toISOString();
}

app.get("/football-get-news", async (req, res) => {
  // v2: Sky Sports football feed (11095); the old feed (12040) was all sports
  const cacheKey = "football_news_v2";
  const entry = cache.getEntry(cacheKey);
  if (entry && !entry.stale) {
    return res.json(entry.data);
  }

  try {
    const response = await axios.get("https://www.skysports.com/rss/11095", {
      headers: {
        Accept: "application/xml, text/xml, */*",
      },
    });

    const xmlText = response.data;
    if (typeof xmlText !== "string") {
      throw new Error("Invalid RSS response type");
    }

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];

      const title =
        itemXml
          .match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]
          ?.trim() || "";
      const link =
        itemXml
          .match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1]
          ?.trim() || "";
      let description =
        itemXml
          .match(
            /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/,
          )?.[1]
          ?.trim() || "";
      description = decodeEntities(description.replace(/<[^>]*>/g, ""));
      const pubDate =
        itemXml
          .match(
            /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/,
          )?.[1]
          ?.trim() || "";

      let thumbnail =
        "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500";
      const enclosureMatch = itemXml.match(
        /<enclosure[^>]+url=["']([^"']+)["']/,
      );
      const mediaContentMatch = itemXml.match(
        /<media:content[^>]+url=["']([^"']+)["']/,
      );

      if (enclosureMatch && enclosureMatch[1]) {
        thumbnail = enclosureMatch[1];
      } else if (mediaContentMatch && mediaContentMatch[1]) {
        thumbnail = mediaContentMatch[1];
      }

      items.push({
        id: link || Math.random().toString(),
        title: decodeEntities(title),
        published: rssDateToIso(pubDate),
        description,
        thumbnail,
        date: pubDate,
        link,
      });
    }

    cache.set(cacheKey, items, 600);
    res.json(items);
  } catch (err) {
    // Sky Sports unreachable: keep serving the last news we had
    if (entry) return res.json(entry.data);
    res
      .status(500)
      .json({ error: "Failed to fetch football news", message: err.message });
  }
});

// ==========================================
// 7.1 VIDEO HIGHLIGHTS (official YouTube channels)
// ==========================================
// YouTube's public per-channel Atom feeds: no API key or quota, ~15 latest uploads each
const HIGHLIGHT_CHANNELS = [
  { id: "UCG5qGWdu8nIRZqJ_GgDwQ-w", competition: "Premier League", leagueId: "39" },
  { id: "UCTv-XvfzLX3i4IGWAm4sbmA", competition: "La Liga", leagueId: "140" },
  { id: "UCBJeMCIeLQos7wacox4hmLQ", competition: "Serie A", leagueId: "135" },
  { id: "UC6UL29enLNe4mqwTfAyeNuw", competition: "Bundesliga", leagueId: "78" },
  { id: "UCQsH5XtIc9hONE1BQjucM0g", competition: "Ligue 1", leagueId: "61" },
  { id: "UCyGa1YEx9ST66rYrJTGIKOw", competition: "UEFA", leagueId: "2" },
  { id: "UCZ7wY7MRDSygp63HIEfdQZA", competition: "Sky Sports", leagueId: null },
];

// Match highlights / summaries / goal round-ups in the languages these channels use
const HIGHLIGHT_KEYWORDS = /highlight|resumen|résumé|resume|sintesi|all goals|every .*goals?|tous les buts|all .* goals/i;
// "2-2", "(0-2)", "3 - 1" score lines in titles
const SCORE_IN_TITLE = /\b\d{1,2}\s?-\s?\d{1,2}\b/;
// Serie A uploads every match twice; the Italian copy ("sintesi", "Enilive") duplicates the English one
const NOT_HIGHLIGHTS = /rueda de prensa|press conference|previa|preview|interview|exclusive|reacts?\b|sintesi|enilive/i;

// "SC FREIBURG - SCHALKE 04" / "Hearts 5-0 St Mirren" → one key per fixture, so re-uploads collapse
const fixtureKey = (video) => {
  const segment = video.title
    .split("|")
    .map((part) => part.trim())
    .find((part) => /[A-Za-zÀ-ÿ.]\s?-\s?[A-Za-zÀ-ÿ0-9]|\d\s?-\s?\d/.test(part));
  if (!segment) return null;
  const teams = segment
    .replace(/\(?\b\d{1,2}\s?-\s?\d{1,2}\b\)?/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return teams ? `${video.competition}:${teams}` : null;
};

const xmlValue = (xml, tag) =>
  xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() || "";

function parseHighlightsFeed(xml, channel) {
  const entries = xml.split("<entry>").slice(1);
  return entries
    .map((entry) => {
      const videoId = xmlValue(entry, "yt:videoId");
      const link = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1] || "";
      return {
        id: videoId,
        title: decodeEntities(xmlValue(entry, "title")),
        published: xmlValue(entry, "published"),
        isShort: link.includes("/shorts/"),
        channel: decodeEntities(xmlValue(entry.split("<author>")[1] || "", "name")),
        competition: channel.competition,
        leagueId: channel.leagueId,
        // mqdefault is 16:9 (hqdefault has black bars)
        thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "",
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
      };
    })
    .filter(
      (v) =>
        v.id &&
        !v.isShort &&
        !NOT_HIGHLIGHTS.test(v.title) &&
        (HIGHLIGHT_KEYWORDS.test(v.title) || SCORE_IN_TITLE.test(v.title)),
    )
    .map(({ isShort, ...v }) => v);
}

app.get("/football-get-highlights", async (req, res) => {
  const cacheKey = "video_highlights";
  const entry = cache.getEntry(cacheKey);
  if (entry && !entry.stale) {
    return res.json(entry.data);
  }

  const results = await Promise.allSettled(
    HIGHLIGHT_CHANNELS.map((channel) =>
      axios
        .get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, { timeout: 10000 })
        .then((r) => parseHighlightsFeed(String(r.data || ""), channel)),
    ),
  );
  const videos = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    // Newest first, so the first video seen for a fixture is the one kept
    .filter(function (video) {
      const key = fixtureKey(video);
      if (!key) return true;
      if (this.has(key)) return false;
      this.add(key);
      return true;
    }, new Set());

  if (videos.length === 0) {
    // Every feed failed: fall back to the last list we had
    if (entry) return res.json(entry.data);
    return res.status(502).json({ error: "Failed to fetch video highlights" });
  }

  cache.set(cacheKey, videos, 1800);
  res.json(videos);
});

// ==========================================
// 8. MATCH STATISTICS & PREDICTIONS
// ==========================================
function getMockStats(eventid) {
  return [
    { name: "Shots on Target", home: "5", away: "2", homePct: 71, awayPct: 29 },
    { name: "Shots off Target", home: "10", away: "5", homePct: 67, awayPct: 33 },
    { name: "Blocked Shots", home: "2", away: "3", homePct: 40, awayPct: 60 },
    { name: "Possession (%)", home: "51%", away: "49%", homePct: 51, awayPct: 49 },
    { name: "Corner Kicks", home: "4", away: "5", homePct: 44, awayPct: 56 },
    { name: "Offsides", home: "5", away: "1", homePct: 83, awayPct: 17 },
    { name: "Fouls", home: "14", away: "19", homePct: 42, awayPct: 58 },
    { name: "Goalkeeper Saves", home: "2", away: "4", homePct: 33, awayPct: 67 },
    { name: "Yellow Cards", home: "1", away: "3", homePct: 25, awayPct: 75 },
    { name: "Red Cards", home: "0", away: "0", homePct: 50, awayPct: 50 },
  ];
}

app.get("/football-get-match-statistics", async (req, res) => {
  const eventid = req.query.eventid;
  const force = req.query.force === "true" || req.query.refresh === "true";
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (isNaN(Number(eventid))) {
    return res.json(getMockStats(eventid));
  }

  const cacheKey = `stats_event_${eventid}`;
  if (force) {
    cache.clear(cacheKey);
  }

  // If match is upcoming, statistics do not exist yet
  if (req.query.upcoming === "true") {
    return res.json([]);
  }

  // Detect if match is currently live (from query or liveScoreManager)
  const liveData = getCachedLiveScores();
  const isMatchLive =
    req.query.live === "true" ||
    (liveData?.matches || []).some((m) => String(m.id) === String(eventid));

  // Live match stats refresh every 5 minutes (300s); finished matches cache for 24 hours
  const ttl = isMatchLive ? 300 : 86400;

  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures/statistics",
      { fixture: eventid },
      ttl,
      (apiResponse) => {
        return parseFixtureStats(apiResponse);
      },
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch match statistics",
      message: err.message,
    });
  }
});

// ==========================================
// 8.1 FIXTURE EVENTS (MATCH TIMELINE)
// ==========================================
app.get("/football-get-match-events", async (req, res) => {
  const eventid = req.query.eventid;
  const force = req.query.force === "true" || req.query.refresh === "true";
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (!/^\d+$/.test(String(eventid))) {
    return res.json([]);
  }

  const cacheKey = `events_fixture_${eventid}`;
  if (force) {
    cache.clear(cacheKey);
  }

  // If match is upcoming, timeline events do not exist yet
  if (req.query.upcoming === "true") {
    return res.json([]);
  }

  // Detect if match is currently live
  const liveData = getCachedLiveScores();
  const isMatchLive =
    req.query.live === "true" ||
    (liveData?.matches || []).some((m) => String(m.id) === String(eventid));

  // Live match events (goals, cards, subs) refresh every 1 minute (60s); past matches cache for 24 hours
  const ttl = isMatchLive ? 60 : 86400;

  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures/events",
      { fixture: eventid },
      ttl,
      (apiResponse) => parseFixtureEvents(apiResponse)
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch match events",
      message: err.message,
    });
  }
});

// ==========================================
// 8.2 HEAD TO HEAD (H2H)
// ==========================================
const H2H_PLAYED_STATUSES = new Set(["FT", "AET", "PEN"]);

function parseH2H(apiResponse, homeId, awayId) {
  // Only meetings with a final result count (an upcoming fixture has null goals, not 0-0)
  const list = (apiResponse?.response || [])
    .filter((item) => H2H_PLAYED_STATUSES.has(item.fixture?.status?.short))
    .sort((a, b) => (b.fixture?.timestamp || 0) - (a.fixture?.timestamp || 0));

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalGoals = 0;
  let homeCleanSheets = 0;
  let awayCleanSheets = 0;

  const matches = list.map((item) => {
    const isHome = String(item.teams?.home?.id) === String(homeId);
    const homeScore = item.goals?.home ?? 0;
    const awayScore = item.goals?.away ?? 0;
    // Goals scored by the requested home / away team, whichever side they played on
    const homeTeamGoals = isHome ? homeScore : awayScore;
    const awayTeamGoals = isHome ? awayScore : homeScore;

    if (homeTeamGoals > awayTeamGoals) homeWins++;
    else if (awayTeamGoals > homeTeamGoals) awayWins++;
    else draws++;
    totalGoals += homeScore + awayScore;
    if (awayTeamGoals === 0) homeCleanSheets++;
    if (homeTeamGoals === 0) awayCleanSheets++;

    return {
      id: String(item.fixture?.id),
      date: item.fixture?.date ? new Date(item.fixture.date).toLocaleDateString() : '',
      league: item.league?.name || '',
      home: {
        id: item.teams?.home?.id,
        name: item.teams?.home?.name,
        logo: item.teams?.home?.logo,
        score: homeScore
      },
      away: {
        id: item.teams?.away?.id,
        name: item.teams?.away?.name,
        logo: item.teams?.away?.logo,
        score: awayScore
      }
    };
  });

  const total = list.length;
  return {
    totalMatches: total,
    homeWins,
    awayWins,
    draws,
    avgGoals: total ? Math.round((totalGoals / total) * 10) / 10 : null,
    cleanSheets: {
      home: total ? Math.round((homeCleanSheets / total) * 100) : null,
      away: total ? Math.round((awayCleanSheets / total) * 100) : null,
    },
    matches: matches.slice(0, 5)
  };
}

app.get("/football-get-h2h", async (req, res) => {
  const { homeId, awayId } = req.query;
  if (!homeId || !awayId) {
    return res.status(400).json({ error: "Missing homeId or awayId parameter" });
  }

  const h2hParam = `${homeId}-${awayId}`;
  // v2: adds avgGoals / cleanSheets and ignores unplayed fixtures
  const cacheKey = `h2h_v2_${h2hParam}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures/headtohead",
      { h2h: h2hParam, last: 10 },
      86400,
      (apiResponse) => parseH2H(apiResponse, homeId, awayId)
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch H2H data",
      message: err.message,
    });
  }
});

app.get("/football-get-predictions", async (req, res) => {
  const eventid = req.query.eventid;
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (!/^\d+$/.test(String(eventid))) {
    return res.json(null);
  }

  // v2: no more mock fallback; older entries may hold mock numbers
  const cacheKey = `predictions_v2_${eventid}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/predictions",
      { fixture: eventid },
      259200, // 3 days cache (previously 24h)
      (apiResponse) => {
        return parsePredictions(apiResponse);
      },
    );
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch predictions", message: err.message });
  }
});

// Health check endpoint for VPS process manager (PM2 / Docker)
app.get("/health", (req, res) => {
  const cacheData = getCachedLiveScores();
  const quota = getQuotaStatus();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    lastUpdated: cacheData.lastUpdated,
    liveMatches: cacheData.count,
    quota: {
      used: quota.used,
      remaining: quota.remaining,
      callsByTier: quota.callsByTier,
      deniedByTier: quota.deniedByTier,
    },
  });
});

// ==========================================
// ADMIN
// ==========================================
// Admin routes require the ADMIN_TOKEN from .env, sent as the "x-admin-token" header or
// "?token=" query param. Without ADMIN_TOKEN set they are disabled (a reverse proxy makes
// every request look local, so there is no safe "localhost only" fallback).
function requireAdmin(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(403).json({ error: "Admin routes are disabled. Set ADMIN_TOKEN in .env." });
  }
  const provided = req.get("x-admin-token") || req.query.token;
  if (provided === adminToken) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
app.use("/admin", requireAdmin);

app.get("/admin/quota-status", (req, res) => {
  const quota = getQuotaStatus();
  const percentUsed = ((quota.used / quota.limit) * 100).toFixed(1);
  res.json({
    daily_limit: quota.limit,
    used_today: quota.used,
    remaining: quota.remaining,
    percent_used: `${percentUsed}%`,
    status: quota.exhausted ? "EXHAUSTED" : !quota.tiersAllowed.ondemand ? "LOW" : "OK",
    calls_by_tier: quota.callsByTier,
    denied_by_tier: quota.deniedByTier,
    tier_floors: quota.floors,
    tiers_allowed: quota.tiersAllowed,
    resets_at: quota.resetsAt,
  });
});

// Sync engine status: last run, result and next run of every background job
app.get("/admin/sync-status", (req, res) => {
  res.json({ quota: getQuotaStatus(), sync: getSyncStatus() });
});

// Manually run sync jobs now, ignoring their schedule: POST /admin/sync/all or /admin/sync/dates
app.post("/admin/sync/:job", (req, res) => {
  const job = req.params.job;
  if (job !== "all" && !JOB_NAMES.includes(job)) {
    return res.status(400).json({ error: `Unknown job. Use one of: all, ${JOB_NAMES.join(", ")}` });
  }
  requestSync([job]);
  res.json({ status: "queued", job, message: "Runs within 15 seconds. Check /admin/sync-status." });
});

// Admin: clear all server memory and disk cache on demand.
// Warning: cached data is the fallback served when the API is unavailable or out of quota,
// and refilling it costs API requests. Internal state files (starting with "_") are kept.
app.get("/admin/clear-cache", (req, res) => {
  const fs = require("fs");
  const { CACHE_DIR } = require("./cache");
  let deletedCount = 0;

  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith(".json") && !file.startsWith("_")) {
        try {
          fs.unlinkSync(require("path").join(CACHE_DIR, file));
          deletedCount++;
        } catch (e) {}
      }
    }
  }

  res.json({
    success: true,
    message: `Cache flushed! Removed ${deletedCount} cache files from disk. Workers drop their memory copies within 2 seconds.`,
  });
});

app.post("/admin/warm", async (req, res) => {
  const { runWarmCycle } = require("./cacheWarmer");
  res.json({ status: "warming", message: "Cache warm cycle triggered in background." });
  // Run after response is sent so client isn't blocked
  setImmediate(async () => {
    try {
      await runWarmCycle();
      console.log("[Admin] Manual warm cycle completed.");
    } catch (err) {
      console.error("[Admin] Manual warm cycle failed:", err.message);
    }
  });
});

// Start Express server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(`🚀 Football Full Backend Server running on port ${PORT}`);
  console.log(
    `📡 Client Proxy Endpoint: http://localhost:${PORT}/api/live-scores`,
  );
  console.log(`====================================================`);

  // In PM2 cluster mode, multiple worker instances run simultaneously.
  // Background tasks (live score polling, sync engine, cache warmer) MUST ONLY run on one
  // instance to prevent multiplying API requests by the number of PM2 cluster instances.
  // NODE_APP_INSTANCE is 0..n-1 within this app; pm_id is global across all PM2 apps, so it
  // is only used as a fallback. SYNC_LEADER=true/false overrides the detection.
  const pmId = process.env.NODE_APP_INSTANCE !== undefined
    ? String(process.env.NODE_APP_INSTANCE)
    : (process.env.pm_id !== undefined ? String(process.env.pm_id) : '0');
  const isLeader = process.env.SYNC_LEADER !== undefined
    ? process.env.SYNC_LEADER === 'true'
    : pmId === '0';

  if (isLeader) {
    console.log(`[Server] Primary Instance (instance: ${pmId}): Starting live score polling service...`);
    startLiveScorePolling();
    // startSyncEngine() disabled: all fixtures, standings, and match details are fetched on demand and cached for 24 hours.
    // Disabling syncEngine saves 500+ redundant API calls per hour.
  } else {
    console.log(`[Server] Worker Instance (pm_id: ${pmId}): Skipping background services (handled by instance 0).`);
  }
});

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  stopLiveScorePolling();
  stopSyncEngine();

  server.close(() => {
    console.log("[Server] Closed all connections. Process exiting.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error(
      "[Server] Could not close connections in time, forcing exit.",
    );
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
