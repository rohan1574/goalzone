// ==========================================
// SHARED API-FOOTBALL RESPONSE MAPPERS
// ==========================================
// Used by both the HTTP routes (server.js) and the background sync engine
// (syncEngine.js) so cached data always has the exact shape the app expects.

// Leagues shown anywhere in the app (date lists, live scores, dashboard)
const POPULAR_LEAGUE_IDS_SET = new Set([
  '39', '140', '135', '78', '61', '2', '3', '848', '88', '94',
  '71', '128', '253', '307', '13', '1', '4', '9', '10', '11', '15', '393', '239'
]);

const NOT_STARTED_STATUSES = new Set(['NS', 'TBD', 'PST', 'CANC']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO', 'PST']);

const teamShort = (team) => team.code || team.name.substring(0, 3).toUpperCase();

/**
 * /fixtures?date= → list shown by /football-get-matches-by-date and /football-dashboard.
 * Both routes share one cache key, so this is the union of the fields either route used.
 */
function mapDateFixtures(apiResponse) {
  const rawList = apiResponse.response || [];
  const list = rawList.filter((item) => POPULAR_LEAGUE_IDS_SET.has(String(item.league.id)));
  return list.map((item) => {
    const statusShort = item.fixture.status.short || "NS";
    const score = NOT_STARTED_STATUSES.has(statusShort)
      ? "VS"
      : `${item.goals.home ?? 0} - ${item.goals.away ?? 0}`;
    const fixtureDate = item.fixture.date ? new Date(item.fixture.date) : null;
    const time = fixtureDate
      ? fixtureDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "19:00";

    return {
      id: String(item.fixture.id),
      league: item.league.name,
      leagueId: String(item.league.id),
      leagueLogo: item.league.logo,
      leagueCountry: item.league.country,
      home: {
        id: item.teams.home.id,
        name: item.teams.home.name,
        short: teamShort(item.teams.home),
        logo: item.teams.home.logo,
      },
      away: {
        id: item.teams.away.id,
        name: item.teams.away.name,
        short: teamShort(item.teams.away),
        logo: item.teams.away.logo,
      },
      score,
      minute: item.fixture.status.elapsed
        ? `${item.fixture.status.elapsed}'`
        : statusShort,
      status: statusShort,
      time,
      date: item.fixture.date,
      timestamp: item.fixture.timestamp,
    };
  });
}

/** /fixtures?league=&next= → /football-get-fixtures-by-league */
function mapLeagueFixtures(apiResponse) {
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
      rawDate: item.fixture.date,
      timestamp: item.fixture.timestamp,
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
}

/** /standings → /football-get-standing-all */
function mapStandings(apiResponse) {
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
}

/** /fixtures?id= (venue part) → /football-get-match-location */
function mapLocation(fixtureItem) {
  return {
    venue: fixtureItem?.fixture?.venue?.name || "Football Arena",
    city: fixtureItem?.fixture?.venue?.city || "",
  };
}

/** /fixtures/statistics → /football-get-match-statistics */
function parseFixtureStats(apiResponse) {
  const responseList = apiResponse.response || [];
  if (responseList.length === 0) return [];

  const homeTeamStats = responseList[0]?.statistics || [];
  const awayTeamStats = responseList[1]?.statistics || [];
  if (homeTeamStats.length === 0 && awayTeamStats.length === 0) return [];

  const targetStats = [
    { key: "Shots on Goal", name: "Shots on Target" },
    { key: "Shots off Goal", name: "Shots off Target" },
    { key: "Blocked Shots", name: "Blocked Shots" },
    { key: "Ball Possession", name: "Possession (%)" },
    { key: "Corner Kicks", name: "Corner Kicks" },
    { key: "Offsides", name: "Offsides" },
    { key: "Fouls", name: "Fouls" },
    { key: "Goalkeeper Saves", name: "Goalkeeper Saves" },
    { key: "Yellow Cards", name: "Yellow Cards" },
    { key: "Red Cards", name: "Red Cards" },
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

/** /fixtures/events → /football-get-match-events */
function parseFixtureEvents(apiResponse) {
  const list = apiResponse?.response || [];
  return list.map((item, idx) => ({
    id: `${item.team?.id}-${item.time?.elapsed}-${idx}`,
    type: item.type === "Goal" ? "goal" :
          item.type === "subst" ? "subst" :
          item.type === "Card" ? "card" : item.type.toLowerCase(),
    detail: item.detail || "",
    minute: item.time?.extra ? `${item.time.elapsed}+${item.time.extra}'` : `${item.time?.elapsed}'`,
    elapsed: item.time?.elapsed || 0,
    teamId: item.team?.id,
    teamName: item.team?.name || "",
    teamLogo: item.team?.logo || "",
    player: item.player?.name || "Player",
    assist: item.assist?.name || null
  }));
}

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

/** /predictions → /football-get-predictions */
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

module.exports = {
  POPULAR_LEAGUE_IDS_SET,
  NOT_STARTED_STATUSES,
  FINISHED_STATUSES,
  mapDateFixtures,
  mapLeagueFixtures,
  mapStandings,
  mapLocation,
  parseFixtureStats,
  parseFixtureEvents,
  parsePredictions,
  getMockPredictions,
};
