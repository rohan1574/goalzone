import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

// Contabo VPS hosted live backend URL with local fallback
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://62.84.190.145";
const LOCAL_BACKEND_URL_ANDROID = "http://10.0.2.2:3000";
const LOCAL_BACKEND_URL_LOCALHOST = "http://localhost:3000";

export const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000, // 10s timeout prevents 30s hangs
  headers: {
    "Content-Type": "application/json",
  },
});

export async function fetchWithBackendFallback(endpoint: string, params: any = {}) {
  try {
    const res = await api.get(endpoint, { params });
    if (res && res.data !== undefined) {
      return res;
    }
    return res;
  } catch (err) {
    // Only try local fallback if VPS is completely unreachable
    try {
      const localRes = await axios
        .get(`${LOCAL_BACKEND_URL_ANDROID}${endpoint}`, { params, timeout: 1500 })
        .catch(() => axios.get(`${LOCAL_BACKEND_URL_LOCALHOST}${endpoint}`, { params, timeout: 1500 }))
        .catch(() => null);
      if (localRes && localRes.data) return localRes;
    } catch {
      // local fallback unreachable
    }
    throw err;
  }
}

export const toggleServerMatchNotification = async (
  token: string,
  matchId: string,
  action: "subscribe" | "unsubscribe"
): Promise<boolean> => {
  try {
    await api.post("/api/match-notifications", { token, matchId, action });
    return true;
  } catch (err) {
    console.warn("[FCM Subscription Error]:", err);
    return false;
  }
};

// Fast In-Memory Cache (0ms response time on tab navigation)
const memoryCache = new Map<string, { data: any; expiry: number }>();

export const getFromMemoryCache = (key: string): any | null => {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
};

export const setMemoryCache = (key: string, data: any, ttlMs: number) => {
  memoryCache.set(key, { data, expiry: Date.now() + ttlMs });
};

export const getAllCachedFixtures = (): any[] => {
  const allFixtures: any[] = [];
  const seenIds = new Set<string>();

  const addFixture = (m: any) => {
    if (!m) return;
    const eventId = String(
      getMatchEventId(m) ||
      m.id ||
      `${m.home?.name || m.homeName || "home"}-${m.away?.name || m.awayName || "away"}-${m.date || m.time}`
    );
    if (eventId && !seenIds.has(eventId)) {
      seenIds.add(eventId);
      allFixtures.push(m);
    }
  };

  for (const [key, value] of memoryCache.entries()) {
    if (!value || !value.data) continue;
    if (Array.isArray(value.data)) {
      value.data.forEach(addFixture);
    } else if (value.data.fixtures && Array.isArray(value.data.fixtures)) {
      value.data.fixtures.forEach(addFixture);
    }
  }

  return allFixtures;
};

export const hasFootballApiKey = true;

export const formatFootballDate = (addDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + addDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
};

export const scorePaths = {
  home: [
    "scores.home",
    "score.home",
    "goals.home",
    "homeScore",
    "home.score",
    "homeTeam.score",
    "teams.home.score",
    "score.fullTime.home",
    "score.current.home",
    "status.homeScore",
    "status.score.home",
  ],
  away: [
    "scores.away",
    "score.away",
    "goals.away",
    "awayScore",
    "away.score",
    "awayTeam.score",
    "teams.away.score",
    "score.fullTime.away",
    "score.current.away",
    "status.awayScore",
    "status.score.away",
  ],
};

export const getMatchScore = (match: any) => {
  const scoreLine = getMatchValue(
    match,
    ["status.scoreStr", "scoreStr", "scores.display", "score.display", "score"],
    "",
  );

  const home = getMatchValue(match, scorePaths.home, "");
  const away = getMatchValue(match, scorePaths.away, "");
  const hasPair = home !== "" && away !== "";

  if (hasPair) {
    return {
      home,
      away,
      display: `${home} - ${away}`,
      hasScore: true,
      hasPair,
    };
  }

  if (scoreLine) {
    return {
      home: "",
      away: "",
      display: scoreLine,
      hasScore: true,
      hasPair: false,
    };
  }

  return { home: "", away: "", display: "VS", hasScore: false, hasPair: false };
};

const statusPaths = ["status.long", "status.short", "status.type", "status"];

export const getMatchStatus = (match: any, fallback = "Scheduled") => {
  const status = match?.status || {};

  // If status is a string (primitive status field fallback)
  if (typeof status === "string") {
    if (status === "FT" || status.toLowerCase().includes("full"))
      return "Full Time";
    if (status === "HT" || status.toLowerCase().includes("half"))
      return "Half Time";
    return status;
  }

  // 1. Check if finished
  if (
    status.finished ||
    status.reason?.short === "FT" ||
    status.reason?.long === "Full Time" ||
    match.statusType === "finished"
  ) {
    return "Full Time";
  }

  // 2. Check if live
  const isLive =
    status.liveTime ||
    (status.started && !status.finished) ||
    match.statusType === "live";
  if (isLive) {
    // Check for Half Time
    if (
      status.reason?.short === "HT" ||
      status.reason?.long === "Half Time" ||
      status.liveTime?.short === "HT" ||
      status.liveTime === "HT"
    ) {
      return "Half Time";
    }
    // Return elapsed time
    const elapsed =
      status.liveTime?.short ||
      status.liveTime?.long ||
      status.liveTime ||
      "Live";
    return String(elapsed);
  }

  // 3. Not started / Scheduled
  const timeStr = status.startTimeStr || status.time || match.time;
  if (timeStr && typeof timeStr === "string") return timeStr;

  // Generic fallback using getMatchValue
  const explicitStatus = getMatchValue(match, statusPaths, "");
  if (explicitStatus) {
    if (
      explicitStatus === "FT" ||
      explicitStatus === "Full Time" ||
      explicitStatus === "Finished"
    ) {
      return "Full Time";
    }
    if (explicitStatus === "HT" || explicitStatus === "Half Time") {
      return "Half Time";
    }
    return explicitStatus;
  }

  return fallback;
};

