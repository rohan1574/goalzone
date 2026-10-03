const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dotenv = require("dotenv");
const { initFirebase } = require("./firebase");
const {
  getCachedLiveScores,
  startLiveScorePolling,
  stopLiveScorePolling,
} = require("./liveScoreManager");
const { cache } = require("./cache");

dotenv.config();

// Initialize Firebase Admin SDK
initFirebase();

const app = express();
const PORT = process.env.PORT || 3000;
const APISPORTS_URL =
  process.env.APISPORTS_URL ||
  process.env.THIRD_PARTY_API_URL ||
  "https://v3.football.api-sports.io";
const APISPORTS_KEY =
  process.env.APISPORTS_KEY || process.env.THIRD_PARTY_API_KEY || "";

if (!APISPORTS_KEY) {
  console.error("[Error] APISPORTS_KEY is not defined in .env file!");
}

app.use(cors());
app.use(express.json());

// API Client Instance
const api = axios.create({
  baseURL: APISPORTS_URL,
  headers: {
    "x-apisports-key": APISPORTS_KEY,
  },
});

// Helper to handle API requests and cache them
async function fetchAndCache(cacheKey, endpoint, params, ttlSeconds, mapper) {
  const cachedData = cache.get(cacheKey);
  if (cachedData !== null) {
    return cachedData;
  }

  console.log(`[API Call] Requesting ${endpoint} with params:`, params);
  try {
    const response = await api.get(endpoint, { params });
    if (
      response.data &&
      response.data.errors &&
      Object.keys(response.data.errors).length > 0
    ) {
      console.error(
        `[API Error] Errors returned from api-football:`,
        response.data.errors,
      );
      throw new Error(JSON.stringify(response.data.errors));
    }

    const mappedData = mapper(response.data);
    cache.set(cacheKey, mappedData, ttlSeconds);
    return mappedData;
  } catch (err) {
    console.error(
      `[API Request Failed] Endpoint: ${endpoint}, Error:`,
      err.message || err,
    );
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

app.get("/football-current-live", (req, res) => {
  const data = getCachedLiveScores();
  res.setHeader("Cache-Control", "public, max-age=15");

  // If cache has matches list, return it
  if (data && Array.isArray(data.matches) && data.matches.length > 0) {
    return res.json(data.matches);
  }

  // Fallback to fetchAndCache if in-memory poller hasn't populated yet
  const cacheKey = "current_live_matches_fallback";
  fetchAndCache(cacheKey, "/fixtures", { live: "all" }, 60, (apiResponse) => {
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
        ? `${item.fixture.status.elapsed}'`
        : item.fixture.status.short,
      status: item.fixture.status.short,
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
// 2. POPULAR LEAGUES
// ==========================================
const popularLeagues = [
  {
    leagueId: "39",
    leagueName: "Premier League",
    country: "England",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png",
  },
  {
    leagueId: "140",
    leagueName: "La Liga",
    country: "Spain",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/87.png",
  },
  {
    leagueId: "135",
    leagueName: "Serie A",
    country: "Italy",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/55.png",
  },
  {
    leagueId: "78",
    leagueName: "Bundesliga",
    country: "Germany",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/54.png",
  },
  {
    leagueId: "61",
    leagueName: "Ligue 1",
    country: "France",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/53.png",
  },
  {
    leagueId: "253",
    leagueName: "MLS",
    country: "USA",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/130.png",
  },
  {
    leagueId: "307",
    leagueName: "Saudi Pro League",
    country: "Saudi Arabia",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/307.png",
  },
  {
    leagueId: "2",
    leagueName: "UEFA Champions League",
    country: "International Tournaments",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/42.png",
  },
  {
    leagueId: "3",
    leagueName: "UEFA Europa League",
    country: "International Tournaments",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/82.png",
  },
  {
    leagueId: "13",
    leagueName: "Copa Libertadores",
    country: "International Tournaments",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/44.png",
  },
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

// ==========================================
// 2.1 AGGREGATED DASHBOARD ENDPOINT
// ==========================================
app.get("/football-dashboard", async (req, res) => {
  const dateQuery = req.query.date || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const cacheKey = `dashboard_aggregated_${dateQuery}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader("Cache-Control", "public, max-age=30");
    return res.json(cached);
  }

  try {
    // 1. Live matches from cache or fallback
    let live = [];
    const liveScoreData = getCachedLiveScores();
    if (liveScoreData && Array.isArray(liveScoreData.matches) && liveScoreData.matches.length > 0) {
      live = liveScoreData.matches;
    } else {
      live = cache.get("current_live_matches_fallback") || [];
    }

    // 2. Fixtures by date
    const formattedDate = `${dateQuery.substring(0, 4)}-${dateQuery.substring(4, 6)}-${dateQuery.substring(6, 8)}`;
    const fixturesCacheKey = `fixtures_date_${dateQuery}`;
    let fixtures = cache.get(fixturesCacheKey);

    if (!fixtures) {
      fixtures = await fetchAndCache(
        fixturesCacheKey,
        "/fixtures",
        { date: formattedDate },
        1800,
        (apiResponse) => {
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
              ? `${item.fixture.status.elapsed}'`
              : item.fixture.status.short,
            status: item.fixture.status.short,
          }));
        },
      );
    }

    const payload = {
      live,
      leagues: popularLeagues,
      fixtures: fixtures || [],
      teams: popularTeams,
    };

    cache.set(cacheKey, payload, 60);
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: "Failed to load dashboard data", message: err.message });
  }
});

