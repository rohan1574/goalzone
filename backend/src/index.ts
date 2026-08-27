import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { cache } from './cache';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const APISPORTS_URL = process.env.APISPORTS_URL || 'https://v3.football.api-sports.io';
const APISPORTS_KEY = process.env.APISPORTS_KEY || '';

if (!APISPORTS_KEY) {
  console.error('[Error] APISPORTS_KEY is not defined in .env file!');
}

app.use(cors());
app.use(express.json());

// API Client Instance
const api = axios.create({
  baseURL: APISPORTS_URL,
  headers: {
    'x-apisports-key': APISPORTS_KEY,
  },
});

// Helper to handle API requests and cache them
async function fetchAndCache(cacheKey: string, endpoint: string, params: any, ttlSeconds: number, mapper: (data: any) => any) {
  const cachedData = cache.get(cacheKey);
  if (cachedData !== null) {
    return cachedData;
  }

  console.log(`[API Call] Requesting ${endpoint} with params:`, params);
  try {
    const response = await api.get(endpoint, { params });
    if (response.data && response.data.errors && Object.keys(response.data.errors).length > 0) {
      console.error(`[API Error] Errors returned from api-football:`, response.data.errors);
      throw new Error(JSON.stringify(response.data.errors));
    }

    const mappedData = mapper(response.data);
    cache.set(cacheKey, mappedData, ttlSeconds);
    return mappedData;
  } catch (err: any) {
    console.error(`[API Request Failed] Endpoint: ${endpoint}, Error:`, err.message || err);
    throw err;
  }
}

// 1. Live Matches Adapter
app.get('/football-current-live', async (req, res) => {
  const cacheKey = 'current_live_matches';
  
  try {
    const data = await fetchAndCache(cacheKey, '/fixtures', { live: 'all' }, 120, (apiResponse: any) => {
      const list = apiResponse.response || [];
      return list.map((item: any) => ({
        id: String(item.fixture.id),
        league: item.league.name,
        leagueId: String(item.league.id),
        leagueLogo: item.league.logo,
        home: {
          id: item.teams.home.id,
          name: item.teams.home.name,
          short: item.teams.home.code || item.teams.home.name.substring(0, 3).toUpperCase(),
          logo: item.teams.home.logo,
        },
        away: {
          id: item.teams.away.id,
          name: item.teams.away.name,
          short: item.teams.away.code || item.teams.away.name.substring(0, 3).toUpperCase(),
          logo: item.teams.away.logo,
        },
        score: `${item.goals.home ?? 0} - ${item.goals.away ?? 0}`,
        minute: item.fixture.status.elapsed ? `${item.fixture.status.elapsed}'` : item.fixture.status.short,
        status: item.fixture.status.short,
      }));
    });
    
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch live matches', message: err.message });
  }
});

// 2. Popular Leagues (Static Adapter - Saves 100% of league quota)
app.get('/football-popular-leagues', (req, res) => {
  // Return static list to keep API requests to 0 for popular leagues
  const popularLeagues = [
    {
      leagueId: '39',
      leagueName: 'Premier League',
      leagueLogo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/47.png'
    },
    {
      leagueId: '140',
      leagueName: 'La Liga',
      leagueLogo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/87.png'
    },
    {
      leagueId: '135',
      leagueName: 'Serie A',
      leagueLogo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/55.png'
    },
    {
      leagueId: '253',
      leagueName: 'MLS',
      leagueLogo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/130.png'
    },
    {
      leagueId: '2',
      leagueName: 'UEFA Champions League',
      leagueLogo: 'https://images.fotmob.com/image_resources/logo/leaguelogo/42.png'
    }
  ];
  res.json(popularLeagues);
});

