import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

// Contabo VPS hosted live backend URL
const BACKEND_URL = "http://62.84.190.145";

export const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000, // 10s timeout prevents 30s hangs
  headers: {
    "Content-Type": "application/json",
  },
});

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
    const aggRes = await api.get("/football-dashboard", {
      params: { date: formatFootballDate(0) },
    });
    if (aggRes.data && aggRes.data.teams && aggRes.data.teams.length > 0) {
      const response = {
        data: {
          live: aggRes.data.live || [],
          leagues: aggRes.data.leagues || [],
          fixtures: aggRes.data.fixtures || [],
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
    console.log("[API] Aggregated dashboard not available, falling back to parallel endpoints.");
  }

  // 3. Fallback: Concurrent parallel fetch without artificial rate-limit delays
  const data: { [key: string]: any[] } = {
    live: [],
    leagues: [],
    fixtures: [],
    teams: [],
  };
  let hasPartialFailure = false;

  const [liveSettled, leaguesSettled, fixturesSettled, teamsSettled] =
    await Promise.allSettled([
      api.get("/football-current-live"),
      api.get("/football-popular-leagues"),
      api.get("/football-get-matches-by-date", {
        params: { date: formatFootballDate(0) },
      }),
      api.get("/football-get-popular-teams"),
    ]);

  if (liveSettled.status === "fulfilled") {
    data.live = findArray(liveSettled.value.data);
  } else {
    hasPartialFailure = true;
  }

  if (leaguesSettled.status === "fulfilled") {
    data.leagues = findArray(leaguesSettled.value.data);
  } else {
    hasPartialFailure = true;
  }

  if (fixturesSettled.status === "fulfilled") {
    data.fixtures = findArray(fixturesSettled.value.data);
  } else {
    hasPartialFailure = true;
  }

  if (teamsSettled.status === "fulfilled") {
    data.teams = findArray(teamsSettled.value.data);
  }

  const response = {
    data,
    hasPartialFailure,
  };

  if (data.teams && data.teams.length > 0) {
    setMemoryCache(MEM_KEY, response, 300000);
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(response));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving dashboard cache:", err);
    }
  }

  return response;
};

export const fetchFixturesByDate = async (dateString: string) => {
  const MEM_KEY = `@goalzone_mem_fixtures_${dateString}`;
  const CACHE_KEY = `@goalzone_api_cache_fixtures_${dateString}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_fixtures_time_${dateString}`;

  // 1. In-memory check (instant)
  const memData = getFromMemoryCache(MEM_KEY);
  if (memData) {
    return memData;
  }

  // 2. Persistent storage check (15 minutes TTL)
  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      if (now - parsedTime < 900000) { // 15 minutes TTL
        const parsed = JSON.parse(cachedData);
        setMemoryCache(MEM_KEY, parsed, 900000);
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
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
    const response = await api.get("/football-get-matches-by-date", {
      params: { date: dateString, timezone: userTimezone },
    });
    const freshData = findArray(response.data);

    // Save to memory cache and AsyncStorage
    setMemoryCache(MEM_KEY, freshData, 900000);
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving fixtures cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error("Error fetching fixtures:", error);
    return [];
  }
};

export const prefetchAdjacentDates = (baseDate: Date = new Date()) => {
  const offsets = [-2, -1, 1, 2, 3];
  offsets.forEach((offset) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const yyyymmdd = `${year}${month}${day}`;
    fetchFixturesByDate(yyyymmdd).catch(() => {});
  });
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

export const fetchFootballNews = async () => {
  const MEM_KEY = "@goalzone_mem_news";
  const CACHE_KEY = "@goalzone_api_cache_news";
  const CACHE_TIME_KEY = "@goalzone_api_cache_news_time";

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

export const fetchLeagueStandings = async (
  leagueid: string | number,
): Promise<any[]> => {
  if (!leagueid) return [];

  const CACHE_KEY = `@goalzone_api_cache_standings_${leagueid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_standings_time_${leagueid}`;
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

export const fetchHomeTeamLineup = async (eventid: string | number) => {
  if (!eventid) return null;
  const CACHE_KEY = `@goalzone_api_cache_home_lineup_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_home_lineup_time_${eventid}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      const parsed = JSON.parse(cachedData);
      // Only serve cache if it has real lineup data (not null/empty)
      const hasData = parsed && (parsed.starters?.length > 0 || parsed.startXI?.length > 0 || parsed.lineup?.starters?.length > 0);
      if (hasData && now - parsedTime < 300000) {
        console.log(`[Cache] Using cached home lineup for event ${eventid}.`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Error reading home lineup cache:", err);
  }

  console.log(
    `[API] Fetching fresh home lineup for event ${eventid} from API...`,
  );
  try {
    const response = await api.get("/football-get-hometeam-lineup", {
      params: { eventid },
    });
    const freshData = unwrapApiResponse(response.data);
    const hasData = freshData && (freshData.starters?.length > 0 || freshData.startXI?.length > 0 || freshData.lineup?.starters?.length > 0);

    // Only cache if real data exists
    if (hasData) {
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

export const fetchAwayTeamLineup = async (eventid: string | number) => {
  if (!eventid) return null;
  const CACHE_KEY = `@goalzone_api_cache_away_lineup_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_away_lineup_time_${eventid}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      const parsed = JSON.parse(cachedData);
      // Only serve cache if it has real lineup data (not null/empty)
      const hasData = parsed && (parsed.starters?.length > 0 || parsed.startXI?.length > 0 || parsed.lineup?.starters?.length > 0);
      if (hasData && now - parsedTime < 300000) {
        console.log(`[Cache] Using cached away lineup for event ${eventid}.`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Error reading away lineup cache:", err);
  }

  console.log(
    `[API] Fetching fresh away lineup for event ${eventid} from API...`,
  );
  try {
    const response = await api.get("/football-get-awayteam-lineup", {
      params: { eventid },
    });
    const freshData = unwrapApiResponse(response.data);
    const hasData = freshData && (freshData.starters?.length > 0 || freshData.startXI?.length > 0 || freshData.lineup?.starters?.length > 0);

    // Only cache if real data exists
    if (hasData) {
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

export const fetchFixtureStatistics = async (eventid: string | number) => {
  if (!eventid) return [];
  const CACHE_KEY = `@goalzone_api_cache_stats_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_stats_time_${eventid}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      const parsed = JSON.parse(cachedData);
      // Only serve cache if it has real stats (non-empty array)
      if (Array.isArray(parsed) && parsed.length > 0 && now - parsedTime < 60000) {
        console.log(`[Cache] Using cached statistics for event ${eventid}.`);
        return parsed;
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
      params: { eventid },
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
  const CACHE_KEY = `@goalzone_api_cache_predictions_${eventid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_predictions_time_${eventid}`;

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

export const fetchFixtureEvents = async (eventid: string | number) => {
  if (!eventid) return [];
  try {
    const response = await api.get("/football-get-match-events", {
      params: { eventid },
    });
    return response.data || [];
  } catch (error) {
    console.error("Error fetching match events:", error);
    return [];
  }
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
  const CACHE_KEY = `@goalzone_api_cache_team_fixtures_${teamid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_team_fixtures_time_${teamid}`;

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
  const CACHE_KEY = `@goalzone_api_cache_team_squad_${teamid}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_team_squad_time_${teamid}`;

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
