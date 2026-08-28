import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Render hosted live backend URL
const BACKEND_URL = "https://goalzone-1-k075.onrender.com";

export const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json'
  },
});

export const hasFootballApiKey = true;

export const formatFootballDate = (addDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + addDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
};


export const scorePaths = {
  home: [
    'scores.home',
    'score.home',
    'goals.home',
    'homeScore',
    'home.score',
    'homeTeam.score',
    'teams.home.score',
    'score.fullTime.home',
    'score.current.home',
    'status.homeScore',
    'status.score.home',
  ],
  away: [
    'scores.away',
    'score.away',
    'goals.away',
    'awayScore',
    'away.score',
    'awayTeam.score',
    'teams.away.score',
    'score.fullTime.away',
    'score.current.away',
    'status.awayScore',
    'status.score.away',
  ],
};


export const getMatchScore = (match: any) => {
  const scoreLine = getMatchValue(
    match,
    ['status.scoreStr', 'scoreStr', 'scores.display', 'score.display', 'score'],
    ''
  );
  
  const home = getMatchValue(match, scorePaths.home, '');
  const away = getMatchValue(match, scorePaths.away, '');
  const hasPair = home !== '' && away !== '';

  if (hasPair) {
    return { home, away, display: `${home} - ${away}`, hasScore: true, hasPair };
  }

  if (scoreLine) {
    return { home: '', away: '', display: scoreLine, hasScore: true, hasPair: false };
  }

  return { home: '', away: '', display: 'VS', hasScore: false, hasPair: false };
};

const statusPaths = ['status.long', 'status.short', 'status.type', 'status'];

export const getMatchStatus = (match: any, fallback = "Scheduled") => {
  const status = match?.status || {};
  
  // If status is a string (primitive status field fallback)
  if (typeof status === 'string') {
    if (status === 'FT' || status.toLowerCase().includes('full')) return 'Full Time';
    if (status === 'HT' || status.toLowerCase().includes('half')) return 'Half Time';
    return status;
  }

  // 1. Check if finished
  if (
    status.finished || 
    status.reason?.short === 'FT' || 
    status.reason?.long === 'Full Time' ||
    match.statusType === 'finished'
  ) {
    return 'Full Time';
  }

  // 2. Check if live
  const isLive = status.liveTime || (status.started && !status.finished) || match.statusType === 'live';
  if (isLive) {
    // Check for Half Time
    if (
      status.reason?.short === 'HT' || 
      status.reason?.long === 'Half Time' || 
      status.liveTime?.short === 'HT' ||
      status.liveTime === 'HT'
    ) {
      return 'Half Time';
    }
    // Return elapsed time
    const elapsed = status.liveTime?.short || status.liveTime?.long || status.liveTime || 'Live';
    return String(elapsed);
  }

  // 3. Not started / Scheduled
  const timeStr = status.startTimeStr || status.time || match.time;
  if (timeStr && typeof timeStr === 'string') return timeStr;

  // Generic fallback using getMatchValue
  const explicitStatus = getMatchValue(match, statusPaths, '');
  if (explicitStatus) {
    if (explicitStatus === 'FT' || explicitStatus === 'Full Time' || explicitStatus === 'Finished') {
      return 'Full Time';
    }
    if (explicitStatus === 'HT' || explicitStatus === 'Half Time') {
      return 'Half Time';
    }
    return explicitStatus;
  }

  return fallback;
};

export const getMatchLeague = (match: any) =>
  getMatchValue(
    match,
    ['league.name', 'competition.name', 'tournament.name', 'league'],
    'Competition'
  );

export const getMatchLeagueId = (match: any) =>
  getMatchValue(
    match,
    ['league.id', 'competition.id', 'tournament.id', 'leagueId'],
    ''
  );

export const getMatchEventId = (match: any) =>
  getMatchValue(
    match,
    [
      'id',
      'eventId',
      'eventid',
      'event_id',
      'matchId',
      'fixture.id',
      'fixture.eventId',
      'detail.matchId'
    ],
    ''
  );

export const findArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  for (const item of Object.values(value)) {
    const found = findArray(item);
    if (found.length) return found;
  }

  return [];
};

export const cleanValue = (value: any, fallback = 'TBD'): string => {
  if (value === 0) return '0';
  if (!value) return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value.name || value.title || value.shortName || fallback;
};

export const getMatchValue = (item: any, paths: string[], fallback = 'TBD'): any =>
  cleanValue(
    paths
      .map((path) => path.split('.').reduce((data, key) => data?.[key], item))
      .find((value) => value || value === 0),
    fallback
  );

