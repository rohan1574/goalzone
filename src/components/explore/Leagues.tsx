import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { ChevronDown } from "lucide-react-native";
import LiveMatchClock from "../common/LiveMatchClock";

interface LeagueMatch {
  id: string;
  status: string;
  time: string;
  score?: string;
  minute?: string;
  date?: string;
  home: { id?: string | number; name: string; logo: string };
  away: { id?: string | number; name: string; logo: string };
  extra?: string | number;
  timestamp?: number;
}

export interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  leagueLogo: string;
  matches: LeagueMatch[];
}

const MatchCard = React.memo(function MatchCard({
  match,
  leagueName,
  leagueId,
  leagueLogo,
  onPressDetails,
}: {
  match: LeagueMatch;
  leagueName: string;
  leagueId: string;
  leagueLogo: string;
  onPressDetails?: (match: any) => void;
}) {
  const stUpper = String(match.status || "").trim().toUpperCase();
  const minUpper = String(match.minute || "").trim().toUpperCase();

  const bracketMatch = minUpper.match(/[\(\[]\+?(\d+)[\)\]]/);
  const bracketExtra = bracketMatch ? parseInt(bracketMatch[1], 10) : null;
  const propExtra = match.extra != null ? parseInt(String(match.extra), 10) : null;
  const plusMatch = minUpper.match(/\+(\d+)/);
  const plusExtra = plusMatch ? parseInt(plusMatch[1], 10) : null;
  const targetExtra = bracketExtra || propExtra || plusExtra;
  const elapsedExtra = plusExtra || 0;

  const isExtraComplete = Boolean(
    targetExtra &&
    elapsedExtra >= targetExtra &&
    (stUpper === "2H" || stUpper === "1H" || minUpper.startsWith("90") || minUpper.startsWith("45"))
  );

  const isTimeExpired = match.timestamp
    ? (Date.now() - match.timestamp * 1000) / 60000 >= 115
    : false;

  const isFinished =
    isTimeExpired ||
    (isExtraComplete && (stUpper === "2H" || minUpper.startsWith("90"))) ||
    stUpper === "FT" ||
    stUpper === "AET" ||
    stUpper === "PEN" ||
    stUpper.includes("FINISH") ||
    stUpper.includes("ENDED") ||
    stUpper.includes("FULL TIME") ||
    minUpper === "FT" ||
    minUpper === "AET" ||
    minUpper === "PEN" ||
    minUpper.includes("FINISH") ||
    minUpper.includes("ENDED") ||
    minUpper.includes("FULL TIME");

  const isHalfTime =
    stUpper === "HT" ||
    minUpper === "HT" ||
    (isExtraComplete && (stUpper === "1H" || minUpper.startsWith("45")));

  const effectiveStatus = isFinished
    ? (stUpper === "AET" || minUpper === "AET" ? "AET" : stUpper === "PEN" || minUpper === "PEN" ? "PEN" : "FT")
    : isHalfTime
    ? "HT"
    : (match.status || "NS");

  const handleCardPress = React.useCallback(() => {
    if (onPressDetails) {
      onPressDetails({
        id: match.id,
        league: leagueName,
        leagueId: leagueId,
        leagueLogo: leagueLogo,
        home: {
          id: (match.home as any)?.id,
          name: match.home?.name || "Home",
          short: (match.home?.name || "HOM").substring(0, 3).toUpperCase(),
          logo: match.home?.logo || "",
        },
        away: {
          id: (match.away as any)?.id,
          name: match.away?.name || "Away",
          short: (match.away?.name || "AWY").substring(0, 3).toUpperCase(),
          logo: match.away?.logo || "",
        },
        score: match.score || (isFinished || match.status === "Live" ? match.time : "VS"),
        minute: match.minute || effectiveStatus,
        status: match.status || effectiveStatus,
        extra: match.extra,
        timestamp: match.timestamp,
      });
    }
  }, [match, leagueName, leagueId, leagueLogo, onPressDetails, isFinished, effectiveStatus]);

  const isLiveTicking =
    !isFinished &&
    (stUpper === "LIVE" ||
      stUpper === "1H" ||
      stUpper === "2H" ||
      stUpper === "ET" ||
      minUpper.includes("+") ||
      minUpper.includes("'"));

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handleCardPress}
      className="relative bg-[#131415] mx-4 mb-2 rounded-2xl px-4 py-3 border border-white/5 flex-row items-center overflow-hidden"
    >
      {/* Flat indicator line on left (no expensive layer shadows) */}
      <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54]" />

      {/* Left column: Match times / info */}
      <View className="w-[20%] pl-2 justify-center">
        {isLiveTicking ? (
          <View className="mb-1 items-start">
            <LiveMatchClock minute={match.minute} status={match.status} extra={match.extra} timestamp={match.timestamp} showSeconds={false} />
          </View>
        ) : (
          <Text className="text-gray-400 text-xs font-bold tracking-wider mb-1">
            {effectiveStatus}
          </Text>
        )}
        <Text className="text-[#02DB54] font-black text-sm tracking-tight mb-0.5">
          {match.score && match.score !== "VS" ? match.score : match.time}
        </Text>
        {match.date && (
          <Text className="text-gray-500 text-[10px] font-semibold">
            {match.date}
          </Text>
        )}
      </View>

      {/* Divider Line */}
      <View className="w-[1px] h-10 bg-white/10" />

      {/* Middle column: Team names and logo crests */}
      <View className="flex-1 px-4 gap-3">
        {/* Home Row */}
        <View className="flex-row items-center gap-3">
          <ExpoImage source={match.home?.logo ? { uri: match.home.logo } : undefined} style={{ width: 24, height: 24 }} contentFit="contain" />
          <Text
            className="text-white font-extrabold text-[14px] tracking-wide"
            numberOfLines={1}
          >
            {match.home?.name || "Home"}
          </Text>
        </View>
        {/* Away Row */}
        <View className="flex-row items-center gap-3">
          <ExpoImage source={match.away?.logo ? { uri: match.away.logo } : undefined} style={{ width: 24, height: 24 }} contentFit="contain" />
          <Text
            className="text-white font-extrabold text-[14px] tracking-wide"
            numberOfLines={1}
          >
            {match.away?.name || "Away"}
          </Text>
        </View>
      </View>

    </TouchableOpacity>
  );
}, (prev, next) => {
  return (
    prev.match.id === next.match.id &&
    prev.match.score === next.match.score &&
    prev.match.minute === next.match.minute &&
    prev.match.status === next.match.status &&
    prev.match.time === next.match.time &&
    prev.leagueId === next.leagueId &&
    prev.onPressDetails === next.onPressDetails
  );
});