// ==========================================
// 3. MATCHES BY DATE
// ==========================================
app.get("/football-get-matches-by-date", async (req, res) => {
  const dateQuery = req.query.date;
  if (!dateQuery || dateQuery.length !== 8) {
    return res
      .status(400)
      .json({ error: "Invalid date format. Expected YYYYMMDD" });
  }

  const formattedDate = `${dateQuery.substring(0, 4)}-${dateQuery.substring(4, 6)}-${dateQuery.substring(6, 8)}`;
  const cacheKey = `fixtures_date_${dateQuery}`;

  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures",
      { date: formattedDate },
      1800,
      (apiResponse) => {
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
            ? `${item.fixture.status.elapsed}'`
            : item.fixture.status.short,
          status: item.fixture.status.short,
        }));
      },
    );

    res.json(data);
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
      1800,
      (apiResponse) => {
        const list = apiResponse.response || [];
        return list.map((item) => {
          const fixtureDate = item.fixture.date
            ? new Date(item.fixture.date)
            : new Date();
          const time = fixtureDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const date = `${String(fixtureDate.getDate()).padStart(2, "0")}/${String(fixtureDate.getMonth() + 1).padStart(2, "0")}`;

          return {
            id: String(item.fixture.id),
            status: item.fixture.status.short || "NS",
            time,
            date,
            home: {
              id: item.teams.home.id,
              name: item.teams.home.name,
              logo: item.teams.home.logo,
            },
            away: {
              id: item.teams.away.id,
              name: item.teams.away.name,
              logo: item.teams.away.logo,
            },
          };
        });
      },
    );

    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch league fixtures", message: err.message });
  }
});

