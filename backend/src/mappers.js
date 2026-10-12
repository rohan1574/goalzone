// ==========================================
// SHARED API-FOOTBALL RESPONSE MAPPERS
// ==========================================
// Used by both the HTTP routes (server.js) and the background sync engine
// (syncEngine.js) so cached data always has the exact shape the app expects.

// Leagues shown anywhere in the app (date lists, live scores, dashboard)
const POPULAR_LEAGUE_IDS_SET = new Set([
  '39', '140', '135', '78', '61', '2', '3', '848', '5', '94',
  '71', '128', '253', '307', '13', '1', '4', '9', '10', '11', '15', '393', '239',
  '40', '45', '48', '143', '16'
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
  let list = rawList.filter((item) => POPULAR_LEAGUE_IDS_SET.has(String(item.league.id)));
  if (list.length === 0 && rawList.length > 0) {
    list = rawList;
  }
  return list.map((item) => {
    const statusShort = item.fixture.status.short || "NS";
    const score = NOT_STARTED_STATUSES.has(statusShort)
      ? "VS"
      : `${item.goals.home ?? 0} - ${item.goals.away ?? 0}`;
    const fixtureDate = item.fixture.date ? new Date(item.fixture.date) : null;
    const time = fixtureDate
      ? fixtureDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "19:00";

    const isFinished = FINISHED_STATUSES.has(statusShort);
    let finalStatus = isFinished
      ? (statusShort === "AET" || statusShort === "PEN" ? statusShort : "FT")
      : statusShort;
    let elapsedMinute = statusShort;
    if (item.fixture.status.elapsed && !isFinished) {
      const el = item.fixture.status.elapsed;
      const ex = item.fixture.status.extra;
      if (statusShort === "1H" && el >= 45) {
        const cur = el > 45 ? el - 45 : 0;
        if ((ex && cur > ex) || (!ex && cur >= 6)) {
          finalStatus = "HT";
          elapsedMinute = "HT";
        } else {
          elapsedMinute = ex ? `45+${cur}' (+${ex})` : `45+${cur}'`;
        }
      } else if (statusShort === "2H" && el >= 90) {
        const cur = el > 90 ? el - 90 : 0;
        if ((ex && cur > ex) || (!ex && cur >= 8)) {
          finalStatus = "FT";
          elapsedMinute = "FT";
        } else {
          elapsedMinute = ex ? `90+${cur}' (+${ex})` : `90+${cur}'`;
        }
      } else if (ex) {
        elapsedMinute = `${el}' (+${ex})`;
      } else {
        elapsedMinute = `${el}'`;
      }
    }
    const finalMinute = isFinished ? finalStatus : elapsedMinute;

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
      minute: finalMinute,
      status: finalStatus,
      extra: item.fixture.status.extra ?? null,
      time,
      date: item.fixture.date,
      timestamp: item.fixture.timestamp,
      venue: item.fixture.venue?.name || "",
      venueCity: item.fixture.venue?.city || "",
      round: item.league.round || "",
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

  const rawStandings = list[0]?.league?.standings || [];
  const flattened = Array.isArray(rawStandings[0]) ? rawStandings.flat() : rawStandings;

  return flattened.map((item) => ({
    teamId: item.team?.id,
    teamName: item.team?.name,
    logoUrl: item.team?.logo,
    pos: item.rank,
    played: item.all?.played ?? 0,
    win: item.all?.win ?? 0,
    draw: item.all?.draw ?? 0,
    lose: item.all?.lose ?? 0,
    goalsDiff: item.goalsDiff ?? 0,
    points: item.points ?? 0,
    form: item.form || "",
    description: item.description || "",
    group: item.group || "",
  }));
}

/** /fixtures?id= (venue + round part) → /football-get-match-location */
function mapLocation(fixtureItem) {
  return {
    venue: fixtureItem?.fixture?.venue?.name || "",
    city: fixtureItem?.fixture?.venue?.city || "",
    round: fixtureItem?.league?.round || "",
  };
}

/** /fixtures/players → /football-get-player-ratings (one entry per player who has a rating) */
function mapPlayerRatings(apiResponse) {
  const teams = apiResponse.response || [];
  const ratings = [];
  teams.forEach((teamEntry) => {
    (teamEntry.players || []).forEach((item) => {
      const games = item.statistics?.[0]?.games || {};
      const rating = parseFloat(games.rating);
      if (!item.player?.id || isNaN(rating)) return;
      ratings.push({
        id: item.player.id,
        teamId: teamEntry.team?.id,
        rating: Math.round(rating * 10) / 10,
        minutes: games.minutes ?? null,
        captain: !!games.captain,
      });
    });
  });
  return ratings;
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

const COMPARISON_LABELS = {
  form: "Form",
  att: "Attack",
  def: "Defence",
  poisson_distribution: "Poisson model",
  h2h: "Head to head",
  goals: "Goals",
  total: "Overall",
};
const percentNumber = (value) => {
  const n = parseFloat(String(value ?? "").replace("%", ""));
  return isNaN(n) ? null : n;
};

/**
 * /predictions → /football-get-predictions.
 * Returns null when API-Football has no prediction for the fixture (the app shows "not available").
 */
function parsePredictions(apiResponse) {
  const item = (apiResponse.response || [])[0];
  const pred = item?.predictions;
  if (!pred) return null;

  const comparison = Object.entries(item.comparison || {})
    .map(([key, value]) => ({
      key,
      label: COMPARISON_LABELS[key] || key,
      home: percentNumber(value?.home),
      away: percentNumber(value?.away),
    }))
    .filter((row) => row.home !== null && row.away !== null);

  return {
    advice: pred.advice || null,
    percent: {
      home: percentNumber(pred.percent?.home) ?? 0,
      draw: percentNumber(pred.percent?.draw) ?? 0,
      away: percentNumber(pred.percent?.away) ?? 0,
    },
    winner: pred.winner?.name || null,
    winnerComment: pred.winner?.comment || null,
    comparison,
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
  mapPlayerRatings,
  parseFixtureStats,
  parseFixtureEvents,
  parsePredictions,
};