export const getMatchLeague = (match: any) =>
  getMatchValue(
    match,
    ["league.name", "competition.name", "tournament.name", "league"],
    "Competition",
  );

export const getMatchLeagueId = (match: any) =>
  getMatchValue(
    match,
    ["league.id", "competition.id", "tournament.id", "leagueId"],
    "",
  );

export const getMatchEventId = (match: any) =>
  getMatchValue(
    match,
    [
      "id",
      "eventId",
      "eventid",
      "event_id",
      "matchId",
      "fixture.id",
      "fixture.eventId",
      "detail.matchId",
    ],
    "",
  );

export const formatLocalMatchTime = (match: any, defaultTime = "19:00"): string => {
  if (!match) return defaultTime;

  // Prioritize full ISO date strings and numeric timestamps over date-only strings
  const candidate =
    match?.timestamp ||
    match?.fixture?.timestamp ||
    (typeof match?.rawDate === "string" && match.rawDate.includes("T") ? match.rawDate : null) ||
    (typeof match?.fixture?.date === "string" && match.fixture.date.includes("T") ? match.fixture.date : null) ||
    (typeof match?.date === "string" && match.date.includes("T") ? match.date : null) ||
    match?.rawDate ||
    match?.fixture?.date ||
    (typeof match?.date === "number" ? match.date : null);

  if (candidate) {
    try {
      let dateObj: Date | null = null;
      if (typeof candidate === "number") {
        dateObj = new Date(candidate < 10000000000 ? candidate * 1000 : candidate);
      } else if (typeof candidate === "string" && candidate.includes("T")) {
        dateObj = new Date(candidate);
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        let hours = dateObj.getHours();
        const minutes = dateObj.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 becomes 12
        const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
        return `${hours}:${minutesStr} ${ampm}`;
      }
    } catch (e) {
      console.warn("Error parsing match local time:", e);
    }
  }

  if (match?.time && typeof match.time === "string" && !match.time.includes("T")) {
    return match.time;
  }

  return defaultTime;
};

// Kickoff time in ms from whichever field the match source provides (null if unknown)
export const getMatchKickoffMs = (match: any): number | null => {
  if (match?.timestamp) return Number(match.timestamp) * 1000;
  // League/team lists put a short "12/10" in `date` and the full ISO string in `rawDate`
  const parsed = Date.parse(match?.rawDate || match?.date || "");
  return isNaN(parsed) || new Date(parsed).getFullYear() < 2000 ? null : parsed;
};

// "Today 19:30", "Tomorrow 21:00", "Sat 18 Oct 16:00" in the user's own timezone
export const formatKickoffLabel = (ms: number): string => {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} ${time}`;
};

export const getMatchLocalDateStr = (match: any, fallbackDate?: Date): string => {
  if (!match && !fallbackDate) return "";

  const candidate =
    match?.timestamp ||
    match?.fixture?.timestamp ||
    (typeof match?.rawDate === "string" && match.rawDate.includes("T") ? match.rawDate : null) ||
    (typeof match?.fixture?.date === "string" && match.fixture.date.includes("T") ? match.fixture.date : null) ||
    (typeof match?.date === "string" && match.date.includes("T") ? match.date : null) ||
    match?.rawDate ||
    match?.fixture?.date ||
    (typeof match?.date === "number" ? match.date : null);

  if (candidate) {
    try {
      let dateObj: Date | null = null;
      if (typeof candidate === "number") {
        dateObj = new Date(candidate < 10000000000 ? candidate * 1000 : candidate);
      } else if (typeof candidate === "string" && candidate.includes("T")) {
        dateObj = new Date(candidate);
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        const day = dateObj.getDate();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = months[dateObj.getMonth()];
        const year = dateObj.getFullYear();
        return `${day} ${month} ${year}`;
      }
    } catch (e) {
      console.warn("Error parsing match local date:", e);
    }
  }

  if (fallbackDate) {
    const day = fallbackDate.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[fallbackDate.getMonth()];
    const year = fallbackDate.getFullYear();
    return `${day} ${month} ${year}`;
  }

  return "";
};

export const findArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const item of Object.values(value)) {
    const found = findArray(item);
    if (found.length) return found;
  }

  return [];
};

export const cleanValue = (value: any, fallback = "TBD"): string => {
  if (value === 0) return "0";
  if (!value) return fallback;
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  return value.name || value.title || value.shortName || fallback;
};

export const getMatchValue = (
  item: any,
  paths: string[],
  fallback = "TBD",
): any =>
  cleanValue(
    paths
      .map((path) => path.split(".").reduce((data, key) => data?.[key], item))
      .find((value) => value || value === 0),
    fallback,
  );

export const getImageValue = (item: any, paths: string[]): string => {
  const value = getMatchValue(item, paths, "");
  return value === "TBD" ? "" : value;
};

export const getTeamLogo = (match: any, side: "home" | "away") => {
  const sidePaths = {
    home: [
      "home.logo",
      "home.image",
      "home.crest",
      "homeTeam.logo",
      "homeTeam.image",
      "homeTeam.crest",
      "teams.home.logo",
      "teams.home.image",
      "teams.home.crest",
      "home.logoUrl",
      "homeTeam.logoUrl",
      "teams.home.logoUrl",
    ],
    away: [
      "away.logo",
      "away.image",
      "away.crest",
      "awayTeam.logo",
      "awayTeam.image",
      "awayTeam.crest",
      "teams.away.logo",
      "teams.away.image",
      "teams.away.crest",
      "away.logoUrl",
      "awayTeam.logoUrl",
      "teams.away.logoUrl",
    ],
  };

  const url = getImageValue(match, sidePaths[side] || []);
  if (url) return url;

  const teamId = getMatchValue(match, [
    `${side}.id`,
    `${side}Team.id`,
    `teams.${side}.id`,
  ]);
  if (teamId && teamId !== "TBD") {
    return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`;
  }

  return "";
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchLiveMatches = async (): Promise<any[]> => {
  try {
    const res = await api.get("/football-current-live");
    return findArray(res.data);
  } catch (err) {
    return [];
  }
};