export const POPULAR_LEAGUE_IDS = new Set([
  // England
  '39',   // Premier League
  '45',   // FA Cup
  '48',   // League Cup (EFL Cup)
  '528',  // Community Shield
  '40',   // Championship

  // Spain
  '140',  // La Liga
  '143',  // Copa del Rey
  '556',  // Supercopa de España
  '141',  // Segunda División

  // Italy
  '135',  // Serie A
  '137',  // Coppa Italia
  '547',  // Supercoppa Italiana
  '136',  // Serie B

  // Germany
  '78',   // Bundesliga
  '81',   // DFB Pokal
  '529',  // DFL-Supercup
  '79',   // 2. Bundesliga

  // France
  '61',   // Ligue 1
  '66',   // Coupe de France
  '526',  // Trophée des Champions
  '62',   // Ligue 2

  // Brazil
  '71',   // Brasileirão Série A
  '73',   // Copa do Brasil
  '632',  // Supercopa do Brasil
  '72',   // Brasileirão Série B

  // USA
  '253',  // MLS
  '257',  // US Open Cup
  '772',  // Leagues Cup

  // Saudi Arabia
  '307',  // Saudi Pro League
  '504',  // King Cup of Champions
  '826',  // Saudi Super Cup

  // Asia
  '17',   // AFC Champions League Elite
  '18',   // AFC Champions League Two

  // Continental & International
  '2',    // UEFA Champions League
  '3',    // UEFA Europa League
  '848',  // UEFA Conference League
  '5',    // UEFA Nations League
  '13',   // Copa Libertadores
  '88',   // Eredivisie
  '94',   // Primeira Liga
  '128',  // Liga Profesional Argentina
  '1',    // World Cup
  '4',    // Euro Championship
  '9',    // Copa America
  '10',   // International Friendlies
  '11',   // UEFA Nations League
  '15',   // FIFA Club World Cup
  '393',  // Legacy / Ecuador
  '239'   // Süper Lig
]);

