// ==========================================
// SHARED API-FOOTBALL RESPONSE MAPPERS
// ==========================================
// Used by both the HTTP routes (server.js) and the background sync engine
// (syncEngine.js) so cached data always has the exact shape the app expects.

// Leagues shown anywhere in the app (date lists, live scores, dashboard)
const POPULAR_LEAGUE_IDS_SET = new Set([
  // England
  '39', '40', '45', '48', '528',
  // Spain
  '140', '141', '143', '556',
  // Italy
  '135', '136', '137', '547',
  // Germany
  '78', '79', '81', '529',
  // France
  '61', '62', '66', '526',
  // Brazil
  '71', '72', '73', '632',
  // USA
  '253', '257', '772',
  // Saudi Arabia
  '307', '504', '826',
  // Asia
  '17', '18',
  // UEFA & Americas & International
  '2', '3', '848', '5', '13', '88', '94', '128', '1', '4', '9', '10', '11', '15', '16', '239', '393'
]);

const NOT_STARTED_STATUSES = new Set(['NS', 'TBD', 'PST', 'CANC']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO', 'PST']);

const teamShort = (team) => team.code || team.name.substring(0, 3).toUpperCase();

// A match still reported as 1H/2H this long after kickoff is a stale feed, not a live game.
// 2H stoppage can end ~120 min after kickoff, so this must stay well above that.
// Extra time (ET/BT/P) is never time-expired: those matches legitimately run 150+ min.
const STALE_LIVE_MINUTES = 135;
const REGULATION_LIVE_STATUSES = new Set(['1H', '2H', 'LIVE']);

function isStaleLiveMatch(statusShort, timestamp) {
  if (!timestamp || !REGULATION_LIVE_STATUSES.has(statusShort)) return false;
  return (Date.now() - timestamp * 1000) / 60000 >= STALE_LIVE_MINUTES;
}

// End minute of the period a live status belongs to, used to split elapsed into base + stoppage.
const periodEndMinute = (statusShort, elapsed) => {
  if (statusShort === '1H') return 45;
  if (statusShort === '2H') return 90;
  if (statusShort === 'ET') return elapsed > 105 ? 120 : 105;
  return null;
};

/**
 * fixture.status → "67'" / "90+3'". API-Football keeps `elapsed` at the period end (45, 90,
 * 105, 120) during stoppage and counts the stoppage minutes played so far in `extra`.
 * It does not expose the announced added time, so `extra` is never treated as a target.
 */
function formatLiveMinute(status) {
  const el = parseInt(status?.elapsed, 10);
  if (isNaN(el)) return null;
  const ex = parseInt(status?.extra, 10);
  if (ex > 0) return `${el}+${ex}'`;
  // Some responses report stoppage as elapsed past the period end (e.g. 93 in 2H) with no `extra`
  const end = periodEndMinute(status?.short, el);
  if (end && el > end) return `${end}+${el - end}'`;
  return `${el}'`;
}

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

    const isFinished =
      FINISHED_STATUSES.has(statusShort) || isStaleLiveMatch(statusShort, item.fixture.timestamp);
    const finalStatus = isFinished
      ? (statusShort === "AET" || statusShort === "PEN" ? statusShort : "FT")
      : statusShort;
    const finalMinute = isFinished
      ? finalStatus
      : formatLiveMinute(item.fixture.status) || statusShort;

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
      league: item.league?.name || "",
      leagueId: item.league?.id ? String(item.league.id) : "",
      leagueLogo: item.league?.logo || "",
      leagueCountry: item.league?.country || "",
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
    playerId: item.player?.id || null,
    assist: item.assist?.name || null,
    assistId: item.assist?.id || null
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

// Player leaderboards: /players/topscorers, /topassists, /topyellowcards, /topredcards
const PLAYER_LEADER_CATEGORIES = {
  topScorers: { endpoint: "/players/topscorers", value: (st) => st.goals?.total },
  topAssists: { endpoint: "/players/topassists", value: (st) => st.goals?.assists },
  yellowCards: { endpoint: "/players/topyellowcards", value: (st) => st.cards?.yellow },
  redCards: { endpoint: "/players/topredcards", value: (st) => st.cards?.red },
};

/** → /football-get-player-leaders (top 10 of one category) */
function mapPlayerLeaders(apiResponse, category) {
  const getValue = PLAYER_LEADER_CATEGORIES[category].value;
  const list = apiResponse.response || [];
  return list
    .map((item) => {
      // A player who changed club within the league has one statistics entry per club
      const statistics = item.statistics || [];
      const sum = (fn) => statistics.reduce((total, st) => total + (Number(fn(st)) || 0), 0);
      const team = statistics[0]?.team || {};
      return {
        id: item.player?.id,
        name: item.player?.name || "Player",
        photo: item.player?.photo || (item.player?.id ? `https://media.api-sports.io/football/players/${item.player.id}.png` : null),
        teamId: team.id ?? null,
        teamName: team.name || "",
        teamLogo: team.logo || "",
        value: sum(getValue),
        appearances: sum((st) => st.games?.appearences),
        penalties: sum((st) => st.penalty?.scored),
      };
    })
    .filter((p) => p.id && p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

module.exports = {
  POPULAR_LEAGUE_IDS_SET,
  NOT_STARTED_STATUSES,
  FINISHED_STATUSES,
  isStaleLiveMatch,
  formatLiveMinute,
  mapDateFixtures,
  mapLeagueFixtures,
  mapStandings,
  mapLocation,
  mapPlayerRatings,
  PLAYER_LEADER_CATEGORIES,
  mapPlayerLeaders,
  parseFixtureStats,
  parseFixtureEvents,
  parsePredictions,
};
