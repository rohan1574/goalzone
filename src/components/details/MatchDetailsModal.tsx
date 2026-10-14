import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, RotateCw, MapPin } from "lucide-react-native";
import Svg, { Path, Circle, Rect, Line as SvgLine } from "react-native-svg";
import {
  fetchHomeTeamLineup,
  fetchAwayTeamLineup,
  fetchLeagueStandings,
  fetchFixtureStatistics,
  fetchFixtureEvents,
  fetchFixtureH2H,
  fetchMatchLocation,
  fetchPlayerRatings,
  fetchPlayerLeaders,
  getMatchKickoffMs,
} from "../../services/footballApi";
import type { PlayerLeader, PlayerLeaders } from "../../services/footballApi";
import BannerAdComponent from "../ads/BannerAdComponent";
import LiveMatchClock from "../common/LiveMatchClock";
import MatchPrediction from "./MatchPrediction";
import type { MatchDetailsTab } from "../../services/notificationRouting";

const zoneColor = (zone: string) => {
  const z = (zone || "").toLowerCase();
  if (!z) return null;
  if (z.includes("relegation")) return "#EF4444";
  if (z.includes("champions league") || z.includes("libertadores")) return "#02DB54";
  if (z.includes("europa league") || z.includes("sudamericana")) return "#60A5FA";
  if (z.includes("conference") || z.includes("ecl")) return "#2DD4BF";
  if (z.includes("promotion") || z.includes("play")) return "#EAB308";
  return "#9CA3AF";
};

const FORM_COLORS: Record<string, string> = { W: "#02DB54", D: "#9CA3AF", L: "#EF4444" };

interface Team {
  id?: string | number;
  name: string;
  short: string;
  logo: string;
}
interface MatchDetailsModalProps {
  visible: boolean;
  match: Match | null;
  // Opens the given tab, e.g. the Lineup tab when a lineup alert is tapped
  tabRequest?: { tab: MatchDetailsTab } | null;
  onClose: () => void;
}

interface Match {
  id: string;
  league: string;
  leagueId?: string | number;
  leagueLogo?: string;
  home: Team;
  away: Team;
  score: string;
  minute: string;
  status: string;
  venue?: string;
  venueCity?: string;
  round?: string;
  extra?: string | number;
  timestamp?: number;
}

interface PlayerRating {
  rating: number;
  minutes: number | null;
  captain: boolean;
}

interface MatchInfo {
  venue: string;
  city: string;
  round: string;
}

type LeaderCategory = "topScorers" | "topAssists" | "yellowCards" | "redCards";

const LEADER_CATEGORIES: { id: LeaderCategory; label: string; unit: [string, string] }[] = [
  { id: "topScorers", label: "Goals", unit: ["goal", "goals"] },
  { id: "topAssists", label: "Assists", unit: ["assist", "assists"] },
  { id: "yellowCards", label: "Yellow Cards", unit: ["yellow", "yellows"] },
  { id: "redCards", label: "Red Cards", unit: ["red", "reds"] },
];

// Live ratings are re-fetched on this interval while the Lineup tab is open
const LIVE_RATINGS_REFRESH_MS = 90000;

// Works out finished / upcoming from the status + minute strings the various match sources send
const getMatchPhase = (match: Match | null) => {
  const statusUpper = String(match?.status || "").trim().toUpperCase();
  const minuteUpper = String(match?.minute || "").trim().toUpperCase();

  const isFinished =
    statusUpper === "FT" ||
    statusUpper === "AET" ||
    statusUpper === "PEN" ||
    statusUpper.includes("FINISH") ||
    statusUpper.includes("ENDED") ||
    statusUpper.includes("FULL TIME") ||
    minuteUpper === "FT" ||
    minuteUpper === "AET" ||
    minuteUpper === "PEN" ||
    minuteUpper.includes("FINISH") ||
    minuteUpper.includes("ENDED") ||
    minuteUpper.includes("FULL TIME");

  const isUpcoming =
    !isFinished &&
    (match?.status === "NS" ||
      match?.status === "Scheduled" ||
      match?.status === "Upcoming" ||
      match?.status === "TBD" ||
      match?.status === "TIMED" ||
      !match?.score ||
      match.score === "VS");

  return { statusUpper, minuteUpper, isFinished, isUpcoming };
};

// "Regular Season - 11" → "Round 11", "Group Stage - 2" → "Group Stage · Round 2", "Final" stays as-is
const formatRound = (round?: string) => {
  if (!round) return "";
  const regular = round.match(/^Regular Season\s*-\s*(\d+)$/i);
  if (regular) return `Round ${regular[1]}`;
  return round.replace(/\s*-\s*(\d+)$/, " · Round $1");
};

// Rating scale colours (same bands most football apps use)
const getRatingColors = (rating: number) => {
  if (rating >= 8) return { bg: "#2563EB", text: "#FFFFFF" };
  if (rating >= 7) return { bg: "#02DB54", text: "#000000" };
  if (rating >= 6.5) return { bg: "#EAB308", text: "#000000" };
  if (rating >= 6) return { bg: "#F97316", text: "#000000" };
  return { bg: "#EF4444", text: "#FFFFFF" };
};

const getPlayerId = (player: any) => player?.id || player?.player?.id;

const RatingBadge = ({ rating, isTop }: { rating: number; isTop?: boolean }) => {
  const colors = getRatingColors(rating);
  return (
    <View
      className="px-1 rounded border border-black flex-row items-center"
      style={{ backgroundColor: colors.bg }}
    >
      {isTop && <Text style={{ color: colors.text }} className="font-black text-[7px] mr-0.5">★</Text>}
      <Text style={{ color: colors.text }} className="font-black text-[8px]">
        {rating.toFixed(1)}
      </Text>
    </View>
  );
};

// Helper to render individual player card on the pitch with player image, shirt number & rating badges
const PlayerCard = ({
  player,
  isHome,
  rating,
  isTopRated,
  eventStats,
}: {
  player: any;
  isHome: boolean;
  rating?: PlayerRating;
  isTopRated?: boolean;
  eventStats?: PlayerEventStats;
}) => {
  const [imgError, setImgError] = useState(false);
  const playerId = getPlayerId(player);
  const photoUrl = player.photo || (playerId ? `https://media.api-sports.io/football/players/${playerId}.png` : null);
  const number = player.shirtNumber || player.number || player.player?.number || "";
  const fullName = player.name || player.player?.name || "";
  const nameParts = fullName.trim().split(" ");
  const shortName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName;

  return (
    <View className="items-center my-1" style={{ width: 60 }}>
      <View className="relative items-center justify-center">
        {photoUrl && !imgError ? (
          <ExpoImage
            source={{ uri: photoUrl }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: isHome ? "#02DB54" : "#60A5FA",
              backgroundColor: "#1E293B",
            }}
            onError={() => setImgError(true)}
            contentFit="cover"
          />
        ) : (
          <View
            className="w-9 h-9 rounded-full items-center justify-center bg-black/70"
            style={{ borderWidth: 1.5, borderColor: isHome ? "#02DB54" : "#60A5FA" }}
          >
            <Text className="text-white font-black text-xs">{number || "?"}</Text>
          </View>
        )}
        {photoUrl && !imgError && number ? (
          <View
            className="absolute -bottom-1 -right-1 px-1 rounded-full border border-black min-w-[15px] items-center justify-center"
            style={{ backgroundColor: isHome ? "#02DB54" : "#3B82F6" }}
          >
            <Text className="text-black font-black text-[8px]">{number}</Text>
          </View>
        ) : null}
        {rating ? (
          <View className="absolute -top-1 -left-3">
            <RatingBadge rating={rating.rating} isTop={isTopRated} />
          </View>
        ) : null}
        {rating?.captain ? (
          <View className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white border border-black items-center justify-center">
            <Text className="text-black font-black text-[7px]">C</Text>
          </View>
        ) : null}
        {eventStats ? (
          <View className="absolute -bottom-1 -left-3">
            <PlayerEventBadges stats={eventStats} />
          </View>
        ) : null}
      </View>
      <Text
        className="text-white font-extrabold text-[9px] mt-1 text-center"
        numberOfLines={1}
        style={{ maxWidth: 60 }}
      >
        {shortName}
      </Text>
    </View>
  );
};

