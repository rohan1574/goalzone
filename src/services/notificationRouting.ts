import {
  fetchFixturesByDate,
  fetchLiveMatches,
  getAllCachedFixtures,
  getMatchEventId,
  getMatchScore,
  warmupFixturesCache,
} from "./footballApi";

export type MatchDetailsTab = "infor" | "stats" | "lineup" | "table" | "h2h" | "players";

export interface NotificationTarget {
  matchId: string;
  tab: MatchDetailsTab;
}

// Which match and Match Details tab a tapped push alert should open.
// Goal / kickoff alerts open the Infor tab, lineup alerts open the Lineup tab.
export const getNotificationTarget = (notification: any): NotificationTarget | null => {
  const request = notification?.request;
  // Android delivers FCM data on the trigger, iOS on the notification content
  const data = {
    ...(request?.trigger as any)?.remoteMessage?.data,
    ...request?.content?.data,
  };
  if (!data.matchId) return null;

  const isLineup = data.type === "LINEUP_ANNOUNCED" || data.screen === "lineup";
  return { matchId: String(data.matchId), tab: isLineup ? "lineup" : "infor" };
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

export const findMatchForNotification = async ({ matchId, tab }: NotificationTarget) => {
  const isTarget = (m: any) => String(getMatchEventId(m) || m?.id) === matchId;

  // A tap can cold-start the app before the fixtures cache has been loaded into memory
  await warmupFixturesCache();
  let match = getAllCachedFixtures().find(isTarget);

  // Lineups come out before kickoff, so only goal / kickoff alerts are in the live feed.
  // The live feed has the current score, so prefer it while the match is on.
  if (tab !== "lineup") {
    try {
      match = (await fetchLiveMatches())?.find(isTarget) || match;
    } catch (_) {}
  }
  // The live feed only has homeScore / awayScore; without a score line the details
  // screen treats the match as not started
  if (match) return { ...match, score: match.score || getMatchScore(match).display };

  // Not cached yet: look in today's fixtures, then the neighbouring day
  // (a lineup alert just before midnight is for tomorrow, a goal just after is from yesterday)
  const today = new Date();
  const neighbour = new Date(today);
  neighbour.setDate(today.getDate() + (tab === "lineup" ? 1 : -1));
  for (const date of [today, neighbour]) {
    try {
      match = (await fetchFixturesByDate(toDateKey(date)))?.find(isTarget);
      if (match) return match;
    } catch (_) {}
  }
  return null;
};
