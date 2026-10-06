const axios = require('axios');
const { cache } = require('./cache');

const APISPORTS_URL =
  process.env.APISPORTS_URL ||
  process.env.THIRD_PARTY_API_URL ||
  'https://v3.football.api-sports.io';
const APISPORTS_KEY =
  process.env.APISPORTS_KEY || process.env.THIRD_PARTY_API_KEY || '';

const api = axios.create({
  baseURL: APISPORTS_URL,
  timeout: 15000,
  headers: {
    'x-apisports-key': APISPORTS_KEY,
    Accept: 'application/json',
  },
});

// Popular league IDs to pre-warm
const POPULAR_LEAGUE_IDS = ['39', '140', '135', '78', '61', '2', '3'];

// ==========================================
// HELPERS
// ==========================================

function getTodayStr() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getDateCompact(dateStr) {
  return dateStr.replace(/-/g, ''); // "2026-10-06" -> "20261006"
}

function mapFixture(item) {
  return {
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
      ? `${item.fixture.status.elapsed}'`
      : item.fixture.status.short,
    status: item.fixture.status.short,
  };
}

async function safeApiCall(endpoint, params) {
  try {
    const response = await api.get(endpoint, { params });
    if (
      response.data &&
      response.data.errors &&
      Object.keys(response.data.errors).length > 0
    ) {
      console.warn(`[CacheWarmer] API errors for ${endpoint}:`, response.data.errors);
      return null;
    }
    return response.data;
  } catch (err) {
    console.warn(`[CacheWarmer] Failed to fetch ${endpoint}:`, err.message);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================
// WARM TASKS
// ==========================================

/**
 * Pre-fetches today's and tomorrow's fixtures.
 * TTL: 30 minutes (1800s)
 */
async function warmFixturesByDate() {
  const dates = [getTodayStr(), getTomorrowStr()];

  for (const dateStr of dates) {
    const compact = getDateCompact(dateStr);
    const cacheKey = `fixtures_date_${compact}`;

    if (cache.get(cacheKey) !== null) {
      console.log(`[CacheWarmer] fixtures ${dateStr} already cached, skipping.`);
      continue;
    }

    console.log(`[CacheWarmer] Pre-fetching fixtures for ${dateStr}...`);
    const data = await safeApiCall('/fixtures', { date: dateStr });
    if (data) {
      const mapped = (data.response || []).map(mapFixture);
      cache.set(cacheKey, mapped, 1800);
      console.log(`[CacheWarmer] Cached ${mapped.length} fixtures for ${dateStr}`);
    }

    await sleep(500);
  }
}

/**
 * Pre-fetches standings for popular leagues.
 * TTL: 4 hours (14400s)
 */
async function warmStandings() {
  const currentYear = new Date().getFullYear();
  const seasons = [currentYear, 2024];

  for (const leagueId of POPULAR_LEAGUE_IDS) {
    for (const season of seasons) {
      const cacheKey = `standings_${leagueId}_${season}`;

      if (cache.get(cacheKey) !== null) {
        console.log(`[CacheWarmer] standings league=${leagueId} season=${season} already cached, skipping.`);
        break;
      }

      console.log(`[CacheWarmer] Pre-fetching standings league=${leagueId} season=${season}...`);
      const data = await safeApiCall('/standings', { league: leagueId, season });
      if (data) {
        const list = data.response || [];
        if (list.length > 0) {
          const apiStandings = list[0]?.league?.standings?.[0] || [];
          const mapped = apiStandings.map((item) => ({
            teamId: item.team.id,
            teamName: item.team.name,
            logoUrl: item.team.logo,
            pos: item.rank,
            played: item.all.played,
            goalsDiff: item.goalsDiff,
            points: item.points,
          }));
          cache.set(cacheKey, mapped, 14400);
          console.log(`[CacheWarmer] Cached standings for league=${leagueId} season=${season}`);
          break;
        }
      }

      await sleep(400);
    }
  }
}

/**
 * Pre-fetches next 10 fixtures for popular leagues.
 * TTL: 30 minutes (1800s)
 */
async function warmLeagueFixtures() {
  const todayStr = getTodayStr();

  for (const leagueId of POPULAR_LEAGUE_IDS) {
    const cacheKey = `fixtures_league_${leagueId}_${todayStr}`;

    if (cache.get(cacheKey) !== null) {
      console.log(`[CacheWarmer] league fixtures ${leagueId} already cached, skipping.`);
      continue;
    }

    console.log(`[CacheWarmer] Pre-fetching next fixtures for league=${leagueId}...`);
    const data = await safeApiCall('/fixtures', { league: leagueId, next: 10 });
    if (data) {
      const list = (data.response || []).map((item) => {
        const fixtureDate = item.fixture.date ? new Date(item.fixture.date) : new Date();
        const time = fixtureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = `${String(fixtureDate.getDate()).padStart(2, '0')}/${String(fixtureDate.getMonth() + 1).padStart(2, '0')}`;
        return {
          id: String(item.fixture.id),
          status: item.fixture.status.short || 'NS',
          time,
          date,
          home: { id: item.teams.home.id, name: item.teams.home.name, logo: item.teams.home.logo },
          away: { id: item.teams.away.id, name: item.teams.away.name, logo: item.teams.away.logo },
        };
      });
      cache.set(cacheKey, list, 1800);
      console.log(`[CacheWarmer] Cached ${list.length} upcoming fixtures for league=${leagueId}`);
    }

    await sleep(400);
  }
}

/**
 * Pre-fetches football news from Sky Sports RSS.
 * TTL: 5 minutes (300s)
 */
async function warmNews() {
  const cacheKey = 'football_news';
  if (cache.get(cacheKey) !== null) {
    console.log(`[CacheWarmer] News already cached, skipping.`);
    return;
  }

  console.log(`[CacheWarmer] Pre-fetching football news...`);
  try {
    const response = await axios.get('https://www.skysports.com/rss/12040', {
      timeout: 10000,
      headers: { Accept: 'application/xml, text/xml, */*' },
    });

    const xmlText = response.data;
    if (typeof xmlText !== 'string') return;

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
      const link = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1]?.trim() || '';
      let description = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() || '';
      description = description.replace(/<[^>]*>/g, '');
      const pubDate = itemXml.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/)?.[1]?.trim() || '';

      let thumbnail = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500';
      const enclosureMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/);
      const mediaMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/);
      if (enclosureMatch?.[1]) thumbnail = enclosureMatch[1];
      else if (mediaMatch?.[1]) thumbnail = mediaMatch[1];

      items.push({ id: link || Math.random().toString(), title, description, thumbnail, date: pubDate, link });
    }

    if (items.length > 0) {
      cache.set(cacheKey, items, 300);
      console.log(`[CacheWarmer] Cached ${items.length} news articles`);
    }
  } catch (err) {
    console.warn(`[CacheWarmer] News fetch failed:`, err.message);
  }
}