// Helper to render substitute bench player row with image (and rating if the sub came on)
const SubPlayerRow = ({
  player,
  isHome,
  rating,
  isTopRated,
  eventStats,
}: {
  player: any;
  isHome: boolean;
  rating?: PlayerRating;
  isTopRated?: boolean;
  eventStats?: PlayerEventStats;
}) => {
  const [imgError, setImgError] = useState(false);
  const playerId = getPlayerId(player);
  const photoUrl = player.photo || (playerId ? `https://media.api-sports.io/football/players/${playerId}.png` : null);
  const number = player.shirtNumber || player.number || player.player?.number || "-";
  const name = player.name || player.player?.name || "";
  const borderColor = isHome ? "#02DB54" : "#60A5FA";

  const avatar = (
    <View className="relative">
      {photoUrl && !imgError ? (
        <ExpoImage
          source={{ uri: photoUrl }}
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1,
            borderColor,
            backgroundColor: "#1E293B",
          }}
          onError={() => setImgError(true)}
          contentFit="cover"
        />
      ) : (
        <View className="w-5 h-5 rounded-full bg-white/10 items-center justify-center">
          <Text className="text-white font-bold text-[9px]">{number}</Text>
        </View>
      )}
    </View>
  );
  const badge = rating ? <RatingBadge rating={rating.rating} isTop={isTopRated} /> : null;

  return (
    <View className={`flex-row items-center gap-2 my-1 ${isHome ? "justify-start" : "justify-end"}`}>
      {isHome && avatar}
      {!isHome && badge}
      {!isHome && <PlayerEventBadges stats={eventStats} />}
      <Text className={`text-gray-300 text-xs font-semibold flex-1 ${isHome ? "text-left" : "text-right"}`} numberOfLines={1}>
        {name}
      </Text>
      {isHome && <PlayerEventBadges stats={eventStats} />}
      {isHome && badge}
      {!isHome && avatar}
    </View>
  );
};

// Timeline event icon: ball for goals, swap for subs, yellow/red card for bookings, VAR badge
const EventIcon = ({ item }: { item: any }) => {
  const detail = String(item.detail || "").toLowerCase();
  return (
    <View className="min-w-6 h-6 items-center justify-center">
      {item.type === "goal" ? (
        <Text className="text-base">{detail.includes("missed") ? "❌" : "⚽"}</Text>
      ) : item.type === "subst" ? (
        <View className="w-5 h-5 bg-green-500/20 rounded-full items-center justify-center">
          <Text className="text-[10px]">🔄</Text>
        </View>
      ) : item.type === "var" ? (
        <View className="px-1 py-0.5 bg-white/10 rounded">
          <Text className="text-white font-black text-[7px]" numberOfLines={1}>VAR</Text>
        </View>
      ) : detail.includes("red") || detail.includes("second yellow") ? (
        <View className="w-3.5 h-4 bg-red-500 rounded-sm" />
      ) : (
        <View className="w-3.5 h-4 bg-yellow-400 rounded-sm" />
      )}
    </View>
  );
};

interface PlayerEventStats {
  goals: number;
  ownGoals: number;
  assists: number;
}

const isScoredGoal = (event: any) =>
  event.type === "goal" && !String(event.detail || "").toLowerCase().includes("missed");

const isOwnGoal = (event: any) => String(event.detail || "").toLowerCase().includes("own");

// Events are credited to the team the goal counts for (own goals included)
const isHomeEvent = (event: any, homeTeamId: any) =>
  event.isHome ?? (event.teamId ? String(event.teamId) === String(homeTeamId) : true);

// "Saka 23', 71' (P)" for each of a team's scorers, in the order they first scored
const getScorerLines = (events: any[], homeTeamId: any, forHome: boolean) => {
  const minutesByPlayer = new Map<string, string[]>();
  events
    .filter((e) => isScoredGoal(e) && isHomeEvent(e, homeTeamId) === forHome)
    .forEach((e) => {
      const detail = String(e.detail || "").toLowerCase();
      const suffix = isOwnGoal(e) ? " (OG)" : detail.includes("penalty") ? " (P)" : "";
      const name = e.player || "Unknown";
      minutesByPlayer.set(name, [...(minutesByPlayer.get(name) || []), `${e.minute}${suffix}`]);
    });
  return Array.from(minutesByPlayer, ([name, minutes]) => `${name} ${minutes.join(", ")}`);
};