// One league block (header + its match cards); ExploreView renders these as FlatList rows
export const LeagueSection = React.memo(function LeagueSection({
  league,
  onPressDetails,
}: {
  league: LeagueGroup;
  onPressDetails?: (match: any) => void;
}) {
  return (
    <View className="mb-6">
      {/* League Header Title Accordion */}
      <View className="flex-row items-center justify-between mb-3.5">
        <View className="flex-row items-center gap-2.5">
          <ExpoImage source={league?.leagueLogo ? { uri: league.leagueLogo } : undefined} style={{ width: 24, height: 24, borderRadius: 12 }} contentFit="contain" />
          <Text className="text-white font-extrabold text-base">
            {league?.leagueName || "League"}
          </Text>
        </View>
        <ChevronDown size={18} color="#9BA1A6" />
      </View>

      {/* League Match Cards */}
      {(league?.matches ?? []).map((match, mIdx) => (
        <MatchCard
          key={match?.id || `${league?.leagueId || 'lg'}-${mIdx}`}
          match={match}
          leagueName={league?.leagueName || ""}
          leagueId={league?.leagueId || ""}
          leagueLogo={league?.leagueLogo || ""}
          onPressDetails={onPressDetails}
        />
      ))}
    </View>
  );
}, (prev, next) => {
  if (prev.league?.leagueId !== next.league?.leagueId) return false;
  if (prev.league?.matches?.length !== next.league?.matches?.length) return false;
  if (prev.onPressDetails !== next.onPressDetails) return false;
  const prevMatches = prev.league?.matches || [];
  const nextMatches = next.league?.matches || [];
  return prevMatches.every((pm, i) => {
    const nm = nextMatches[i];
    return (
      nm &&
      pm.id === nm.id &&
      pm.score === nm.score &&
      pm.minute === nm.minute &&
      pm.status === nm.status
    );
  });
});

// Shown in place of the league list while the selected date loads, or when nothing matches
export function LeaguesEmpty({
  loadingFixtures,
  searchQuery,
}: {
  loadingFixtures?: boolean;
  searchQuery?: string;
}) {
  if (loadingFixtures) {
    return (
      <View className="mt-8 px-4 items-center justify-center py-12">
        <ActivityIndicator size="large" color="#02DB54" />
        <Text className="text-gray-400 font-semibold text-xs mt-3">
          Loading fixtures for date...
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-8 px-4 items-center justify-center py-12 bg-[#131415] rounded-3xl mx-4 border border-white/5">
      <Text className="text-white font-bold text-sm mb-1 text-center">
        {searchQuery && searchQuery.trim()
          ? `No matches found for "${searchQuery}"`
          : "No popular league matches for this date."}
      </Text>
      {searchQuery && searchQuery.trim() && (
        <Text className="text-gray-400 text-xs text-center px-4 mt-1">
          Try searching another team name, short code (e.g. BAR, RMA, CHE), or change dates.
        </Text>
      )}
    </View>
  );
}

// Banner above the league list while a refresh of the selected date is in flight
export function LeaguesLoadingBanner() {
  return (
    <View className="flex-row items-center justify-center py-2 mb-2 bg-[#131415] rounded-xl border border-white/5">
      <ActivityIndicator size="small" color="#02DB54" />
      <Text className="text-gray-400 font-semibold text-xs ml-2">
        Loading matches for date...
      </Text>
    </View>
  );
}