// 3. Matches by Date Adapter
app.get('/football-get-matches-by-date', async (req, res) => {
  const dateQuery = req.query.date as string;
  if (!dateQuery || dateQuery.length !== 8) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYYMMDD' });
  }

  const formattedDate = `${dateQuery.substring(0, 4)}-${dateQuery.substring(4, 6)}-${dateQuery.substring(6, 8)}`;
  const cacheKey = `fixtures_date_${dateQuery}`;

  try {
    const data = await fetchAndCache(cacheKey, '/fixtures', { date: formattedDate }, 1800, (apiResponse: any) => {
      const list = apiResponse.response || [];
      return list.map((item: any) => ({
        id: String(item.fixture.id),
        league: item.league.name,
        leagueId: String(item.league.id),
        leagueLogo: item.league.logo,
        home: {
          id: item.teams.home.id,
          name: item.teams.home.name,
          short: item.teams.home.code || item.teams.home.name.substring(0, 3).toUpperCase(),
          logo: item.teams.home.logo,
        },
        away: {
          id: item.teams.away.id,
          name: item.teams.away.name,
          short: item.teams.away.code || item.teams.away.name.substring(0, 3).toUpperCase(),
          logo: item.teams.away.logo,
        },
        score: `${item.goals.home ?? 0} - ${item.goals.away ?? 0}`,
        minute: item.fixture.status.elapsed ? `${item.fixture.status.elapsed}'` : item.fixture.status.short,
        status: item.fixture.status.short,
      }));
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch matches by date', message: err.message });
  }
});

// Helper for Lineup translation
const translateLineup = (apiResponse: any, side: 'home' | 'away') => {
  const list = apiResponse.response || [];
  if (list.length === 0) return null;

  // api-football returns home lineup at index 0, away at index 1
  const idx = side === 'home' ? 0 : 1;
  const apiLineup = list[idx];
  if (!apiLineup) return null;

  const starters = apiLineup.startXI || [];
  const subs = apiLineup.substitutes || [];

  // Group starters by row to resolve coordinate mappings
  const rowPlayersMap: { [row: string]: any[] } = {};
  starters.forEach((item: any) => {
    const p = item.player;
    const grid = p.grid || ''; // e.g. "1:1", "2:4"
    const [rowStr, colStr] = grid.split(':');
    const row = parseInt(rowStr, 10) || 1;
    const col = parseInt(colStr, 10) || 1;

    if (!rowPlayersMap[row]) {
      rowPlayersMap[row] = [];
    }
    rowPlayersMap[row].push({ player: p, col });
  });

  const maxRow = Math.max(...Object.keys(rowPlayersMap).map(Number), 4);

  const mappedStarters = starters.map((item: any) => {
    const p = item.player;
    const grid = p.grid || '';
    const [rowStr, colStr] = grid.split(':');
    const row = parseInt(rowStr, 10) || 1;
    const col = parseInt(colStr, 10) || 1;

    const playersInRow = rowPlayersMap[row] || [];
    playersInRow.sort((a: any, b: any) => a.col - b.col);
    const count = playersInRow.length;
    const index = playersInRow.findIndex((pr: any) => pr.player.id === p.id);

    // Calculate vertical position (y)
    let y = 0.5;
    if (maxRow > 1) {
      y = 0.1 + (row - 1) * (0.75 / (maxRow - 1));
    } else {
      y = 0.1;
    }

    // Calculate horizontal position (x)
    let x = 0.5;
    if (count > 1) {
      x = 0.1 + index * (0.8 / (count - 1));
    } else {
      x = 0.5;
    }

    return {
      id: p.id,
      name: p.name,
      shirtNumber: String(p.number || ''),
      verticalLayout: { x, y }
    };
  });

  const mappedSubs = subs.map((item: any) => {
    const p = item.player;
    return {
      id: p.id,
      name: p.name,
      shirtNumber: String(p.number || '')
    };
  });

  return {
    lineup: {
      id: apiLineup.team.id,
      name: apiLineup.team.name,
      formation: apiLineup.formation || 'N/A',
      starters: mappedStarters,
      subs: mappedSubs
    }
  };
};

// Helper to return high-fidelity mock lineups for mock/test matches
function getMockLineup(eventid: string, side: 'home' | 'away') {
  const isHome = side === 'home';
  
  if (eventid.includes('laliga') || eventid.includes('clasico') || eventid.includes('barcelona') || eventid.includes('realmadrid')) {
    if (isHome) {
      // Real Madrid Lineup
      return {
        lineup: {
          id: 8633,
          name: "Real Madrid",
          formation: "4-3-3",
          starters: [
            { id: 372, name: "Thibaut Courtois", shirtNumber: "1", verticalLayout: { x: 0.5, y: 0.9 } },
            { id: 373, name: "Dani Carvajal", shirtNumber: "2", verticalLayout: { x: 0.15, y: 0.7 } },
            { id: 374, name: "Eder Militao", shirtNumber: "3", verticalLayout: { x: 0.38, y: 0.75 } },
            { id: 375, name: "Antonio Rudiger", shirtNumber: "22", verticalLayout: { x: 0.62, y: 0.75 } },
            { id: 376, name: "Ferland Mendy", shirtNumber: "23", verticalLayout: { x: 0.85, y: 0.7 } },
            { id: 377, name: "Federico Valverde", shirtNumber: "8", verticalLayout: { x: 0.25, y: 0.45 } },
            { id: 378, name: "Aurelien Tchouameni", shirtNumber: "14", verticalLayout: { x: 0.5, y: 0.5 } },
            { id: 379, name: "Jude Bellingham", shirtNumber: "5", verticalLayout: { x: 0.75, y: 0.45 } },
            { id: 380, name: "Rodrygo Goes", shirtNumber: "11", verticalLayout: { x: 0.2, y: 0.2 } },
            { id: 381, name: "Kylian Mbappe", shirtNumber: "9", verticalLayout: { x: 0.5, y: 0.15 } },
            { id: 382, name: "Vinicius Junior", shirtNumber: "7", verticalLayout: { x: 0.8, y: 0.2 } }
          ],
          subs: [
            { id: 383, name: "Luka Modric", shirtNumber: "10" },
            { id: 384, name: "Arda Guler", shirtNumber: "15" },
            { id: 385, name: "Brahim Diaz", shirtNumber: "21" }
          ]
        }
      };
    } else {
      // Barcelona Lineup
      return {
        lineup: {
          id: 8634,
          name: "Barcelona",
          formation: "4-2-3-1",
          starters: [
            { id: 390, name: "Marc-Andre ter Stegen", shirtNumber: "1", verticalLayout: { x: 0.5, y: 0.9 } },
            { id: 391, name: "Jules Kounde", shirtNumber: "23", verticalLayout: { x: 0.15, y: 0.7 } },
            { id: 392, name: "Pau Cubarsi", shirtNumber: "2", verticalLayout: { x: 0.38, y: 0.75 } },
            { id: 393, name: "Inigo Martinez", shirtNumber: "5", verticalLayout: { x: 0.62, y: 0.75 } },
            { id: 394, name: "Alejandro Balde", shirtNumber: "3", verticalLayout: { x: 0.85, y: 0.7 } },
            { id: 395, name: "Pedri Gonzalez", shirtNumber: "8", verticalLayout: { x: 0.35, y: 0.5 } },
            { id: 396, name: "Marc Casado", shirtNumber: "17", verticalLayout: { x: 0.65, y: 0.5 } },
            { id: 397, name: "Lamine Yamal", shirtNumber: "19", verticalLayout: { x: 0.2, y: 0.3 } },
            { id: 398, name: "Dani Olmo", shirtNumber: "20", verticalLayout: { x: 0.5, y: 0.3 } },
            { id: 399, name: "Raphinha Dias", shirtNumber: "11", verticalLayout: { x: 0.8, y: 0.3 } },
            { id: 400, name: "Robert Lewandowski", shirtNumber: "9", verticalLayout: { x: 0.5, y: 0.15 } }
          ],
          subs: [
            { id: 401, name: "Frenkie de Jong", shirtNumber: "21" },
            { id: 402, name: "Gavi", shirtNumber: "6" },
            { id: 403, name: "Ferran Torres", shirtNumber: "7" }
          ]
        }
      };
    }
  }

  // Fallback generic mock lineups for other matches
  if (isHome) {
    return {
      lineup: {
        id: 9991,
        name: "Home Team",
        formation: "4-4-2",
        starters: [
          { id: 501, name: "Goalkeeper H", shirtNumber: "1", verticalLayout: { x: 0.5, y: 0.9 } },
          { id: 502, name: "Defender HL", shirtNumber: "3", verticalLayout: { x: 0.15, y: 0.7 } },
          { id: 503, name: "Defender HC1", shirtNumber: "4", verticalLayout: { x: 0.38, y: 0.75 } },
          { id: 504, name: "Defender HC2", shirtNumber: "5", verticalLayout: { x: 0.62, y: 0.75 } },
          { id: 505, name: "Defender HR", shirtNumber: "2", verticalLayout: { x: 0.85, y: 0.7 } },
          { id: 506, name: "Midfielder HL", shirtNumber: "6", verticalLayout: { x: 0.15, y: 0.45 } },
          { id: 507, name: "Midfielder HC1", shirtNumber: "8", verticalLayout: { x: 0.38, y: 0.45 } },
          { id: 508, name: "Midfielder HC2", shirtNumber: "10", verticalLayout: { x: 0.62, y: 0.45 } },
          { id: 509, name: "Midfielder HR", shirtNumber: "7", verticalLayout: { x: 0.85, y: 0.45 } },
          { id: 510, name: "Forward HL", shirtNumber: "9", verticalLayout: { x: 0.35, y: 0.2 } },
          { id: 511, name: "Forward HR", shirtNumber: "11", verticalLayout: { x: 0.65, y: 0.2 } }
        ],
        subs: [
          { id: 512, name: "Substitute H1", shirtNumber: "12" },
          { id: 513, name: "Substitute H2", shirtNumber: "14" }
        ]
      }
    };
  } else {
    return {
      lineup: {
        id: 9992,
        name: "Away Team",
        formation: "4-3-3",
        starters: [
          { id: 601, name: "Goalkeeper A", shirtNumber: "1", verticalLayout: { x: 0.5, y: 0.9 } },
          { id: 602, name: "Defender AL", shirtNumber: "3", verticalLayout: { x: 0.15, y: 0.7 } },
          { id: 603, name: "Defender AC1", shirtNumber: "4", verticalLayout: { x: 0.38, y: 0.75 } },
          { id: 604, name: "Defender AC2", shirtNumber: "5", verticalLayout: { x: 0.62, y: 0.75 } },
          { id: 605, name: "Defender AR", shirtNumber: "2", verticalLayout: { x: 0.85, y: 0.7 } },
          { id: 606, name: "Midfielder AL", shirtNumber: "8", verticalLayout: { x: 0.25, y: 0.45 } },
          { id: 607, name: "Midfielder AC", shirtNumber: "6", verticalLayout: { x: 0.5, y: 0.5 } },
          { id: 608, name: "Midfielder AR", shirtNumber: "10", verticalLayout: { x: 0.75, y: 0.45 } },
          { id: 609, name: "Forward AL", shirtNumber: "7", verticalLayout: { x: 0.2, y: 0.2 } },
          { id: 610, name: "Forward AC", shirtNumber: "9", verticalLayout: { x: 0.5, y: 0.15 } },
          { id: 611, name: "Forward AR", shirtNumber: "11", verticalLayout: { x: 0.8, y: 0.2 } }
        ],
        subs: [
          { id: 612, name: "Substitute A1", shirtNumber: "12" },
          { id: 613, name: "Substitute A2", shirtNumber: "14" }
        ]
      }
    };
  }
}

// 4. Lineups (Home Team) Adapter
app.get('/football-get-hometeam-lineup', async (req, res) => {
  const eventid = req.query.eventid as string;
  if (!eventid) {
    return res.status(400).json({ error: 'Missing eventid parameter' });
  }

  // Intercept mock non-numeric IDs and serve mock lineups immediately
  if (!/^\d+$/.test(eventid)) {
    console.log(`[Mock Lineup] Serving mock home lineup for non-numeric ID: ${eventid}`);
    return res.json(getMockLineup(eventid, 'home'));
  }

  const cacheKey = `lineup_home_${eventid}`;

  try {
    const data = await fetchAndCache(cacheKey, '/fixtures/lineups', { fixture: eventid }, 86400, (apiResponse: any) => {
      return translateLineup(apiResponse, 'home');
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch home team lineup', message: err.message });
  }
});

// 5. Lineups (Away Team) Adapter
app.get('/football-get-awayteam-lineup', async (req, res) => {
  const eventid = req.query.eventid as string;
  if (!eventid) {
    return res.status(400).json({ error: 'Missing eventid parameter' });
  }

  // Intercept mock non-numeric IDs and serve mock lineups immediately
  if (!/^\d+$/.test(eventid)) {
    console.log(`[Mock Lineup] Serving mock away lineup for non-numeric ID: ${eventid}`);
    return res.json(getMockLineup(eventid, 'away'));
  }

  const cacheKey = `lineup_away_${eventid}`;

  try {
    const data = await fetchAndCache(cacheKey, '/fixtures/lineups', { fixture: eventid }, 86400, (apiResponse: any) => {
      return translateLineup(apiResponse, 'away');
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch away team lineup', message: err.message });
  }
});

// 6. Standings Table Adapter
app.get('/football-get-standing-all', async (req, res) => {
  const leagueid = req.query.leagueid as string;
  if (!leagueid || leagueid === 'undefined' || leagueid === 'null') {
    return res.status(400).json({ error: 'Missing or invalid leagueid parameter' });
  }

  const currentYear = new Date().getFullYear();
  // Try current year first, fallback to 2024/2023 if plan doesn't support it (e.g. Free plan)
  const seasonsToTry = [currentYear, 2024, 2023];
  let lastError = null;

  for (const season of seasonsToTry) {
    const cacheKey = `standings_${leagueid}_${season}`;
    try {
      console.log(`[API] Attempting to fetch standings for league ${leagueid}, season ${season}...`);
      const data = await fetchAndCache(cacheKey, '/standings', { league: leagueid, season }, 14400, (apiResponse: any) => {
        const list = apiResponse.response || [];
        if (list.length === 0) return [];
        
        const apiStandings = list[0]?.league?.standings?.[0] || [];
        return apiStandings.map((item: any) => ({
          teamId: item.team.id,
          teamName: item.team.name,
          logoUrl: item.team.logo,
          pos: item.rank,
          played: item.all.played,
          goalsDiff: item.goalsDiff,
          points: item.points
        }));
      });

      console.log(`[API] Standings successfully loaded for season ${season}`);
      return res.json(data);
    } catch (err: any) {
      console.warn(`[API] Standings failed for season ${season}:`, err.message || err);
      lastError = err;
      
      // If it's a plan/access restriction, proceed to the fallback season
      if (err.message && (err.message.includes('plan') || err.message.includes('plans') || err.message.includes('access'))) {
        continue;
      }
      
      // For network errors or other issues, try next season too
    }
  }

  res.status(500).json({ error: 'Failed to fetch standings', message: lastError?.message });
});

// 7. Match Location Adapter
app.get('/football-get-match-location', async (req, res) => {
  const eventid = req.query.eventid as string;
  if (!eventid) {
    return res.status(400).json({ error: 'Missing eventid parameter' });
  }

  const cacheKey = `location_${eventid}`;

  try {
    const data = await fetchAndCache(cacheKey, '/fixtures', { id: eventid }, 86400, (apiResponse: any) => {
      const list = apiResponse.response || [];
      const item = list[0];
      return {
        venue: item?.fixture?.venue?.name || 'Football Arena',
        city: item?.fixture?.venue?.city || ''
      };
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch match location', message: err.message });
  }
});

// 8. Countries Adapter
app.get('/football-get-all-countries', async (req, res) => {
  const cacheKey = 'all_countries';

  try {
    const data = await fetchAndCache(cacheKey, '/countries', {}, 86400, (apiResponse: any) => {
      return apiResponse.response || [];
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch countries list', message: err.message });
  }
});

// 9. News RSS Adapter
app.get('/football-get-news', async (req, res) => {
  const cacheKey = 'football_news';

  try {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log('[API Call] Requesting Sky Sports RSS Feed...');
    const response = await axios.get('https://www.skysports.com/rss/12040', {
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });

    const xmlText = response.data;
    if (typeof xmlText !== 'string') {
      throw new Error('Invalid RSS response type');
    }

    const items: any[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];

      const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || "";
      const link = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1]?.trim() || "";
      let description = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() || "";
      description = description.replace(/<[^>]*>/g, ""); // Strip HTML tags
      const pubDate = itemXml.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/)?.[1]?.trim() || "";

      let thumbnail = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500";
      const enclosureMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/);
      const mediaContentMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/);

      if (enclosureMatch && enclosureMatch[1]) {
        thumbnail = enclosureMatch[1];
      } else if (mediaContentMatch && mediaContentMatch[1]) {
        thumbnail = mediaContentMatch[1];
      }

      items.push({
        id: link || Math.random().toString(),
        title,
        description,
        thumbnail,
        date: pubDate,
        link
      });
    }

    cache.set(cacheKey, items, 300); // Cache for 5 minutes (300 seconds)
    res.json(items);
  } catch (err: any) {
    console.error('[API Request Failed] Endpoint: /football-get-news, Error:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch football news', message: err.message });
  }
});

// Helper for Mock statistics
function getMockStats(eventid: string) {
  if (eventid.includes('laliga') || eventid.includes('clasico') || eventid.includes('barcelona') || eventid.includes('realmadrid')) {
    return [
      { name: "Possession", home: "58%", away: "42%", homePct: 58, awayPct: 42 },
      { name: "Shots", home: "16", away: "9", homePct: 64, awayPct: 36 },
      { name: "Shots on Target", home: "7", away: "4", homePct: 64, awayPct: 36 },
      { name: "Fouls", home: "11", away: "13", homePct: 46, awayPct: 54 },
      { name: "Corner Kicks", home: "8", away: "5", homePct: 62, awayPct: 38 },
      { name: "Yellow Cards", home: "1", away: "3", homePct: 25, awayPct: 75 }
    ];
  }
  
  return [
    { name: "Possession", home: "50%", away: "50%", homePct: 50, awayPct: 50 },
    { name: "Shots", home: "10", away: "10", homePct: 50, awayPct: 50 },
    { name: "Shots on Target", home: "4", away: "4", homePct: 50, awayPct: 50 },
    { name: "Fouls", home: "12", away: "12", homePct: 50, awayPct: 50 },
    { name: "Corner Kicks", home: "5", away: "5", homePct: 50, awayPct: 50 },
    { name: "Yellow Cards", home: "2", away: "2", homePct: 50, awayPct: 50 }
  ];
}

// Helper to translate fixture stats from api-football format
function parseFixtureStats(apiResponse: any) {
  const responseList = apiResponse.response || [];
  if (responseList.length === 0) return getMockStats("generic"); // Fallback if no stats available from API

  const homeTeamStats = responseList[0]?.statistics || [];
  const awayTeamStats = responseList[1]?.statistics || [];

  const targetStats = [
    { key: "Ball Possession", name: "Possession" },
    { key: "Total Shots", name: "Shots" },
    { key: "Shots on Goal", name: "Shots on Target" },
    { key: "Fouls", name: "Fouls" },
    { key: "Corner Kicks", name: "Corner Kicks" },
    { key: "Yellow Cards", name: "Yellow Cards" }
  ];

  return targetStats.map(target => {
    const homeStat = homeTeamStats.find((s: any) => s.type === target.key);
    const awayStat = awayTeamStats.find((s: any) => s.type === target.key);

    let homeValStr = homeStat?.value !== null && homeStat?.value !== undefined ? String(homeStat.value) : "0";
    let awayValStr = awayStat?.value !== null && awayStat?.value !== undefined ? String(awayStat.value) : "0";

    // If it's a percentage (e.g. 54%), parse it
    let homeValNum = parseFloat(homeValStr.replace('%', '')) || 0;
    let awayValNum = parseFloat(awayValStr.replace('%', '')) || 0;

    let homePct = 50;
    let awayPct = 50;

    const total = homeValNum + awayValNum;
    if (total > 0) {
      homePct = Math.round((homeValNum / total) * 100);
      awayPct = Math.round((awayValNum / total) * 100);
    }

    return {
      name: target.name,
      home: homeValStr.includes('%') ? homeValStr : homeValStr,
      away: awayValStr.includes('%') ? awayValStr : awayValStr,
      homePct,
      awayPct
    };
  });
}

// 10. Match Statistics Adapter
app.get('/football-get-match-statistics', async (req, res) => {
  const eventid = req.query.eventid as string;
  if (!eventid) {
    return res.status(400).json({ error: 'Missing eventid parameter' });
  }

  // If it's a mock event ID (contains letters)
  if (isNaN(Number(eventid))) {
    console.log(`[Mock Stats] Returning mock stats for event: ${eventid}`);
    return res.json(getMockStats(eventid));
  }

  const cacheKey = `stats_event_${eventid}`;
  try {
    const data = await fetchAndCache(cacheKey, '/fixtures/statistics', { fixture: eventid }, 60, (apiResponse: any) => {
      return parseFixtureStats(apiResponse);
    });
    res.json(data);
  } catch (err: any) {
    console.error(`[API Request Failed] Endpoint: /football-get-match-statistics, Error:`, err.message || err);
    res.status(500).json({ error: 'Failed to fetch match statistics', message: err.message });
  }
});

// Helper for Mock predictions
function getMockPredictions(eventid: string) {
  if (eventid.includes('laliga') || eventid.includes('clasico') || eventid.includes('barcelona') || eventid.includes('realmadrid')) {
    return {
      advice: "Double chance : draw or Real Madrid",
      percent: {
        home: "45%",
        draw: "30%",
        away: "25%"
      },
      winner: "Real Madrid"
    };
  }

  return {
    advice: "Double chance : home team or draw",
    percent: {
      home: "40%",
      draw: "35%",
      away: "25%"
    },
    winner: "Home Team"
  };
}

// Helper to translate fixture predictions from api-football format
function parsePredictions(apiResponse: any) {
  const list = apiResponse.response || [];
  if (list.length === 0) return getMockPredictions("generic");

  const pred = list[0]?.predictions;
  if (!pred) return getMockPredictions("generic");

  return {
    advice: pred.advice || "No advice available",
    percent: {
      home: pred.percent?.home || "33%",
      draw: pred.percent?.draw || "34%",
      away: pred.percent?.away || "33%"
    },
    winner: pred.winner?.name || "Draw"
  };
}

// 11. Match Predictions Adapter
app.get('/football-get-predictions', async (req, res) => {
  const eventid = req.query.eventid as string;
  if (!eventid) {
    return res.status(400).json({ error: 'Missing eventid parameter' });
  }

  // If it's a mock event ID (contains letters)
  if (isNaN(Number(eventid))) {
    console.log(`[Mock Predictions] Returning mock predictions for event: ${eventid}`);
    return res.json(getMockPredictions(eventid));
  }

  const cacheKey = `predictions_event_${eventid}`;
  try {
    const data = await fetchAndCache(cacheKey, '/predictions', { fixture: eventid }, 86400, (apiResponse: any) => {
      return parsePredictions(apiResponse);
    });
    res.json(data);
  } catch (err: any) {
    console.error(`[API Request Failed] Endpoint: /football-get-predictions, Error:`, err.message || err);
    res.status(500).json({ error: 'Failed to fetch predictions', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] GoalZone backend server listening on port ${PORT}`);
});