const nameTokens = (name?: string) =>
  (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter(Boolean);

// Events name players in full ("Jurriën Timber") while lineups often use initials ("J. Timber"),
// so without a player id fall back to surname, then first initial when a surname is shared
const findLineupPlayer = (players: any[], id: any, name?: string) => {
  if (id) {
    const byId = players.find((p) => String(getPlayerId(p)) === String(id));
    if (byId) return byId;
  }
  const target = nameTokens(name);
  if (target.length === 0) return undefined;
  const surname = target[target.length - 1];
  const sameSurname = players.filter((p) => nameTokens(p.name || p.player?.name).at(-1) === surname);
  if (sameSurname.length <= 1) return sameSurname[0];
  return sameSurname.find((p) => nameTokens(p.name || p.player?.name)[0]?.[0] === target[0][0]);
};

// Goals, own goals and assists per lineup player (keyed by the lineup player object)
const getPlayerEventStats = (events: any[], homeTeamId: any, homePlayers: any[], awayPlayers: any[]) => {
  const stats = new Map<any, PlayerEventStats>();
  const add = (player: any, key: keyof PlayerEventStats) => {
    if (!player) return;
    const current = stats.get(player) || { goals: 0, ownGoals: 0, assists: 0 };
    stats.set(player, { ...current, [key]: current[key] + 1 });
  };

  events.filter(isScoredGoal).forEach((e) => {
    const forHome = isHomeEvent(e, homeTeamId);
    const teamPlayers = forHome ? homePlayers : awayPlayers;
    const opponentPlayers = forHome ? awayPlayers : homePlayers;
    if (isOwnGoal(e)) {
      add(
        findLineupPlayer(opponentPlayers, e.playerId, e.player) ||
          findLineupPlayer(teamPlayers, e.playerId, e.player),
        "ownGoals",
      );
      return;
    }
    add(findLineupPlayer(teamPlayers, e.playerId, e.player), "goals");
    if (e.assist || e.assistId) add(findLineupPlayer(teamPlayers, e.assistId, e.assist), "assists");
  });
  return stats;
};

const EventCountBadge = ({ icon, count, own }: { icon: string; count: number; own?: boolean }) => (
  <View
    className="flex-row items-center rounded-full px-0.5 border border-black"
    style={{ backgroundColor: own ? "#DC2626" : "rgba(0,0,0,0.85)" }}
  >
    <Text className="text-[8px]">{icon}</Text>
    {own ? <Text className="text-white font-black text-[7px] ml-0.5">OG</Text> : null}
    {count > 1 ? <Text className="text-white font-black text-[7px] ml-0.5">{count}</Text> : null}
  </View>
);

// Goal / own goal / assist markers shown on a lineup player
const PlayerEventBadges = ({ stats }: { stats?: PlayerEventStats }) => {
  if (!stats) return null;
  return (
    <View className="flex-row items-center gap-0.5">
      {stats.goals > 0 ? <EventCountBadge icon="⚽" count={stats.goals} /> : null}
      {stats.ownGoals > 0 ? <EventCountBadge icon="⚽" count={stats.ownGoals} own /> : null}
      {stats.assists > 0 ? <EventCountBadge icon="👟" count={stats.assists} /> : null}
    </View>
  );
};

// Helper to group starters by formation (3-4-2-1, 4-2-3-1, 4-3-3, 4-4-2, 5-3-2, etc.)
const getFormationRows = (starters: any[], formationStr: string) => {
  if (!starters || starters.length === 0) return [];

  // 1. Try grouping by `row` or `grid` if present from API
  const hasGridRows = starters.some((p) => p.row || (p.grid && String(p.grid).includes(":")));
  if (hasGridRows) {
    const rowMap: { [key: number]: any[] } = {};
    starters.forEach((p) => {
      let r = p.row;
      if (!r && p.grid) {
        const parts = String(p.grid).split(":");
        r = parseInt(parts[0], 10) || 1;
      }
      if (!r) r = 1;
      if (!rowMap[r]) rowMap[r] = [];
      rowMap[r].push(p);
    });
    const sortedKeys = Object.keys(rowMap).map(Number).sort((a, b) => a - b);
    return sortedKeys.map((k) => rowMap[k]);
  }

  // 2. Try parsing formation string (e.g., "3-4-2-1", "4-2-3-1", "4-3-3", "4-4-2", "3-5-2")
  if (formationStr && typeof formationStr === "string" && formationStr.includes("-")) {
    const parts = formationStr.split("-").map((n) => parseInt(n.trim(), 10) || 0).filter((n) => n > 0);
    const counts = [1, ...parts]; // Row 0 is GK (1)
    const sum = counts.reduce((a, b) => a + b, 0);

    if (sum === starters.length) {
      const rows: any[][] = [];
      let idx = 0;
      for (const c of counts) {
        rows.push(starters.slice(idx, idx + c));
        idx += c;
      }
      return rows;
    }
  }

  // 3. Fallback: split starters into 4 default rows (GK + 3 outfield rows)
  const gk = starters.slice(0, 1);
  const rest = starters.slice(1);
  if (rest.length === 10) {
    return [gk, rest.slice(0, 4), rest.slice(4, 7), rest.slice(7, 10)];
  }

  return [gk, rest];
};

export default function MatchDetailsModal({
  visible,
  match,
  tabRequest,
  onClose,
}: MatchDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<MatchDetailsTab>("infor");
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [homeLineup, setHomeLineup] = useState<any>(null);
  const [awayLineup, setAwayLineup] = useState<any>(null);
  const [loadingLineup, setLoadingLineup] = useState<boolean>(false);
  const [standings, setStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState<boolean>(false);
  const [stats, setStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [h2hData, setH2hData] = useState<any>(null);
  const [loadingH2h, setLoadingH2h] = useState<boolean>(false);
  const [ratings, setRatings] = useState<Record<string, PlayerRating>>({});
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [playerLeaders, setPlayerLeaders] = useState<PlayerLeaders | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState<boolean>(false);
  const [leaderCategory, setLeaderCategory] = useState<LeaderCategory>("topScorers");

  // Responses that arrive after the user has switched to another match are dropped
  const activeMatchIdRef = useRef<string | undefined>(match?.id);
  activeMatchIdRef.current = match?.id;
  const isCurrent = (matchId: string) => activeMatchIdRef.current === matchId;

  const { statusUpper: matchStatusUpper, minuteUpper: matchMinuteUpper, isFinished, isUpcoming } =
    getMatchPhase(match);
  const isLive = !!match && !isFinished && !isUpcoming;

  // 1. Fetch Timeline Events, Stats, Lineups, Standings, H2H, Venue/Round, Ratings
  // Load Events
  const loadEvents = useCallback(async (force = false) => {
    if (!match?.id) return;
    const matchId = match.id;
    if (!force) setLoadingEvents(true);
    try {
      const data = await fetchFixtureEvents(matchId, force, isLive);
      if (isCurrent(matchId)) setEvents(data || []);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      if (isCurrent(matchId)) setLoadingEvents(false);
    }
  }, [match?.id, isLive]);

  // Load Stats
  const loadStats = useCallback(async (force = false) => {
    if (!match?.id) return;
    const matchId = match.id;
    if (!force) setLoadingStats(true);
    try {
      const statsData = await fetchFixtureStatistics(matchId, force, isLive);
      if (isCurrent(matchId)) setStats(statsData || []);
    } catch (err) {
      console.error("Failed to load statistics:", err);
    } finally {
      if (isCurrent(matchId)) setLoadingStats(false);
    }
  }, [match?.id, isLive]);

  // Load Lineups (supports force reload)
  const loadLineups = useCallback(async (force = false) => {
    if (!match?.id) return;
    const matchId = match.id;
    setLoadingLineup(true);
    try {
      const [homeData, awayData] = await Promise.all([
        fetchHomeTeamLineup(matchId, force),
        fetchAwayTeamLineup(matchId, force),
      ]);
      if (isCurrent(matchId)) {
        setHomeLineup(homeData);
        setAwayLineup(awayData);
      }
    } catch (err) {
      console.error("Failed to load lineups:", err);
    } finally {
      if (isCurrent(matchId)) setLoadingLineup(false);
    }
  }, [match?.id]);

  // Load Player Ratings (final ratings are cached longer on the backend)
  const loadRatings = useCallback(async () => {
    if (!match?.id) return;
    const matchId = match.id;
    try {
      const data = await fetchPlayerRatings(matchId, isFinished);
      if (isCurrent(matchId)) setRatings(data);
    } catch (err) {
      console.error("Failed to load player ratings:", err);
    }
  }, [match?.id, isFinished]);

  // Load Venue & Round
  const loadMatchInfo = useCallback(async () => {
    if (!match?.id) return;
    const matchId = match.id;
    try {
      const data: any = await fetchMatchLocation(matchId);
      if (isCurrent(matchId)) {
        setMatchInfo({
          venue: data?.venue || "",
          city: data?.city || "",
          round: data?.round || "",
        });
      }
    } catch (err) {
      console.error("Failed to load match location:", err);
    }
  }, [match?.id]);

  // Load Standings
  const loadStandings = useCallback(async () => {
    if (!match?.id || !match?.leagueId) return;
    const matchId = match.id;
    setLoadingStandings(true);
    try {
      const rawData = await fetchLeagueStandings(match.leagueId);
      if (!isCurrent(matchId)) return;
      if (rawData && rawData.length > 0) {
        const mapped = rawData.map((item: any, idx: number) => {
          const teamObj = item.team || item;
          const pos =
            item.pos || item.position || item.rank || item.idx || idx + 1;
          const name = teamObj.name || teamObj.teamName || "Team";
          const logo =
            teamObj.logo ||
            teamObj.teamLogo ||
            teamObj.logoUrl ||
            `https://images.fotmob.com/image_resources/logo/teamlogo/${item.teamId || item.id}.png`;
          const pl =
            item.pl ?? item.played ?? item.playedCount ?? item.all?.played ?? 0;
          const w = item.win ?? item.won ?? item.all?.win ?? null;
          const d = item.draw ?? item.drawn ?? item.all?.draw ?? null;
          const l = item.lose ?? item.lost ?? item.all?.lose ?? null;
          const gd = String(
            item.gd ??
              item.goalDiff ??
              item.goal_diff ??
              item.goalsDiff ??
              item.goalDifference ??
              item.diff ??
              item.all?.goalsDiff ??
              "0"
          );
          const pts = item.pts ?? item.points ?? 0;
          const form = String(item.form || "").slice(-5);
          const zone = item.description || "";

          const isHome =
            (teamObj.id && String(teamObj.id) === String(match.home.id)) ||
            name.toLowerCase().includes(match.home.name.toLowerCase()) ||
            match.home.name.toLowerCase().includes(name.toLowerCase());
          const isAway =
            (teamObj.id && String(teamObj.id) === String(match.away.id)) ||
            name.toLowerCase().includes(match.away.name.toLowerCase()) ||
            match.away.name.toLowerCase().includes(name.toLowerCase());
          const active = !!(isHome || isAway);

          return { pos, name, logo, pl, w, d, l, gd, pts, form, zone, active, group: item.group || "" };
        });
        setStandings(mapped);
      } else {
        setStandings([]);
      }
    } catch (err) {
      console.error("Failed to load standings:", err);
      if (isCurrent(matchId)) setStandings([]);
    } finally {
      if (isCurrent(matchId)) setLoadingStandings(false);
    }
  }, [match?.id, match?.leagueId, match?.home?.id, match?.home?.name, match?.away?.id, match?.away?.name]);

  // Load H2H
  const loadH2H = useCallback(async () => {
    if (!match?.id || !match?.home?.id || !match?.away?.id) return;
    const matchId = match.id;
    setLoadingH2h(true);
    try {
      const data = await fetchFixtureH2H(match.home.id!, match.away.id!);
      if (isCurrent(matchId)) setH2hData(data);
    } catch (err) {
      console.error("Failed to load H2H:", err);
    } finally {
      if (isCurrent(matchId)) setLoadingH2h(false);
    }
  }, [match?.id, match?.home?.id, match?.away?.id]);

  // Load league player leaderboards (top scorers, assists, cards)
  const loadPlayerLeaders = useCallback(async () => {
    if (!match?.id || !match?.leagueId) return;
    const matchId = match.id;
    setLoadingPlayers(true);
    try {
      const data = await fetchPlayerLeaders(match.leagueId);
      if (isCurrent(matchId)) setPlayerLeaders(data);
    } catch (err) {
      console.error("Failed to load player leaders:", err);
    } finally {
      if (isCurrent(matchId)) setLoadingPlayers(false);
    }
  }, [match?.id, match?.leagueId]);

  // Track which tabs have already loaded data for the current match to prevent duplicate calls
  const loadedTabsRef = useRef<Set<string>>(new Set());

  const refreshAll = useCallback(() => {
    loadedTabsRef.current.clear();
    loadMatchInfo();
    if (activeTab === "infor") {
      if (!isUpcoming) loadEvents(true);
    } else if (activeTab === "stats") {
      if (!isUpcoming) loadStats(true);
    } else if (activeTab === "lineup") {
      loadLineups(true);
      if (!isUpcoming) {
        loadEvents(true);
        loadRatings();
      }
    } else if (activeTab === "table") {
      loadStandings();
    } else if (activeTab === "h2h") {
      loadH2H();
    } else if (activeTab === "players") {
      loadPlayerLeaders();
    }
  }, [activeTab, isUpcoming, loadMatchInfo, loadEvents, loadStats, loadLineups, loadRatings, loadStandings, loadH2H, loadPlayerLeaders]);

  // Clear the previous match's data so it never flashes up under a different match
  useEffect(() => {
    setActiveTab("infor");
    loadedTabsRef.current.clear();
    setEvents([]);
    setStats([]);
    setHomeLineup(null);
    setAwayLineup(null);
    setStandings([]);
    setH2hData(null);
    setRatings({});
    setMatchInfo(null);
    setPlayerLeaders(null);
    setLeaderCategory("topScorers");
  }, [match?.id]);

  // Runs after the reset above, so a requested tab wins when it arrives with a new match
  useEffect(() => {
    if (tabRequest) setActiveTab(tabRequest.tab);
  }, [tabRequest]);

  // Tab-based on-demand loading: only fetch data for the tab currently viewed by the user
  useEffect(() => {
    if (!visible || !match?.id) return;

    // Venue / Match info is always loaded on modal open (lightweight)
    if (!loadedTabsRef.current.has("info")) {
      loadedTabsRef.current.add("info");
      loadMatchInfo();
    }

    // Timeline events also feed the scorers under the team names and the lineup goal / assist
    // badges, so they load whichever tab opens first (only live or finished matches have them)
    if (!isUpcoming && !loadedTabsRef.current.has("events")) {
      loadedTabsRef.current.add("events");
      loadEvents(false);
    }

    if (activeTab === "stats") {
      // Statistics only exist for live or finished matches
      if (!isUpcoming && !loadedTabsRef.current.has("stats")) {
        loadedTabsRef.current.add("stats");
        loadStats(false);
      }
    } else if (activeTab === "lineup") {
      if (!loadedTabsRef.current.has("lineup")) {
        loadedTabsRef.current.add("lineup");
        loadLineups(false);
        if (!isUpcoming) {
          loadRatings();
        }
      }
    } else if (activeTab === "table") {
      if (!loadedTabsRef.current.has("table")) {
        loadedTabsRef.current.add("table");
        loadStandings();
      }
    } else if (activeTab === "h2h") {
      if (!loadedTabsRef.current.has("h2h")) {
        loadedTabsRef.current.add("h2h");
        loadH2H();
      }
    } else if (activeTab === "players") {
      if (!loadedTabsRef.current.has("players")) {
        loadedTabsRef.current.add("players");
        loadPlayerLeaders();
      }
    }
  }, [
    visible,
    match?.id,
    activeTab,
    isUpcoming,
    loadMatchInfo,
    loadEvents,
    loadStats,
    loadLineups,
    loadRatings,
    loadStandings,
    loadH2H,
    loadPlayerLeaders,
  ]);

  // Live Timeline Events: Auto-refresh every 1 minute while viewing a live match
  // (on every tab, since the scorers under the team names are always visible)
  useEffect(() => {
    if (!visible || !match?.id || !isLive) return;
    const eventsInterval = setInterval(() => {
      loadEvents(false);
    }, 60000); // 1 minute auto-refresh for live match events/timeline
    return () => clearInterval(eventsInterval);
  }, [visible, match?.id, isLive, loadEvents]);

  // Live Match Statistics: Auto-refresh every 5 minutes while viewing a live match on stats tab
  useEffect(() => {
    if (!visible || !match?.id || !isLive || activeTab !== "stats") return;
    const statsInterval = setInterval(() => {
      loadStats(false);
    }, 300000); // 5 minutes auto-refresh for live match statistics
    return () => clearInterval(statsInterval);
  }, [visible, match?.id, isLive, activeTab, loadStats]);

  // Keep live ratings moving while the user is looking at the lineup
  useEffect(() => {
    if (!visible || !isLive || activeTab !== "lineup") return;
    const interval = setInterval(loadRatings, LIVE_RATINGS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [visible, isLive, activeTab, loadRatings]);

  if (!match) return null;

  const venueName = matchInfo?.venue || match.venue || "";
  const venueCity = matchInfo?.city || match.venueCity || "";
  const venueLabel = [venueName, venueCity].filter(Boolean).join(", ") || "Venue TBA";
  const roundLabel = formatRound(matchInfo?.round || match.round);

  const timelineEvents = events;

  // Helper to extract lineup data flexibly — handles both flat and nested response structures
  const getLineupObj = (data: any, fallbackName: string) => {
    if (!data) return { starters: [], subs: [], formation: "", teamName: fallbackName };

    // Backend returns: { teamName, formation, starters, startXI, subs, substitutes, lineup: {...} }
    // Try flat root-level fields first (backend format), then nested 'lineup' object
    const starters =
      (data.starters?.length > 0 && data.starters) ||
      (data.startXI?.length > 0 && data.startXI) ||
      (data.lineup?.starters?.length > 0 && data.lineup.starters) ||
      (data.lineup?.startXI?.length > 0 && data.lineup.startXI) ||
      data.startingXI ||
      data.startersList ||
      [];

    const subs =
      (data.subs?.length > 0 && data.subs) ||
      (data.substitutes?.length > 0 && data.substitutes) ||
      (data.lineup?.subs?.length > 0 && data.lineup.subs) ||
      (data.lineup?.substitutes?.length > 0 && data.lineup.substitutes) ||
      [];

    const formation =
      data.formation || data.lineup?.formation || "";

    const teamName =
      data.teamName || data.name || data.lineup?.teamName || data.lineup?.name || fallbackName;

    return { starters, subs, formation, teamName };
  };

  const homeLineupData = getLineupObj(homeLineup, match.home.name);
  const awayLineupData = getLineupObj(awayLineup, match.away.name);
  const homeStarters = homeLineupData.starters;
  const awayStarters = awayLineupData.starters;

  const homeScorers = getScorerLines(timelineEvents, match.home?.id, true);
  const awayScorers = getScorerLines(timelineEvents, match.home?.id, false);
  const playerEventStats = getPlayerEventStats(
    timelineEvents,
    match.home?.id,
    [...homeStarters, ...homeLineupData.subs],
    [...awayStarters, ...awayLineupData.subs],
  );

  const getRating = (player: any): PlayerRating | undefined => {
    const id = getPlayerId(player);
    return id ? ratings[String(id)] : undefined;
  };
  // Highest-rated player of the match gets a star on their badge
  const topRatedId = (Object.entries(ratings) as [string, PlayerRating][]).reduce<{ id: string; rating: number } | null>(
    (best, [id, r]) => (!best || r.rating > best.rating ? { id, rating: r.rating } : best),
    null,
  )?.id;
  const isTopRated = (player: any) => !!topRatedId && String(getPlayerId(player)) === topRatedId;

  // Use actual API stats only — no demo fallback
  const effectiveStats = stats;

  const hasPlayerLeaders =
    !!playerLeaders && LEADER_CATEGORIES.some((c) => playerLeaders[c.id].length > 0);
  const activeLeaderCategory = LEADER_CATEGORIES.find((c) => c.id === leaderCategory)!;
  const leaderRows: PlayerLeader[] = playerLeaders?.[leaderCategory] || [];
  // Players from the two teams in this match are highlighted in the leaderboards
  const getLeaderSide = (player: PlayerLeader) => {
    if (player.teamId == null) return null;
    if (String(player.teamId) === String(match.home?.id)) return "home";
    if (String(player.teamId) === String(match.away?.id)) return "away";
    return null;
  };

  const hasWdl = standings.some((r) => r.w !== null || r.d !== null || r.l !== null);
  const standingsZones = Array.from(new Set(standings.map((r) => r.zone).filter(Boolean))) as string[];

  const hasDistinctGroups = new Set(standings.map((r) => r.group).filter(Boolean)).size > 1;
  const groupedStandings: { title: string; rows: any[] }[] = [];
  if (!hasDistinctGroups) {
    groupedStandings.push({ title: "", rows: standings });
  } else {
    const groupMap: Record<string, any[]> = {};
    standings.forEach((row) => {
      const g = row.group || "Other";
      if (!groupMap[g]) groupMap[g] = [];
      groupMap[g].push(row);
    });
    Object.entries(groupMap).forEach(([title, rows]) => {
      groupedStandings.push({ title, rows });
    });
  }

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0C0E" }}>
        {/* Header Block */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#ffffff08] bg-[#0B0C0E]">
          <TouchableOpacity onPress={onClose} className="p-1">
            <ArrowLeft size={22} color="#ECEDEE" />
          </TouchableOpacity>

          <Text className="text-lg font-black text-white tracking-widest uppercase">
            LIVE SCORE
          </Text>

          <TouchableOpacity onPress={refreshAll} className="p-1">
            <RotateCw size={18} color="#ECEDEE" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 mt-3" showsVerticalScrollIndicator={false}>
          {/* Main Scorecard Panel */}
          <View className="bg-[#131517] rounded-3xl p-5 border border-[#ffffff08] mb-5 relative overflow-hidden">
            {/* Background Wavy Lines SVG */}
            <View className="absolute inset-0 opacity-15 justify-center items-center">
              <Svg height="100%" width="100%" viewBox="0 0 100 100">
                <Path d="M0,40 Q25,10 50,40 T100,40" fill="none" stroke="#02DB54" strokeWidth="0.8" />
                <Path d="M0,55 Q25,25 50,55 T100,55" fill="none" stroke="#FFFFFF" strokeWidth="0.8" />
                <Path d="M0,70 Q25,40 50,70 T100,70" fill="none" stroke="#02DB54" strokeWidth="0.8" />
              </Svg>
            </View>

            {/* League Details */}
            <Text className="text-gray-300 text-xs font-bold text-center mb-1">
              {match.home?.name || "Home"} vs {match.away?.name || "Away"}
            </Text>
            <Text className="text-[#86EFAC] text-[11px] font-extrabold text-center mb-4">
              {match.league || "Competition"}
            </Text>

            {/* Score layout (top-aligned so the crests line up when one side lists more scorers) */}
            <View className="flex-row justify-between items-start my-1 px-1">
              {/* Home Team */}
              <View className="items-center flex-1">
                <View className="w-16 h-16 bg-[#181A1C] border border-white/10 items-center justify-center rounded-2xl mb-2">
                  <ExpoImage
                    source={match.home?.logo ? { uri: match.home.logo } : undefined}
                    style={{ width: 44, height: 44 }}
                    contentFit="contain"
                  />
                </View>
                <Text className="text-white font-extrabold text-xs text-center" numberOfLines={1}>
                  {match.home?.name || "Home"}
                </Text>
                {homeScorers.map((line) => (
                  <Text key={line} className="text-gray-400 text-[10px] font-bold mt-0.5 text-center" numberOfLines={1}>
                    {line}
                  </Text>
                ))}
              </View>

              {/* Score & Minute */}
              <View className="items-center mx-4 mt-2">
                <Text className="text-white text-3xl font-black tracking-tight">
                  {match.score || "VS"}
                </Text>
                <View className="bg-black/50 px-3 py-1 rounded-full mt-2">
                  {isFinished ? (
                    <Text className="text-[#02DB54] text-[11px] font-black uppercase tracking-wider">
                      {matchStatusUpper === "AET" || matchMinuteUpper === "AET"
                        ? "AET"
                        : matchStatusUpper === "PEN" || matchMinuteUpper === "PEN"
                        ? "PEN"
                        : "FT"}
                    </Text>
                  ) : (
                    <LiveMatchClock
                      minute={match.minute}
                      status={match.status}
                      extra={match.extra}
                      timestamp={match.timestamp}
                      textClass="text-[#02DB54] text-[11px] font-black uppercase"
                    />
                  )}
                </View>
              </View>

              {/* Away Team */}
              <View className="items-center flex-1">
                <View className="w-16 h-16 bg-[#181A1C] border border-white/10 items-center justify-center rounded-2xl mb-2">
                  <ExpoImage
                    source={match.away?.logo ? { uri: match.away.logo } : undefined}
                    style={{ width: 44, height: 44 }}
                    contentFit="contain"
                  />
                </View>
                <Text className="text-white font-extrabold text-xs text-center" numberOfLines={1}>
                  {match.away?.name || "Away"}
                </Text>
                {awayScorers.map((line) => (
                  <Text key={line} className="text-gray-400 text-[10px] font-bold mt-0.5 text-center" numberOfLines={1}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>

            {/* Stadium Info */}
            <View className="flex-row items-center justify-between mt-5 pt-3 border-t border-white/5 px-2">
              <View className="flex-row items-center gap-1.5 flex-1">
                <MapPin size={13} color="#02DB54" />
                <Text
                  className="text-[#02DB54] text-[11px] font-black uppercase tracking-wider"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {venueLabel}
                </Text>
              </View>
              {roundLabel ? (
                <Text
                  className="text-white text-[11px] font-extrabold ml-3"
                  numberOfLines={1}
                  style={{ flexShrink: 0, maxWidth: "45%" }}
                >
                  {roundLabel}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Interactive Navigation Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row mb-5"
            contentContainerStyle={{ gap: 8 }}
          >
            {[
              { id: "infor", label: "Infor" },
              { id: "stats", label: "Stats" },
              { id: "lineup", label: "Lineup" },
              { id: "table", label: "Table" },
              { id: "h2h", label: "H2H" },
              { id: "players", label: "Player Stats" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  className={`px-5 py-2 rounded-full border ${
                    isActive
                      ? "border-[#02DB54] bg-[#02DB54]/10"
                      : "border-white/10 bg-[#131517]"
                  }`}
                >
                  <Text
                    className={`font-black text-xs ${
                      isActive ? "text-[#02DB54]" : "text-gray-400"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* TAB 1: INFOR (Match Timeline) */}
          {activeTab === "infor" && (
            <View className="mb-6">
              {/* Community prediction poll */}
              <MatchPrediction
                key={match.id}
                matchId={match.id}
                home={match.home}
                away={match.away}
                score={match.score}
                isUpcoming={isUpcoming}
                isFinished={isFinished}
                kickoff={getMatchKickoffMs(match)}
              />

              {/* Section Header */}
              <View className="flex-row items-center justify-center mb-6">
                <View className="flex-1 h-[1px] bg-white/10" />
                <Text className="text-white font-extrabold text-sm mx-4">
                  Match timeline
                </Text>
                <View className="flex-1 h-[1px] bg-white/10" />
              </View>

              {loadingEvents ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : isUpcoming ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">Match Has Not Started</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Timeline data will appear once the match begins.</Text>
                </View>
              ) : timelineEvents.length === 0 ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">No Timeline Available</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Data is not available for this match.</Text>
                </View>
              ) : (
                <View className="space-y-4">
                  {timelineEvents.map((item, index) => {
                    const isHome = isHomeEvent(item, match.home?.id);

                    return (
                      <View
                        key={item.id || index}
                        className="flex-row items-center justify-between my-2"
                      >
                        {/* Home Side Event */}
                        <View className="flex-1 flex-row items-center justify-end pr-3">
                          {isHome && (
                            <View className="items-end">
                              <Text className="text-white font-bold text-xs">
                                {item.player}
                              </Text>
                              {item.assist && (
                                <Text className="text-gray-400 text-[10px]">
                                  {item.assist}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>

                        {/* Icon & Minute Pill */}
                        <View className="flex-row items-center gap-2">
                          {isHome && <EventIcon item={item} />}

                          <View className="bg-white px-3 py-1 rounded-full border border-gray-200 min-w-[42px] items-center">
                            <Text className="text-black font-black text-[11px]">
                              {item.minute}
                            </Text>
                          </View>

                          {!isHome && <EventIcon item={item} />}
                        </View>

                        {/* Away Side Event */}
                        <View className="flex-1 flex-row items-center justify-start pl-3">
                          {!isHome && (
                            <View className="items-start">
                              <Text className="text-white font-bold text-xs">
                                {item.player}
                              </Text>
                              {item.assist && (
                                <Text className="text-gray-400 text-[10px]">
                                  {item.assist}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: STATS */}
          {activeTab === "stats" && (
            <View className="mb-6">
              {loadingStats ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : isUpcoming ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">Match Has Not Started</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Statistics will appear once the match begins.</Text>
                </View>
              ) : effectiveStats.length === 0 ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">No Statistics Available</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Data is not available for this match.</Text>
                </View>
              ) : (
                <View className="space-y-3">
                  {effectiveStats.map((stat, idx) => {
                    const homeNum = parseFloat(String(stat.home).replace("%", "")) || 0;
                    const awayNum = parseFloat(String(stat.away).replace("%", "")) || 0;
                    const homeWin = homeNum >= awayNum;
                    const awayWin = awayNum >= homeNum;

                    return (
                      <View
                        key={idx}
                        className="flex-row items-center justify-between my-1.5"
                      >
                        {/* Home Value Pill */}
                        <View className="w-16 items-start">
                          <View
                            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${
                              homeWin ? "bg-[#02DB54]/20 border border-[#02DB54]/50" : "bg-[#181A1C]"
                            }`}
                          >
                            <Text className="text-white font-bold text-xs">
                              {stat.home}
                            </Text>
                            {homeWin && <View className="w-2 h-2 rounded-full bg-[#02DB54]" />}
                          </View>
                        </View>

                        {/* Stat Name */}
                        <Text className="text-gray-300 font-extrabold text-xs text-center flex-1 mx-2">
                          {stat.name}
                        </Text>

                        {/* Away Value Pill */}
                        <View className="w-16 items-end">
                          <View
                            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${
                              awayWin ? "bg-[#02DB54]/20 border border-[#02DB54]/50" : "bg-[#181A1C]"
                            }`}
                          >
                            {awayWin && <View className="w-2 h-2 rounded-full bg-[#02DB54]" />}
                            <Text className="text-white font-bold text-xs">
                              {stat.away}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: LINEUP */}
          {activeTab === "lineup" && (
            <View className="mb-6">
              {loadingLineup ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : (homeStarters.length === 0 && awayStarters.length === 0) ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">
                    {isUpcoming ? "Lineup Not Announced Yet" : "Lineups Not Available"}
                  </Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">
                    {isUpcoming
                      ? "Team lineups are usually announced 20–60 minutes before kickoff."
                      : "Lineup data is currently unavailable for this match."
                    }
                  </Text>
                  <TouchableOpacity
                    onPress={() => loadLineups(true)}
                    className="mt-4 px-4 py-2 bg-[#02DB54]/10 border border-[#02DB54]/40 rounded-full flex-row items-center gap-1.5"
                  >
                    <RotateCw size={13} color="#02DB54" />
                    <Text className="text-[#02DB54] text-xs font-bold">Check Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  {/* Soccer Pitch Container */}
                  <View className="bg-[#0F2314] rounded-2xl p-3 border border-[#02DB54]/30 relative overflow-hidden min-h-[540px] flex-col justify-between">
                    {/* Soccer Pitch Markings Overlay */}
                    <Svg height="100%" width="100%" style={{ position: "absolute" }}>
                      <Rect x="4%" y="2%" width="92%" height="96%" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.2} />
                      {/* Penalty box top */}
                      <Rect x="25%" y="2%" width="50%" height="15%" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity={0.2} />
                      {/* Penalty box bottom */}
                      <Rect x="25%" y="83%" width="50%" height="15%" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity={0.2} />
                      {/* Center line */}
                      <SvgLine x1="4%" y1="50%" x2="96%" y2="50%" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.25} />
                      {/* Center circle */}
                      <Circle cx="50%" cy="50%" r="42" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.25} />
                    </Svg>

                    {/* Home Team (Top Half Pitch) */}
                    <View className="flex-1 justify-around py-2">
                      <Text className="text-[#86EFAC] text-[11px] font-black uppercase text-center mb-2">
                        {homeLineupData.teamName} ({homeLineupData.formation})
                      </Text>

                      {getFormationRows(homeStarters, homeLineupData.formation).map((row: any[], rIdx: number) => (
                        <View key={`h-row-${rIdx}`} className="flex-row justify-around items-center px-1 my-1">
                          {row.map((p: any, pIdx: number) => (
                            <PlayerCard key={`h-p-${p.id || pIdx}`} player={p} isHome={true} rating={getRating(p)} isTopRated={isTopRated(p)} eventStats={playerEventStats.get(p)} />
                          ))}
                        </View>
                      ))}
                    </View>

                    {/* Center Pitch Divider Line with Icon */}
                    <View className="flex-row items-center justify-center my-2">
                      <View className="flex-1 h-[1px] bg-white/20" />
                      <View className="w-5 h-5 rounded-full bg-[#02DB54]/20 border border-[#02DB54]/50 items-center justify-center mx-2">
                        <Text className="text-[9px]">⚽</Text>
                      </View>
                      <View className="flex-1 h-[1px] bg-white/20" />
                    </View>

                    {/* Away Team (Bottom Half Pitch - Flipped so Attack faces Center) */}
                    <View className="flex-1 justify-around py-2">
                      {getFormationRows(awayStarters, awayLineupData.formation).slice().reverse().map((row: any[], rIdx: number) => (
                        <View key={`a-row-${rIdx}`} className="flex-row justify-around items-center px-1 my-1">
                          {row.map((p: any, pIdx: number) => (
                            <PlayerCard key={`a-p-${p.id || pIdx}`} player={p} isHome={false} rating={getRating(p)} isTopRated={isTopRated(p)} eventStats={playerEventStats.get(p)} />
                          ))}
                        </View>
                      ))}

                      <Text className="text-[#93C5FD] text-[11px] font-black uppercase text-center mt-2">
                        {awayLineupData.teamName} ({awayLineupData.formation})
                      </Text>
                    </View>
                  </View>

                  {/* Substitutes Bench */}
                  {(homeLineupData.subs.length > 0 || awayLineupData.subs.length > 0) && (
                    <View className="bg-[#131517] rounded-2xl p-4 mt-4 border border-white/5">
                      <Text className="text-[#02DB54] font-black text-xs uppercase tracking-wider mb-3 text-center">
                        Substitutes Bench
                      </Text>
                      <View className="flex-row justify-between">
                        {/* Home Subs */}
                        <View className="flex-1 pr-2 border-r border-white/5">
                          <Text className="text-[#86EFAC] font-extrabold text-[11px] mb-2" numberOfLines={1}>
                            {homeLineupData.teamName}
                          </Text>
                          {homeLineupData.subs.map((s: any, idx: number) => (
                            <SubPlayerRow key={getPlayerId(s) || idx} player={s} isHome={true} rating={getRating(s)} isTopRated={isTopRated(s)} eventStats={playerEventStats.get(s)} />
                          ))}
                        </View>

                        {/* Away Subs */}
                        <View className="flex-1 pl-2">
                          <Text className="text-[#93C5FD] font-extrabold text-[11px] mb-2 text-right" numberOfLines={1}>
                            {awayLineupData.teamName}
                          </Text>
                          {awayLineupData.subs.map((s: any, idx: number) => (
                            <SubPlayerRow key={getPlayerId(s) || idx} player={s} isHome={false} rating={getRating(s)} isTopRated={isTopRated(s)} eventStats={playerEventStats.get(s)} />
                          ))}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: TABLE (Standings) */}
          {activeTab === "table" && (
            <View className="mb-6">
              {loadingStandings ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : standings.length === 0 ? (
                <View className="py-12 px-4 items-center bg-[#131415] rounded-3xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">No Table Available</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">
                    Standings aren't available for this competition.
                  </Text>
                </View>
              ) : (
                <View className="gap-4">
                  {groupedStandings.map((group, gIdx) => (
                    <View key={group.title || `group-${gIdx}`} className="bg-[#131517] rounded-3xl p-3 border border-white/5">
                      {group.title ? (
                        <View className="flex-row items-center gap-2 pb-2 mb-1.5 border-b border-white/10">
                          <View className="w-2 h-2 rounded-full bg-[#02DB54]" />
                          <Text className="text-[#02DB54] font-black text-xs uppercase tracking-wider">
                            {group.title}
                          </Text>
                        </View>
                      ) : null}

                      {/* Table Header */}
                      <View className="flex-row border-b border-white/10 pb-2 mb-1 items-center">
                        <Text className="text-[#9BA1A6] font-bold text-[11px] text-center w-7">#</Text>
                        <Text className="text-[#9BA1A6] font-bold text-[11px] flex-1 ml-1">Team</Text>
                        {(hasWdl ? ["P", "W", "D", "L", "GD"] : ["P", "GD"]).map((h) => (
                          <Text key={h} className="text-[#9BA1A6] font-bold text-[11px] text-center w-7">
                            {h}
                          </Text>
                        ))}
                        <Text className="text-[#9BA1A6] font-bold text-[11px] text-center w-9">PTS</Text>
                      </View>

                      {/* Table Rows */}
                      {group.rows.map((row: any, idx: number) => {
                        const color = zoneColor(row.zone);
                        return (
                          <View
                            key={`${row.pos}-${row.name}-${idx}`}
                            className={`py-2 border-b border-white/5 ${
                              row.active ? "bg-[#02DB54]/10 rounded-xl px-1" : ""
                            }`}
                          >
                            <View className="flex-row items-center">
                              <View className="w-7 items-center">
                                <Text
                                  className="font-black text-xs"
                                  style={{ color: color || "#FFFFFF" }}
                                >
                                  {row.pos}
                                </Text>
                              </View>
                              <View className="flex-row items-center gap-2 flex-1 ml-1">
                                {row.logo ? (
                                  <ExpoImage source={{ uri: row.logo }} style={{ width: 20, height: 20 }} contentFit="contain" />
                                ) : null}
                                <Text
                                  className={`text-xs font-extrabold flex-1 ${
                                    row.active ? "text-[#02DB54]" : "text-white"
                                  }`}
                                  numberOfLines={1}
                                >
                                  {row.name}
                                </Text>
                              </View>
                              {(hasWdl ? [row.pl, row.w, row.d, row.l, row.gd] : [row.pl, row.gd]).map((v: any, i: number) => (
                                <Text key={i} className="text-gray-300 text-xs font-bold text-center w-7">
                                  {v ?? "-"}
                                </Text>
                              ))}
                              <Text className="text-white text-xs font-black text-center w-9">{row.pts}</Text>
                            </View>
                            {row.form ? (
                              <View className="flex-row gap-1 mt-1.5 ml-[34px]">
                                {row.form.split("").map((r: string, i: number) => (
                                  <View
                                    key={i}
                                    className="w-4 h-4 rounded items-center justify-center"
                                    style={{ backgroundColor: FORM_COLORS[r] || "#374151" }}
                                  >
                                    <Text className="text-black text-[8px] font-black">{r}</Text>
                                  </View>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ))}

                  {/* Zones Legend */}
                  {standingsZones.length > 0 ? (
                    <View className="bg-[#131517] rounded-3xl p-3 border border-white/5 gap-1.5 px-3">
                      {standingsZones.map((zone: string) => (
                        <View key={zone} className="flex-row items-center gap-2">
                          <View
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: zoneColor(zone) || "#9CA3AF" }}
                          />
                          <Text className="text-gray-400 text-[10px] font-bold flex-1">{zone}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* TAB 5: H2H */}
          {activeTab === "h2h" && (
            <View className="mb-6">
              {loadingH2h ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : !h2hData || !h2hData.totalMatches ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">No Previous Meetings</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">These teams have no head-to-head record yet.</Text>
                </View>
              ) : (
                <>
                  {/* Overall record */}
                  <View className="bg-[#131517] rounded-2xl p-4 border border-white/10 my-2">
                    <Text className="text-gray-400 font-extrabold text-[11px] text-center mb-3">
                      Last {h2hData.totalMatches} meetings
                    </Text>
                    <View className="flex-row justify-between items-center">
                      {[
                        { label: match.home?.name || "Home", value: h2hData.homeWins ?? 0, color: "#86EFAC" },
                        { label: "Draws", value: h2hData.draws ?? 0, color: "#9CA3AF" },
                        { label: match.away?.name || "Away", value: h2hData.awayWins ?? 0, color: "#93C5FD" },
                      ].map((col) => (
                        <View key={col.label} className="flex-1 items-center px-1">
                          <Text className="font-black text-2xl" style={{ color: col.color }}>
                            {col.value}
                          </Text>
                          <Text className="text-gray-300 font-bold text-[10px] mt-1 text-center" numberOfLines={1}>
                            {col.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Recent meetings */}
                  {Array.isArray(h2hData.matches) && h2hData.matches.length > 0 && (
                    <View className="bg-[#131517] rounded-2xl border border-white/10 my-2 overflow-hidden">
                      {h2hData.matches.map((m: any, idx: number) => (
                        <View
                          key={m.id || idx}
                          className={`px-4 py-3 ${idx > 0 ? "border-t border-white/5" : ""}`}
                        >
                          <Text className="text-gray-500 font-bold text-[10px] mb-1.5" numberOfLines={1}>
                            {[m.date, m.league].filter(Boolean).join(" · ")}
                          </Text>
                          <View className="flex-row items-center">
                            <View className="flex-1 flex-row items-center justify-end gap-2">
                              <Text className="text-white font-bold text-xs text-right flex-shrink" numberOfLines={1}>
                                {m.home?.name}
                              </Text>
                              {m.home?.logo ? (
                                <ExpoImage source={{ uri: m.home.logo }} style={{ width: 20, height: 20 }} contentFit="contain" />
                              ) : null}
                            </View>
                            <View className="bg-black/50 px-3 py-1 rounded-full mx-3 min-w-[52px] items-center">
                              <Text className="text-white font-black text-xs">
                                {m.home?.score ?? 0} - {m.away?.score ?? 0}
                              </Text>
                            </View>
                            <View className="flex-1 flex-row items-center gap-2">
                              {m.away?.logo ? (
                                <ExpoImage source={{ uri: m.away.logo }} style={{ width: 20, height: 20 }} contentFit="contain" />
                              ) : null}
                              <Text className="text-white font-bold text-xs flex-shrink" numberOfLines={1}>
                                {m.away?.name}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* TAB 6: PLAYER STATS (league leaderboards) */}
          {activeTab === "players" && (
            <View className="mb-6">
              {loadingPlayers ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : !hasPlayerLeaders ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">No Player Stats Available</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">
                    Player statistics aren't available for this competition.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Category selector */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-3"
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {LEADER_CATEGORIES.map((category) => {
                      const isActive = leaderCategory === category.id;
                      return (
                        <TouchableOpacity
                          key={category.id}
                          onPress={() => setLeaderCategory(category.id)}
                          className={`px-3.5 py-1.5 rounded-full ${
                            isActive ? "bg-[#02DB54] border border-[#02DB54]" : "bg-[#181A1C] border border-white/10"
                          }`}
                        >
                          <Text
                            className={`font-extrabold text-[11px] ${
                              isActive ? "text-black" : "text-gray-300"
                            }`}
                          >
                            {category.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View className="bg-[#131517] rounded-2xl border border-white/10 overflow-hidden">
                    <View className="flex-row items-center justify-between px-4 pt-3 pb-2 border-b border-white/10">
                      <Text className="text-gray-400 font-extrabold text-[11px]" numberOfLines={1}>
                        {match.league}
                      </Text>
                      <Text className="text-gray-500 font-bold text-[10px]">
                        {activeLeaderCategory.label}
                      </Text>
                    </View>

                    {leaderRows.length === 0 ? (
                      <Text className="text-gray-400 font-bold text-xs text-center py-8">
                        No {activeLeaderCategory.label.toLowerCase()} recorded yet this season.
                      </Text>
                    ) : (
                      leaderRows.map((player, idx) => {
                        const side = getLeaderSide(player);
                        const sideColor = side === "home" ? "#86EFAC" : side === "away" ? "#93C5FD" : null;
                        const [unitOne, unitMany] = activeLeaderCategory.unit;
                        return (
                          <View
                            key={`${player.id}-${idx}`}
                            className={`flex-row items-center px-4 py-2.5 ${idx > 0 ? "border-t border-white/5" : ""}`}
                            style={sideColor ? { backgroundColor: `${sideColor}14` } : undefined}
                          >
                            <Text
                              className={`font-black text-xs w-6 ${idx === 0 ? "text-[#02DB54]" : "text-gray-400"}`}
                            >
                              {idx + 1}
                            </Text>
                            <View className="w-9 h-9 rounded-full bg-[#181A1C] overflow-hidden items-center justify-center mr-3">
                              {player.photo ? (
                                <ExpoImage source={{ uri: player.photo }} style={{ width: 36, height: 36 }} contentFit="cover" />
                              ) : (
                                <Text className="text-gray-400 font-black text-xs">
                                  {player.name.charAt(0)}
                                </Text>
                              )}
                            </View>
                            <View className="flex-1 mr-2">
                              <Text
                                className="font-extrabold text-xs"
                                style={{ color: sideColor || "#FFFFFF" }}
                                numberOfLines={1}
                              >
                                {player.name}
                              </Text>
                              <View className="flex-row items-center gap-1.5 mt-0.5">
                                {player.teamLogo ? (
                                  <ExpoImage source={{ uri: player.teamLogo }} style={{ width: 14, height: 14 }} contentFit="contain" />
                                ) : null}
                                <Text className="text-gray-500 font-bold text-[10px] flex-shrink" numberOfLines={1}>
                                  {player.teamName}
                                  {player.appearances ? ` · ${player.appearances} apps` : ""}
                                </Text>
                              </View>
                            </View>
                            <View className="items-end">
                              <Text className="text-white font-black text-base">{player.value}</Text>
                              <Text className="text-gray-500 font-bold text-[9px]">
                                {leaderCategory === "topScorers" && player.penalties
                                  ? `${player.penalties} pen`
                                  : player.value === 1 ? unitOne : unitMany}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>

                  {/* Legend for the highlighted teams */}
                  <View className="flex-row items-center justify-center gap-4 mt-3">
                    {[
                      { name: match.home?.name, color: "#86EFAC" },
                      { name: match.away?.name, color: "#93C5FD" },
                    ].map((team) => (
                      <View key={team.color} className="flex-row items-center gap-1.5 flex-shrink">
                        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                        <Text className="text-gray-400 font-bold text-[10px]" numberOfLines={1}>
                          {team.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Banner Ad inside Match Details Modal */}
        <BannerAdComponent />
      </SafeAreaView>
    </Modal>
  );
}