export const getImageValue = (item: any, paths: string[]): string => {
  const value = getMatchValue(item, paths, '');
  return value === 'TBD' ? '' : value;
};

export const getTeamLogo = (match: any, side: 'home' | 'away') => {

  const sidePaths = {
    home: [
      'home.logo',
      'home.image',
      'home.crest',
      'homeTeam.logo',
      'homeTeam.image',
      'homeTeam.crest',
      'teams.home.logo',
      'teams.home.image',
      'teams.home.crest',
      'home.logoUrl',
      'homeTeam.logoUrl',
      'teams.home.logoUrl',
    ],
    away: [
      'away.logo',
      'away.image',
      'away.crest',
      'awayTeam.logo',
      'awayTeam.image',
      'awayTeam.crest',
      'teams.away.logo',
      'teams.away.image',
      'teams.away.crest',
      'away.logoUrl',
      'awayTeam.logoUrl',
      'teams.away.logoUrl',
    ],
  }

  const url = getImageValue(match, sidePaths[side] || [])
  if (url) return url

  const teamId = getMatchValue(match, [`${side}.id`, `${side}Team.id`, `teams.${side}.id`])
  if (teamId && teamId !== 'TBD') {
    return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`
  }

  return ''
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const loadFootballDashboard = async (forceRefresh = false) => {
  const CACHE_KEY = "@goalzone_api_cache_dashboard";
  const CACHE_TIME_KEY = "@goalzone_api_cache_dashboard_time";
  
  if (!forceRefresh) {
    try {
      const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      
      if (cachedTime && cachedData) {
        const parsedTime = parseInt(cachedTime, 10);
        const now = Date.now();
        // If less than 5 minutes (300,000 ms) has passed, return cached data
        if (now - parsedTime < 300000) {
          console.log(`[Cache] Using cached dashboard data. Time remaining: ${Math.round((300000 - (now - parsedTime)) / 1000)}s`);
          return JSON.parse(cachedData);
        }
      }
    } catch (err) {
      console.warn("Error reading dashboard cache:", err);
    }
  }

  console.log("[API] Fetching fresh dashboard data from API (sequentially to prevent 429 rate limit)...");
  const data: { [key: string]: any[] } = { live: [], leagues: [], fixtures: [] };
  let hasPartialFailure = false;

  // Request 1: Live matches
  try {
    const res = await api.get('/football-current-live');
    const rawData = res.data;
    console.log("[API] Fulfilled request for live matches. Raw keys:", Object.keys(rawData || {}));
    data.live = findArray(rawData);
  } catch (err: any) {
    console.warn("[API] Request failed for live:", err.response?.data || err.message || err);
    hasPartialFailure = true;
  }

  // Wait 1200ms to avoid 1 request/sec rate limit of RapidAPI Free Tier
  await delay(1200);

  // Request 2: Popular Leagues
  try {
    const res = await api.get('/football-popular-leagues');
    const rawData = res.data;
    console.log("[API] Fulfilled request for leagues. Raw keys:", Object.keys(rawData || {}));
    data.leagues = findArray(rawData);
  } catch (err: any) {
    console.warn("[API] Request failed for leagues:", err.response?.data || err.message || err);
    hasPartialFailure = true;
  }

  // Wait 1200ms to avoid 1 request/sec rate limit
  await delay(1200);

  // Request 3: Fixtures by date
  try {
    const res = await api.get('/football-get-matches-by-date', { params: { date: formatFootballDate(0) } });
    const rawData = res.data;
    console.log("[API] Fulfilled request for fixtures. Raw keys:", Object.keys(rawData || {}));
    data.fixtures = findArray(rawData);
  } catch (err: any) {
    console.warn("[API] Request failed for fixtures:", err.response?.data || err.message || err);
    hasPartialFailure = true;
  }

  const response = {
    data,
    hasPartialFailure,
  };

  // Save to cache only if all sequential API requests succeeded
  if (!hasPartialFailure) {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(response));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      console.log("[Cache] Dashboard cache updated successfully.");
    } catch (err) {
      console.warn("Error saving dashboard cache:", err);
    }
  } else {
    console.log("[Cache] Skipping cache update due to partial/network failure.");
  }

  return response;
};

export const fetchFixturesByDate = async (dateString: string) => {
  const CACHE_KEY = `@goalzone_api_cache_fixtures_${dateString}`;
  const CACHE_TIME_KEY = `@goalzone_api_cache_fixtures_time_${dateString}`;

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      if (now - parsedTime < 60000) {
        console.log(`[Cache] Using cached fixtures for date ${dateString}. Time remaining: ${Math.round((60000 - (now - parsedTime)) / 1000)}s`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn(`Error reading fixtures cache for ${dateString}:`, err);
  }

  console.log(`[API] Fetching fresh fixtures for date ${dateString} from API...`);
  try {
    const response = await api.get('/football-get-matches-by-date', { params: { date: dateString } });
    const freshData = findArray(response.data);

    // Save to cache
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving fixtures cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return [];
  }
};

const unwrapApiResponse = (data: any) => data?.response || data?.data || data || {};

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
        console.log(`[Cache] Using cached match location for event ${eventid}. Time remaining: ${Math.round((60000 - (now - parsedTime)) / 1000)}s`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading match location cache:", err);
  }

  console.log(`[API] Fetching fresh match location for event ${eventid} from API...`);
  try {
    const response = await api.get('/football-get-match-location', { params: { eventid } });
    const freshData = unwrapApiResponse(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving match location cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error('Error fetching match location:', error);
    return {};
  }
};

export const fetchFootballNews = async () => {
  const CACHE_KEY = "@goalzone_api_cache_news";
  const CACHE_TIME_KEY = "@goalzone_api_cache_news_time";

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      // Cache news for 5 minutes (300,000 ms)
      if (now - parsedTime < 300000) {
        console.log("[Cache] Using cached football news.");
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading news cache:", err);
  }

  console.log("[API] Fetching fresh football news from backend...");
  try {
    const response = await api.get('/football-get-news');
    const newsData = findArray(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newsData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving news cache:", err);
    }

    return newsData;
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
};

export const fetchLeagueStandings = async (leagueid: string | number): Promise<any[]> => {
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
        '/football-get-standing-all',
        '/football-get-standings',
        '/football-standings',
        '/football-standing',
        '/football-get-table',
        '/football-table',
        '/football-get-league-table',
        '/football-get-stage'
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
  const CACHE_KEY = "@goalzone_api_cache_countries";
  const CACHE_TIME_KEY = "@goalzone_api_cache_countries_time";

  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    if (cachedTime && cachedData) {
      const parsedTime = parseInt(cachedTime, 10);
      const now = Date.now();
      // Cache countries for 1 day (86,400,000 ms) since they don't change
      if (now - parsedTime < 86400000) {
        console.log("[Cache] Using cached countries list.");
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading countries cache:", err);
  }

  console.log("[API] Fetching fresh countries list from API...");
  try {
    const response = await api.get('/football-get-all-countries');
    const countriesData = findArray(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(countriesData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving countries cache:", err);
    }

    return countriesData;
  } catch (error) {
    console.error('Error fetching countries:', error);
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
      if (now - parsedTime < 300000) {
        console.log(`[Cache] Using cached home lineup for event ${eventid}.`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading home lineup cache:", err);
  }

  console.log(`[API] Fetching fresh home lineup for event ${eventid} from API...`);
  try {
    const response = await api.get('/football-get-hometeam-lineup', { params: { eventid } });
    const freshData = unwrapApiResponse(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving home lineup cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error('Error fetching home lineup:', error);
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
      if (now - parsedTime < 300000) {
        console.log(`[Cache] Using cached away lineup for event ${eventid}.`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading away lineup cache:", err);
  }

  console.log(`[API] Fetching fresh away lineup for event ${eventid} from API...`);
  try {
    const response = await api.get('/football-get-awayteam-lineup', { params: { eventid } });
    const freshData = unwrapApiResponse(response.data);

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving away lineup cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error('Error fetching away lineup:', error);
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
      // Cache stats for 1 minute (60,000 ms) for live/recent games
      if (now - parsedTime < 60000) {
        console.log(`[Cache] Using cached statistics for event ${eventid}.`);
        return JSON.parse(cachedData);
      }
    }
  } catch (err) {
    console.warn("Error reading statistics cache:", err);
  }

  console.log(`[API] Fetching fresh statistics for event ${eventid} from API...`);
  try {
    const response = await api.get('/football-get-match-statistics', { params: { eventid } });
    const freshData = response.data || [];

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving statistics cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error('Error fetching statistics:', error);
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

  console.log(`[API] Fetching fresh predictions for event ${eventid} from API...`);
  try {
    const response = await api.get('/football-get-predictions', { params: { eventid } });
    const freshData = response.data || null;

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn("Error saving predictions cache:", err);
    }

    return freshData;
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return null;
  }
};