export const SUPPLEMENTAL_FEATURED_LEAGUES = [
  // England
  { leagueId: "39",  leagueName: "Premier League",      country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/39.png" },
  { leagueId: "45",  leagueName: "FA Cup",              country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/45.png" },
  { leagueId: "48",  leagueName: "League Cup",          country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/48.png" },
  { leagueId: "528", leagueName: "Community Shield",    country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/528.png" },
  { leagueId: "40",  leagueName: "Championship",        country: "England",  leagueLogo: "https://media.api-sports.io/football/leagues/40.png" },

  // Spain
  { leagueId: "140", leagueName: "La Liga",              country: "Spain",    leagueLogo: "https://media.api-sports.io/football/leagues/140.png" },
  { leagueId: "143", leagueName: "Copa del Rey",         country: "Spain",    leagueLogo: "https://media.api-sports.io/football/leagues/143.png" },
  { leagueId: "556", leagueName: "Supercopa de España",  country: "Spain",    leagueLogo: "https://media.api-sports.io/football/leagues/556.png" },
  { leagueId: "141", leagueName: "Segunda División",     country: "Spain",    leagueLogo: "https://media.api-sports.io/football/leagues/141.png" },

  // Italy
  { leagueId: "135", leagueName: "Serie A",              country: "Italy",    leagueLogo: "https://media.api-sports.io/football/leagues/135.png" },
  { leagueId: "137", leagueName: "Coppa Italia",         country: "Italy",    leagueLogo: "https://media.api-sports.io/football/leagues/137.png" },
  { leagueId: "547", leagueName: "Supercoppa Italiana",  country: "Italy",    leagueLogo: "https://media.api-sports.io/football/leagues/547.png" },
  { leagueId: "136", leagueName: "Serie B",              country: "Italy",    leagueLogo: "https://media.api-sports.io/football/leagues/136.png" },

  // Germany
  { leagueId: "78",  leagueName: "Bundesliga",           country: "Germany",  leagueLogo: "https://media.api-sports.io/football/leagues/78.png" },
  { leagueId: "81",  leagueName: "DFB Pokal",            country: "Germany",  leagueLogo: "https://media.api-sports.io/football/leagues/81.png" },
  { leagueId: "529", leagueName: "DFL-Supercup",         country: "Germany",  leagueLogo: "https://media.api-sports.io/football/leagues/529.png" },
  { leagueId: "79",  leagueName: "2. Bundesliga",        country: "Germany",  leagueLogo: "https://media.api-sports.io/football/leagues/79.png" },

  // France
  { leagueId: "61",  leagueName: "Ligue 1",              country: "France",   leagueLogo: "https://media.api-sports.io/football/leagues/61.png" },
  { leagueId: "66",  leagueName: "Coupe de France",      country: "France",   leagueLogo: "https://media.api-sports.io/football/leagues/66.png" },
  { leagueId: "526", leagueName: "Trophée des Champions",country: "France",   leagueLogo: "https://media.api-sports.io/football/leagues/526.png" },
  { leagueId: "62",  leagueName: "Ligue 2",              country: "France",   leagueLogo: "https://media.api-sports.io/football/leagues/62.png" },

  // Brazil
  { leagueId: "71",  leagueName: "Brasileirão Série A",  country: "Brazil",   leagueLogo: "https://media.api-sports.io/football/leagues/71.png" },
  { leagueId: "73",  leagueName: "Copa do Brasil",       country: "Brazil",   leagueLogo: "https://media.api-sports.io/football/leagues/73.png" },
  { leagueId: "632", leagueName: "Supercopa do Brasil",  country: "Brazil",   leagueLogo: "https://media.api-sports.io/football/leagues/632.png" },
  { leagueId: "72",  leagueName: "Brasileirão Série B",  country: "Brazil",   leagueLogo: "https://media.api-sports.io/football/leagues/72.png" },

  // USA
  { leagueId: "253", leagueName: "MLS",                  country: "USA",      leagueLogo: "https://media.api-sports.io/football/leagues/253.png" },
  { leagueId: "257", leagueName: "US Open Cup",          country: "USA",      leagueLogo: "https://media.api-sports.io/football/leagues/257.png" },
  { leagueId: "772", leagueName: "Leagues Cup",          country: "USA",      leagueLogo: "https://media.api-sports.io/football/leagues/772.png" },

  // Saudi Arabia & Asia
  { leagueId: "307", leagueName: "Saudi Pro League",     country: "Saudi Arabia", leagueLogo: "https://media.api-sports.io/football/leagues/307.png" },
  { leagueId: "504", leagueName: "King Cup of Champions",country: "Saudi Arabia", leagueLogo: "https://media.api-sports.io/football/leagues/504.png" },
  { leagueId: "826", leagueName: "Saudi Super Cup",      country: "Saudi Arabia", leagueLogo: "https://media.api-sports.io/football/leagues/826.png" },
  { leagueId: "17",  leagueName: "AFC Champions League Elite", country: "Asia",   leagueLogo: "https://media.api-sports.io/football/leagues/17.png" },
  { leagueId: "18",  leagueName: "AFC Champions League Two",   country: "Asia",   leagueLogo: "https://media.api-sports.io/football/leagues/18.png" },
];

export async function supplementFixturesWithAfcAndSaudi(fixtures: any[], dateString: string): Promise<any[]> {
  const result = [...fixtures];
  const hasAfc = result.some((m: any) => String(m.leagueId) === "17" || (m.league && m.league.includes("AFC")));

  if (!hasAfc) {
    try {
      const afcRes = await fetchWithBackendFallback("/football-get-fixtures-by-league", { leagueid: "17" });
      const afcList = findArray(afcRes.data);
      const yyyymmddHyphen = `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6, 8)}`;
      const matchingAfc = afcList
        .filter((m: any) => {
          const raw = String(m.rawDate || m.date || "");
          return raw.startsWith(yyyymmddHyphen) || raw.includes(yyyymmddHyphen);
        })
        .map((m: any) => ({
          id: String(m.id),
          league: "AFC Champions League Elite",
          leagueId: "17",
          leagueLogo: "https://media.api-sports.io/football/leagues/17.png",
          leagueCountry: "Asia",
          home: m.home,
          away: m.away,
          score: m.score || "VS",
          minute: m.status || "NS",
          status: m.status || "NS",
          time: m.time || "19:00",
          date: m.date,
          rawDate: m.rawDate,
          timestamp: m.timestamp,
        }));

      if (matchingAfc.length > 0) {
        result.unshift(...matchingAfc);
      }
    } catch {
      // non-fatal fallback
    }
  }
  return result;
}

export const loadFootballDashboard = async (forceRefresh = false) => {
  const MEM_KEY = "@goalzone_mem_dashboard";
  const CACHE_KEY = "@goalzone_api_cache_dashboard_v2";
  const CACHE_TIME_KEY = "@goalzone_api_cache_dashboard_v2_time";

  // 1. Instant in-memory check (0ms tab switch)
  if (!forceRefresh) {
    const memData = getFromMemoryCache(MEM_KEY);
    if (memData?.data?.teams && memData.data.teams.length > 0) {
      console.log("[Cache] Served dashboard instantly from memory cache.");
      return memData;
    }

    try {
      const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);

      if (cachedTime && cachedData) {
        const parsedTime = parseInt(cachedTime, 10);
        const now = Date.now();
        if (now - parsedTime < 300000) {
          const parsed = JSON.parse(cachedData);
          if (parsed?.data?.teams && parsed.data.teams.length > 0) {
            setMemoryCache(MEM_KEY, parsed, 300000);
            console.log(
              `[Cache] Using cached dashboard data (v2). Teams: ${parsed.data.teams.length}`,
            );
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("Error reading dashboard cache:", err);
    }
  }

  console.log("[API] Fetching fresh dashboard data from backend...");

  // 2. Try single aggregated /football-dashboard endpoint first (1 fast request)
  try {
    const aggRes = await fetchWithBackendFallback("/football-dashboard", {
      date: formatFootballDate(0),
    });
    if (aggRes.data && aggRes.data.teams && aggRes.data.teams.length > 0) {
      const rawLeagues = aggRes.data.leagues || [];
      const seenLeagues = new Set(rawLeagues.map((l: any) => String(l.leagueId || l.id)));
      SUPPLEMENTAL_FEATURED_LEAGUES.forEach((sl) => {
        if (!seenLeagues.has(sl.leagueId)) {
          seenLeagues.add(sl.leagueId);
          rawLeagues.push(sl);
        }
      });

      const todayStr = formatFootballDate(0);
      const enrichedFixtures = await supplementFixturesWithAfcAndSaudi(aggRes.data.fixtures || [], todayStr);

      const response = {
        data: {
          live: aggRes.data.live || [],
          leagues: rawLeagues,
          fixtures: enrichedFixtures,
          teams: aggRes.data.teams || [],
        },
        hasPartialFailure: false,
      };

      setMemoryCache(MEM_KEY, response, 300000);
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(response));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (e) {
        console.warn("AsyncStorage save error:", e);
      }
      return response;
    }
  } catch (aggErr) {
    console.warn("[API] Aggregated dashboard failed:", aggErr);
  }

  // If /football-dashboard fails, return empty data — do NOT fire 4 extra API calls.
  // The user will just see an empty dashboard and can pull-to-refresh.
  return {
    data: { live: [], leagues: [], fixtures: [], teams: [] },
    hasPartialFailure: true,
  };
};

export const getFixturesCacheTTL = (dateString: string): number => {
  const todayStr = formatFootballDate(0);
  if (dateString < todayStr) {
    return 30 * 24 * 60 * 60 * 1000; // 30 days for past dates (match results never change)
  } else if (dateString > todayStr) {
    return 6 * 60 * 60 * 1000; // 6 hours for future dates
  }
  return 15 * 60 * 1000; // 15 minutes for today
};

export const fetchFixturesByDate = async (dateString: string) => {
  const MEM_KEY = `@goalzone_mem_fixtures_${dateString}`;
  const CACHE_KEY = `@goalzone_api_cache_fixtures_${dateString}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_fixtures_time_${dateString}`;
  const ttl = getFixturesCacheTTL(dateString);

  // 1. In-memory check (instant 0ms response)
  const memData = getFromMemoryCache(MEM_KEY);
  if (memData) {
    return memData;
  }

  // 2. Persistent storage check
  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      if (now - parsedTime < ttl) {
        const parsed = JSON.parse(cachedData);
        setMemoryCache(MEM_KEY, parsed, ttl - (now - parsedTime));
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`Error reading fixtures cache for ${dateString}:`, err);
  }

  console.log(
    `[API] Fetching fresh fixtures for date ${dateString} from API...`,
  );
  try {
    const userTimezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
    const response = await fetchWithBackendFallback("/football-get-matches-by-date", {
      date: dateString,
      timezone: userTimezone,
    });
    const freshData = await supplementFixturesWithAfcAndSaudi(findArray(response.data), dateString);

    // Save to high-speed memory RAM cache instantly (0ms)
    setMemoryCache(MEM_KEY, freshData, ttl);

    // Save to persistent storage asynchronously in idle thread (non-blocking)
    setTimeout(() => {
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData)).catch(() => {});
      AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString()).catch(() => {});
    }, 100);

    return freshData;
  } catch (error) {
    console.error("Error fetching fixtures:", error);
    return [];
  }
};

// prefetchAdjacentDates is DISABLED to prevent unnecessary API quota consumption.
// Fixtures are fetched on-demand when the user navigates to a date.
// The backend caches fixtures, so the first fetch is instant on second visit.
export const prefetchAdjacentDates = (_baseDate: Date = new Date()) => {
  // no-op: intentionally disabled
};

export const warmupFixturesCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const fixtureTimeKeys = keys.filter((k) =>
      k.startsWith("@goalzone_api_cache_fixtures_time_")
    );
    const now = Date.now();

    for (const timeKey of fixtureTimeKeys) {
      const dateString = timeKey.replace(
        "@goalzone_api_cache_fixtures_time_",
        ""
      );
      const cacheKey = `@goalzone_api_cache_fixtures_${dateString}`;
      const memKey = `@goalzone_mem_fixtures_${dateString}`;

      if (!getFromMemoryCache(memKey)) {
        const timeVal = await AsyncStorage.getItem(timeKey);
        if (timeVal) {
          const parsedTime = parseInt(timeVal, 10);
          const ttl = getFixturesCacheTTL(dateString);
          if (now - parsedTime < ttl) {
            const dataVal = await AsyncStorage.getItem(cacheKey);
            if (dataVal) {
              const parsed = JSON.parse(dataVal);
              setMemoryCache(memKey, parsed, ttl - (now - parsedTime));
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Warmup fixtures cache error:", err);
  }
};

const unwrapApiResponse = (data: any) =>
  data?.response || data?.data || data || {};

export const fetchMatchLocation = async (eventid: string | number) => {
  if (!eventid) return {};

  const CACHE_KEY = `@goalzone_api_cache_location_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_location_time_${eventid}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      if (now - parsedTime < 60000) {
        console.log(
          `[Cache] Using cached match location for event ${eventid}. Time remaining: ${Math.round((60000 - (now - parsedTime)) / 1000)}s`,
        );
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading match location cache:", err);
  }

  console.log(
    `[API] Fetching fresh match location for event ${eventid} from API...`,
  );
  try {
    const response = await api.get("/football-get-match-location", {
      params: { eventid },
    });
    const freshData = unwrapApiResponse(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving match location cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error("Error fetching match location:", error);
    return {};
  }
};

export const fetchFootballNews = async (force = false) => {
  const MEM_KEY = "@goalzone_mem_news_v2";
  // v2: backend switched to the football-only feed; older entries hold all-sports news
  const CACHE_KEY = "@goalzone_api_cache_news_v2";
  const CACHE_TIME_KEY = "@goalzone_api_cache_news_v2_time";

  // 1. Instant in-memory check (skipped on pull-to-refresh)
  const memData = force ? null : getFromMemoryCache(MEM_KEY);
  if (memData && memData.length > 0) {
    return memData;
  }

  // 2. Persistent storage check
  try {
    const cachedTime = force ? null : await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = force ? null : await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      // Cache news for 10 minutes (600,000 ms)
      if (now - parsedTime < 600000) {
        const parsed = JSON.parse(cachedData);
        setMemoryCache(MEM_KEY, parsed, 600000);
        console.log("[Cache] Using cached football news.");
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Error reading news cache:", err);
  }

  console.log("[API] Fetching fresh football news from backend...");
  try {
    const response = await api.get("/football-get-news");
    const newsData = findArray(response.data);

    if (newsData && newsData.length > 0) {
      setMemoryCache(MEM_KEY, newsData, 600000);
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newsData));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.warn("Error saving news cache:", err);
      }
    }

    return newsData;
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
};

export interface VideoHighlight {
  id: string;
  title: string;
  published: string;
  channel: string;
  competition: string;
  leagueId: string | null;
  thumbnail: string;
  url: string;
}

// Latest match highlights from official league / broadcaster YouTube channels. Throws on failure.
export const fetchVideoHighlights = async (force = false): Promise<VideoHighlight[]> => {
  const CACHE_KEY = "@goalzone_api_cache_highlights";
  const CACHE_TIME_KEY = "@goalzone_api_cache_highlights_time";
  const TTL = 15 * 60 * 1000;

  if (!force) {
    try {
      const [cachedTime, cachedData] = await Promise.all([
        AsyncStorage.getItem(CACHE_TIME_KEY),
        AsyncStorage.getItem(CACHE_KEY),
      ]);
      if (cachedTime && cachedData && Date.now() - parseInt(cachedTime, 10) < TTL) {
        return JSON.parse(cachedData);
      }
    } catch (err) {
      console.warn("Error reading highlights cache:", err);
    }
  }

  const response = await api.get("/football-get-highlights", { timeout: 20000 });
  const videos: VideoHighlight[] = Array.isArray(response.data) ? response.data : [];
  if (videos.length > 0) {
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(videos)).catch(() => {});
    AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString()).catch(() => {});
  }
  return videos;
};

export const fetchLeagueStandings = async (
  leagueid: string | number,
): Promise<any[]> => {
  if (!leagueid) return [];

  const CACHE_KEY = `@goalzone_api_cache_standings_v2_${leagueid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_standings_time_v2_${leagueid}`;
  const PATH_CACHE_KEY = "@goalzone_api_standings_path";

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      // Cache standings for 10 minutes (600,000 ms)
      if (now - parsedTime < 600000) {
        console.log(`[Cache] Using cached standings for league ${leagueid}.`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading standings cache:", err);
  }

  // Get or try potential standings endpoints
  let successfulPath = await AsyncStorage.getItem(PATH_CACHE_KEY);
  const pathsToTry = successfulPath
    ? [successfulPath]
    : [
        "/football-get-standing-all",
        "/football-get-standings",
        "/football-standings",
        "/football-standing",
        "/football-get-table",
        "/football-table",
        "/football-get-league-table",
        "/football-get-stage",
      ];

  console.log(`[API] Fetching standings for league ${leagueid}...`);

  for (const path of pathsToTry) {
    try {
      console.log(`[API] Trying standings path: ${path}`);
      const response = await api.get(path, { params: { leagueid } });

      if (response.status === 200 && response.data) {
        const standingsData = findArray(response.data);
        console.log(`[API] Successfully fetched standings from: ${path}`);

        // Cache the successful path to prevent retrying in the future
        await AsyncStorage.setItem(PATH_CACHE_KEY, path);

        try {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(standingsData));
          await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        } catch (err) {
          console.warn("Error saving standings cache:", err);
        }

        return standingsData;
      }
    } catch (error: any) {
      console.log(`[API] Path ${path} failed: ${error.message || error}`);
    }
  }

  // If the cached path failed (e.g. API updated), delete cache and retry once with all paths
  if (successfulPath) {
    await AsyncStorage.removeItem(PATH_CACHE_KEY);
    return fetchLeagueStandings(leagueid);
  }

  return [];
};

export const fetchCountries = async () => {
  const MEM_KEY = "@goalzone_mem_countries";
  const CACHE_KEY = "@goalzone_api_cache_countries";
  const CACHE_TIME_KEY = "@goalzone_api_cache_countries_time";

  // 1. Instant in-memory check
  const memData = getFromMemoryCache(MEM_KEY);
  if (memData && memData.length > 0) {
    return memData;
  }

  // 2. Persistent storage check
  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      // Cache countries for 1 day (86,400,000 ms) since they don't change
      if (now - parsedTime < 86400000) {
        const parsed = JSON.parse(cachedData);
        setMemoryCache(MEM_KEY, parsed, 86400000);
        console.log("[Cache] Using cached countries list.");
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Error reading countries cache:", err);
  }

  console.log("[API] Fetching fresh countries list from API...");
  try {
    const response = await api.get("/football-get-all-countries");
    const countriesData = findArray(response.data);

    if (countriesData && countriesData.length > 0) {
      setMemoryCache(MEM_KEY, countriesData, 86400000);
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(countriesData));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.warn("Error saving countries cache:", err);
      }
    }

    return countriesData;
  } catch (error) {
    console.error("Error fetching countries:", error);
    return [];
  }
};

export const fetchHomeTeamLineup = async (eventid: string | number, force = false) => {
  if (!eventid) return null;
  const CACHE_KEY = `@goalzone_api_cache_home_lineup_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_home_lineup_time_${eventid}`;

  const hasLineupData = (d: any) =>
    d &&
    (
      (d.starters?.length > 0) ||
      (d.startXI?.length > 0) ||
      (d.lineup?.starters?.length > 0) ||
      (d.lineup?.startXI?.length > 0)
    );

  try {
    if (!force) {
      const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);

      if (cachedTime && cachedData) {
        const parsedTime = parseInt(cachedTime, 10);
        const now = Date.now();
        const parsed = JSON.parse(cachedData);
        if (hasLineupData(parsed) && now - parsedTime < 300000) {
          console.log(`[Cache] Using cached home lineup for event ${eventid}.`);
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("Error reading home lineup cache:", err);
  }

  console.log(
    `[API] Fetching fresh home lineup for event ${eventid} from API...`,
  );
  try {
    const response = await fetchWithBackendFallback("/football-get-hometeam-lineup", {
      eventid,
      ...(force ? { force: "true" } : {}),
    });
    const freshData = response.data || null;

    // Only cache if real data exists
    if (hasLineupData(freshData)) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.warn("Error saving home lineup cache:", err);
      }
    }

    return freshData;
  } catch (error) {
    console.error("Error fetching home lineup:", error);
    return null;
  }
};

export const fetchAwayTeamLineup = async (eventid: string | number, force = false) => {
  if (!eventid) return null;
  const CACHE_KEY = `@goalzone_api_cache_away_lineup_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_away_lineup_time_${eventid}`;

  const hasLineupData = (d: any) =>
    d &&
    (
      (d.starters?.length > 0) ||
      (d.startXI?.length > 0) ||
      (d.lineup?.starters?.length > 0) ||
      (d.lineup?.startXI?.length > 0)
    );

  try {
    if (!force) {
      const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);

      if (cachedTime && cachedData) {
        const parsedTime = parseInt(cachedTime, 10);
        const now = Date.now();
        const parsed = JSON.parse(cachedData);
        if (hasLineupData(parsed) && now - parsedTime < 300000) {
          console.log(`[Cache] Using cached away lineup for event ${eventid}.`);
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("Error reading away lineup cache:", err);
  }

  console.log(
    `[API] Fetching fresh away lineup for event ${eventid} from API...`,
  );
  try {
    const response = await fetchWithBackendFallback("/football-get-awayteam-lineup", {
      eventid,
      ...(force ? { force: "true" } : {}),
    });
    const freshData = response.data || null;

    // Only cache if real data exists
    if (hasLineupData(freshData)) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.warn("Error saving away lineup cache:", err);
      }
    }

    return freshData;
  } catch (error) {
    console.error("Error fetching away lineup:", error);
    return null;
  }
};

export const fetchFixtureStatistics = async (
  eventid: string | number,
  force = false,
  isLive = false
) => {
  if (!eventid) return [];
  const CACHE_KEY = `@goalzone_api_cache_stats_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_stats_time_${eventid}`;

  try {
    if (!force) {
      const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);

      if (cachedTime && cachedData) {
        const parsedTime = parseInt(cachedTime, 10);
        const now = Date.now();
        const maxAge = isLive ? 300000 : 86400000; // 5 min for live, 24 hours for finished
        const parsed = JSON.parse(cachedData);
        // Only serve cache if it has real stats (non-empty array) and within maxAge
        if (Array.isArray(parsed) && parsed.length > 0 && now - parsedTime < maxAge) {
          console.log(`[Cache] Using cached statistics for event ${eventid}.`);
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("Error reading statistics cache:", err);
  }

  console.log(
    `[API] Fetching fresh statistics for event ${eventid} from API...`,
  );
  try {
    const response = await api.get("/football-get-match-statistics", {
      params: {
        eventid,
        ...(force ? { force: "true" } : {}),
        ...(isLive ? { live: "true" } : {}),
      },
    });
    const freshData = response.data || [];

    // Only cache non-empty stats
    if (Array.isArray(freshData) && freshData.length > 0) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.warn("Error saving statistics cache:", err);
      }
    }

    return freshData;
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return [];
  }
};

export const fetchFixturePredictions = async (eventid: string | number) => {
  if (!eventid) return null;
  // v2: older entries can hold the backend's former mock predictions
  const CACHE_KEY = `@goalzone_api_cache_predictions_v2_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_predictions_v2_time_${eventid}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      // Cache predictions for 2 hours (7,200,000 ms) since they don't change frequently
      if (now - parsedTime < 7200000) {
        console.log(`[Cache] Using cached predictions for event ${eventid}.`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading predictions cache:", err);
  }

  console.log(
    `[API] Fetching fresh predictions for event ${eventid} from API...`,
  );
  try {
    const response = await api.get("/football-get-predictions", {
      params: { eventid },
    });
    const freshData = response.data || null;

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving predictions cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error("Error fetching predictions:", error);
    return null;
  }
};

export const fetchFixtureEvents = async (
  eventid: string | number,
  force = false,
  isLive = false
) => {
  if (!eventid) return [];
  const CACHE_KEY = `@goalzone_api_cache_events_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_events_time_${eventid}`;

  try {
    if (!force) {
      const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);

      if (cachedTime && cachedData) {
        const parsedTime = parseInt(cachedTime, 10);
        const now = Date.now();
        const maxAge = isLive ? 45000 : 86400000; // 45s live, 24 hours finished
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && now - parsedTime < maxAge) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("Error reading events cache:", err);
  }

  try {
    const response = await api.get("/football-get-match-events", {
      params: {
        eventid,
        ...(force ? { force: "true" } : {}),
        ...(isLive ? { live: "true" } : {}),
      },
    });
    const freshData = response.data || [];
    if (Array.isArray(freshData)) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.warn("Error saving events cache:", err);
      }
    }
    return freshData;
  } catch (error) {
    console.error("Error fetching match events:", error);
    return [];
  }
};

// Returns { [playerId]: { rating, minutes, captain } } for every player that has a rating
export const fetchPlayerRatings = async (
  eventid: string | number,
  finished = false,
): Promise<Record<string, { rating: number; minutes: number | null; captain: boolean }>> => {
  if (!eventid) return {};
  try {
    const response = await api.get("/football-get-player-ratings", {
      params: { eventid, finished },
    });
    const list = Array.isArray(response.data) ? response.data : [];
    const ratings: Record<string, { rating: number; minutes: number | null; captain: boolean }> = {};
    list.forEach((item: any) => {
      if (item?.id && typeof item.rating === "number") {
        ratings[String(item.id)] = {
          rating: item.rating,
          minutes: item.minutes ?? null,
          captain: !!item.captain,
        };
      }
    });
    return ratings;
  } catch (error) {
    // 404 until the backend with /football-get-player-ratings is deployed; ratings are optional
    console.warn("Player ratings unavailable:", (error as any)?.message || error);
    return {};
  }
};

// Anonymous per-install id so each device gets one vote per match
const DEVICE_ID_KEY = "@goalzone_device_id";
let deviceIdPromise: Promise<string> | null = null;

export const getDeviceId = (): Promise<string> => {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (stored) return stored;
      } catch (err) {
        console.warn("Error reading device id:", err);
      }
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      try {
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      } catch (err) {
        console.warn("Error saving device id:", err);
      }
      return id;
    })();
  }
  return deviceIdPromise;
};