app.get("/football-get-fixtures-by-team", async (req, res) => {
  const teamid = req.query.teamid;
  if (!teamid) {
    return res.status(400).json({ error: "Missing teamid parameter" });
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const cacheKey = `fixtures_team_${teamid}_${todayStr}`;

  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures",
      { team: teamid, next: 20 },
      1800,
      (apiResponse) => {
        const list = apiResponse.response || [];
        return list.map((item) => {
          const fixtureDate = item.fixture.date
            ? new Date(item.fixture.date)
            : new Date();
          const time = fixtureDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const date = `${String(fixtureDate.getDate()).padStart(2, "0")}/${String(fixtureDate.getMonth() + 1).padStart(2, "0")}`;

          const isHome = String(item.teams.home.id) === String(teamid);
          const opponent = isHome ? item.teams.away : item.teams.home;

          return {
            id: String(item.fixture.id),
            status: item.fixture.status.short || "NS",
            time,
            date,
            isHome,
            opponent: opponent.name,
            opponentLogo: opponent.logo,
          };
        });
      },
    );

    res.json(data);
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

  const cacheKey = `squad_team_${teamid}`;

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
          const pos = p.position;
          if (pos === "Goalkeeper") positions.Goalkeepers.push(p.name);
          else if (pos === "Defender") positions.Defenders.push(p.name);
          else if (pos === "Midfielder") positions.Midfielders.push(p.name);
          else if (pos === "Attacker") positions.Forwards.push(p.name);
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
  if (list.length === 0) return null;

  const idx = side === "home" ? 0 : 1;
  const apiLineup = list[idx];
  if (!apiLineup) return null;

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
      verticalLayout: { x, y },
    };
  });

  const mappedSubs = subs.map((item) => {
    const p = item.player;
    return {
      id: p.id,
      name: p.name,
      shirtNumber: String(p.number || ""),
    };
  });

  return {
    lineup: {
      id: apiLineup.team.id,
      name: apiLineup.team.name,
      formation: apiLineup.formation || "N/A",
      starters: mappedStarters,
      subs: mappedSubs,
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

app.get("/football-get-hometeam-lineup", async (req, res) => {
  const eventid = req.query.eventid;
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (!/^\d+$/.test(eventid)) {
    return res.json(getMockLineup(eventid, "home"));
  }

  const cacheKey = `lineup_home_${eventid}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures/lineups",
      { fixture: eventid },
      86400,
      (apiResponse) => {
        return translateLineup(apiResponse, "home");
      },
    );
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
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (!/^\d+$/.test(eventid)) {
    return res.json(getMockLineup(eventid, "away"));
  }

  const cacheKey = `lineup_away_${eventid}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures/lineups",
      { fixture: eventid },
      86400,
      (apiResponse) => {
        return translateLineup(apiResponse, "away");
      },
    );
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
  const seasonsToTry = [currentYear, 2024, 2023];
  let lastError = null;

  for (const season of seasonsToTry) {
    const cacheKey = `standings_${leagueid}_${season}`;
    try {
      const data = await fetchAndCache(
        cacheKey,
        "/standings",
        { league: leagueid, season },
        14400,
        (apiResponse) => {
          const list = apiResponse.response || [];
          if (list.length === 0) return [];

          const apiStandings = list[0]?.league?.standings?.[0] || [];
          return apiStandings.map((item) => ({
            teamId: item.team.id,
            teamName: item.team.name,
            logoUrl: item.team.logo,
            pos: item.rank,
            played: item.all.played,
            goalsDiff: item.goalsDiff,
            points: item.points,
          }));
        },
      );

      return res.json(data);
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
    }
  }

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

  const cacheKey = `location_${eventid}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures",
      { id: eventid },
      86400,
      (apiResponse) => {
        const list = apiResponse.response || [];
        const item = list[0];
        return {
          venue: item?.fixture?.venue?.name || "Football Arena",
          city: item?.fixture?.venue?.city || "",
        };
      },
    );

    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch match location", message: err.message });
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
app.get("/football-get-news", async (req, res) => {
  const cacheKey = "football_news";

  try {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const response = await axios.get("https://www.skysports.com/rss/12040", {
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
      description = description.replace(/<[^>]*>/g, "");
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
        title,
        description,
        thumbnail,
        date: pubDate,
        link,
      });
    }

    cache.set(cacheKey, items, 300);
    res.json(items);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch football news", message: err.message });
  }
});

// ==========================================
// 8. MATCH STATISTICS & PREDICTIONS
// ==========================================
function getMockStats(eventid) {
  return [
    { name: "Possession", home: "50%", away: "50%", homePct: 50, awayPct: 50 },
    { name: "Shots", home: "10", away: "10", homePct: 50, awayPct: 50 },
    { name: "Shots on Target", home: "4", away: "4", homePct: 50, awayPct: 50 },
    { name: "Fouls", home: "12", away: "12", homePct: 50, awayPct: 50 },
    { name: "Corner Kicks", home: "5", away: "5", homePct: 50, awayPct: 50 },
    { name: "Yellow Cards", home: "2", away: "2", homePct: 50, awayPct: 50 },
  ];
}

function parseFixtureStats(apiResponse) {
  const responseList = apiResponse.response || [];
  if (responseList.length === 0) return getMockStats("generic");

  const homeTeamStats = responseList[0]?.statistics || [];
  const awayTeamStats = responseList[1]?.statistics || [];

  const targetStats = [
    { key: "Ball Possession", name: "Possession" },
    { key: "Total Shots", name: "Shots" },
    { key: "Shots on Goal", name: "Shots on Target" },
    { key: "Fouls", name: "Fouls" },
    { key: "Corner Kicks", name: "Corner Kicks" },
    { key: "Yellow Cards", name: "Yellow Cards" },
  ];

  return targetStats.map((target) => {
    const homeStat = homeTeamStats.find((s) => s.type === target.key);
    const awayStat = awayTeamStats.find((s) => s.type === target.key);

    let homeValStr =
      homeStat?.value !== null && homeStat?.value !== undefined
        ? String(homeStat.value)
        : "0";
    let awayValStr =
      awayStat?.value !== null && awayStat?.value !== undefined
        ? String(awayStat.value)
        : "0";

    let homeValNum = parseFloat(homeValStr.replace("%", "")) || 0;
    let awayValNum = parseFloat(awayValStr.replace("%", "")) || 0;

    let homePct = 50;
    let awayPct = 50;

    const total = homeValNum + awayValNum;
    if (total > 0) {
      homePct = Math.round((homeValNum / total) * 100);
      awayPct = Math.round((awayValNum / total) * 100);
    }

    return {
      name: target.name,
      home: homeValStr,
      away: awayValStr,
      homePct,
      awayPct,
    };
  });
}

app.get("/football-get-match-statistics", async (req, res) => {
  const eventid = req.query.eventid;
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (isNaN(Number(eventid))) {
    return res.json(getMockStats(eventid));
  }

  const cacheKey = `stats_event_${eventid}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/fixtures/statistics",
      { fixture: eventid },
      60,
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

function getMockPredictions(eventid) {
  return {
    advice: "Double chance : home team or draw",
    percent: {
      home: "40%",
      draw: "35%",
      away: "25%",
    },
    winner: "Home Team",
  };
}

function parsePredictions(apiResponse) {
  const list = apiResponse.response || [];
  if (list.length === 0) return getMockPredictions("generic");

  const pred = list[0]?.predictions;
  if (!pred) return getMockPredictions("generic");

  return {
    advice: pred.advice || "No advice available",
    percent: {
      home: pred.percent?.home || "33%",
      draw: pred.percent?.draw || "34%",
      away: pred.percent?.away || "33%",
    },
    winner: pred.winner?.name || "Draw",
  };
}

app.get("/football-get-predictions", async (req, res) => {
  const eventid = req.query.eventid;
  if (!eventid) {
    return res.status(400).json({ error: "Missing eventid parameter" });
  }

  if (isNaN(Number(eventid))) {
    return res.json(getMockPredictions(eventid));
  }

  const cacheKey = `predictions_event_${eventid}`;
  try {
    const data = await fetchAndCache(
      cacheKey,
      "/predictions",
      { fixture: eventid },
      86400,
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
  res.json({
    status: "ok",
    uptime: process.uptime(),
    lastUpdated: cacheData.lastUpdated,
    liveMatches: cacheData.count,
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

  // Start dynamic polling loop in background
  startLiveScorePolling();
});

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  stopLiveScorePolling();

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