// ==========================================
// FULL WARM CYCLE
// ==========================================

async function runWarmCycle() {
  console.log(`\n[CacheWarmer] Starting warm cycle at ${new Date().toISOString()}`);
  const start = Date.now();

  await warmFixturesByDate();
  await sleep(500);

  await warmNews();
  await sleep(300);

  await warmLeagueFixtures();

  // NOTE: warmStandings() removed - /standings requires a paid API plan (returns 403 on free)

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[CacheWarmer] Warm cycle completed in ${elapsed}s\n`);
}

// ==========================================
// SCHEDULER
// ==========================================

let warmerTimer = null;
let newsTimer = null;
let isWarmerRunning = false;

// Full warm cycle: every 25 minutes
const WARM_INTERVAL_MS = 25 * 60 * 1000;
// News refresh: every 5 minutes (no API quota cost)
const NEWS_INTERVAL_MS = 5 * 60 * 1000;

async function warmCycleLoop() {
  if (!isWarmerRunning) return;
  await runWarmCycle();
  warmerTimer = setTimeout(warmCycleLoop, WARM_INTERVAL_MS);
}

async function newsLoop() {
  if (!isWarmerRunning) return;
  await warmNews();
  newsTimer = setTimeout(newsLoop, NEWS_INTERVAL_MS);
}

function startCacheWarmer() {
  if (isWarmerRunning) return;
  isWarmerRunning = true;
  console.log('[CacheWarmer] Background cache warmer started.');

  // Run immediately on startup
  warmCycleLoop();

  // News refreshes more frequently; offset by 10s to stagger load
  setTimeout(() => { newsLoop(); }, 10000);
}

function stopCacheWarmer() {
  isWarmerRunning = false;
  if (warmerTimer) { clearTimeout(warmerTimer); warmerTimer = null; }
  if (newsTimer) { clearTimeout(newsTimer); newsTimer = null; }
  console.log('[CacheWarmer] Cache warmer stopped.');
}

module.exports = {
  startCacheWarmer,
  stopCacheWarmer,
  runWarmCycle,
};