export type PredictionChoice = "home" | "draw" | "away";

export interface MatchPredictionTally {
  home: number;
  draw: number;
  away: number;
  total: number;
  myVote: PredictionChoice | null;
}

// Community "Who will win?" tally for a match, including this device's pick. Throws on failure.
export const fetchMatchPrediction = async (
  eventid: string | number,
): Promise<MatchPredictionTally> => {
  const deviceId = await getDeviceId();
  const response = await api.get("/football-get-match-prediction", {
    params: { eventid, deviceId },
  });
  return response.data;
};

// Casts (or changes) this device's pick and returns the updated tally. Throws on failure.
export const submitMatchPrediction = async (
  eventid: string | number,
  choice: PredictionChoice,
): Promise<MatchPredictionTally> => {
  const deviceId = await getDeviceId();
  const response = await api.post("/football-match-prediction", {
    eventid: String(eventid),
    deviceId,
    choice,
  });
  return response.data;
};

export const fetchFixtureH2H = async (homeId: string | number, awayId: string | number) => {
  if (!homeId || !awayId) return null;
  try {
    const response = await api.get("/football-get-h2h", {
      params: { homeId, awayId },
    });
    return response.data || null;
  } catch (error) {
    console.error("Error fetching H2H:", error);
    return null;
  }
};

export const fetchLeagueFixtures = async (leagueid: string | number) => {
  if (!leagueid) return [];
  const CACHE_KEY = `@goalzone_api_cache_league_fixtures_${leagueid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_league_fixtures_time_${leagueid}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      if (now - parsedTime < 600000) {
        // 10 minutes cache
        console.log(`[Cache] Using cached fixtures for league ${leagueid}.`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading league fixtures cache:", err);
  }

  console.log(
    `[API] Fetching fresh fixtures for league ${leagueid} from API...`,
  );
  try {
    const response = await api.get("/football-get-fixtures-by-league", {
      params: { leagueid },
    });
    const freshData = findArray(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving league fixtures cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error("Error fetching league fixtures:", error);
    return [];
  }
};

export const fetchPopularTeams = async () => {
  const CACHE_KEY = "@goalzone_api_cache_popular_teams";
  const CACHE_TIME_KEY = "@goalzone_api_cache_popular_teams_time";

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsed = JSON.parse(cachedData);
      // Only use cache if it has actual data
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        const parsedTime = parseInt(cachedTime, 10);
        const now = Date.now();
        if (now - parsedTime < 86400000) {
          // 24 hours cache
          console.log("[Cache] Using cached popular teams:", parsed.length);
          return parsed;
        }
      } else {
        // Cached empty data - invalidate cache so we refetch
        console.warn(
          "[Cache] Cached popular teams is empty, clearing cache to refetch.",
        );
        await AsyncStorage.removeItem(CACHE_KEY);
        await AsyncStorage.removeItem(CACHE_TIME_KEY);
      }
    }
  } catch (err) {
    console.warn("Error reading popular teams cache:", err);
  }

  console.log("[API] Fetching fresh popular teams from backend...");
  try {
    const response = await api.get("/football-get-popular-teams");
    const teamsData = findArray(response.data);
    console.log("[API] Popular teams fetched:", teamsData?.length);

    if (teamsData && teamsData.length > 0) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(teamsData));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.warn("Error saving popular teams cache:", err);
      }
    }

    return teamsData;
  } catch (error) {
    console.error("Error fetching popular teams:", error);
    return [];
  }
};

export const fetchTeamFixtures = async (teamid: string | number) => {
  if (!teamid) return [];
  // v2: now includes recent results and both teams for each fixture
  const CACHE_KEY = `@goalzone_api_cache_team_fixtures_v2_${teamid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_team_fixtures_v2_time_${teamid}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      if (now - parsedTime < 600000) {
        // 10 minutes cache
        console.log(`[Cache] Using cached fixtures for team ${teamid}.`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading team fixtures cache:", err);
  }

  console.log(`[API] Fetching fresh fixtures for team ${teamid} from API...`);
  try {
    const response = await api.get("/football-get-fixtures-by-team", {
      params: { teamid },
    });
    const freshData = findArray(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving team fixtures cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error("Error fetching team fixtures:", error);
    return [];
  }
};

export const fetchTeamSquad = async (teamid: string | number) => {
  if (!teamid) return [];
  // v2: players are objects (name, number, age, photo), older entries were plain names
  const CACHE_KEY = `@goalzone_api_cache_team_squad_v2_${teamid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_team_squad_v2_time_${teamid}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      if (now - parsedTime < 86400000) {
        // 24 hours cache
        console.log(`[Cache] Using cached squad for team ${teamid}.`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading team squad cache:", err);
  }

  console.log(`[API] Fetching fresh squad for team ${teamid} from API...`);
  try {
    const response = await api.get("/football-get-team-squad", {
      params: { teamid },
    });
    const freshData = findArray(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving team squad cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error('Error fetching team squad:', error);
    return [];
  }
};

export const fetchTeamByCountry = async (country: string) => {
  if (!country) return null;
  const CACHE_KEY = `@goalzone_api_cache_team_search_${country}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_team_search_time_${country}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      if (now - parsedTime < 86400000) { // 24 hours cache
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading team search cache:", err);
  }

  try {
    const response = await api.get('/football-find-team-by-country', { params: { country } });
    const freshData = response.data;

    if (freshData) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.warn("Error saving team search cache:", err);
      }
    }

    return freshData;
  } catch (error) {
    console.error('Error finding team by country:', error);
    return null;
  }
};
