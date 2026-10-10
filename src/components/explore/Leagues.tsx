import React from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronDown, Bell } from "lucide-react-native";
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
}

interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  leagueLogo: string;
  matches: LeagueMatch[];
}

interface LeaguesProps {
  leaguesList: LeagueGroup[];
  activeNotifications: { [key: string]: boolean };
  onToggleNotification: (id: string, matchName?: string) => void;
  onPressDetails?: (match: any) => void;
  loadingFixtures?: boolean;
  searchQuery?: string;
}

const MatchCard = React.memo(function MatchCard({
  match,
  leagueName,
  leagueId,
  leagueLogo,
  isBellActive,
  onToggleNotification,
  onPressDetails,
}: {
  match: LeagueMatch;
  leagueName: string;
  leagueId: string;
  leagueLogo: string;
  isBellActive: boolean;
  onToggleNotification: (id: string, matchName?: string) => void;
  onPressDetails?: (match: any) => void;
}) {
  const handleCardPress = React.useCallback(() => {
    if (onPressDetails) {
      onPressDetails({
        id: match.id,
        league: leagueName,
        leagueId: leagueId,
        leagueLogo: leagueLogo,
        home: {
          id: (match.home as any)?.id,
          name: match.home.name,
          short: match.home.name.substring(0, 3).toUpperCase(),
          logo: match.home.logo,
        },
        away: {
          id: (match.away as any)?.id,
          name: match.away.name,
          short: match.away.name.substring(0, 3).toUpperCase(),
          logo: match.away.logo,
        },
        score: match.score || (match.status === "FT" || match.status === "Live" ? match.time : "VS"),
        minute: match.minute || match.status || "NS",
        status: match.status || "NS",
      });
    }
  }, [match, leagueName, leagueId, leagueLogo, onPressDetails]);

  const handleBellPress = React.useCallback(
    (e: any) => {
      e.stopPropagation();
      const matchName = `${match.home?.name || 'Home'} vs ${match.away?.name || 'Away'}`;
      onToggleNotification(match.id, matchName);
    },
    [match, onToggleNotification],
  );

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handleCardPress}
      className="relative bg-[#131415] rounded-3xl p-4.5 mb-3 border border-[#ffffff08] overflow-hidden flex-row justify-between items-center"
    >
      {/* Glow indicator line on left */}
      <View className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#02DB54] rounded-l-3xl shadow-lg shadow-[#02DB54]" />

      {/* Left column: Match times / info */}
      <View className="w-[20%] pl-2 justify-center">
        {match.status === "Live" ? (
          <View className="mb-1 items-start">
            <LiveMatchClock minute={match.minute} status={match.status} />
          </View>
        ) : (
          <Text className="text-gray-400 text-xs font-bold tracking-wider mb-1">
            {match.status}
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
          <Image source={{ uri: match.home.logo }} className="w-6 h-6" resizeMethod="resize" />
          <Text
            className="text-white font-extrabold text-[14px] tracking-wide"
            numberOfLines={1}
          >
            {match.home.name}
          </Text>
        </View>
        {/* Away Row */}
        <View className="flex-row items-center gap-3">
          <Image source={{ uri: match.away.logo }} className="w-6 h-6" resizeMethod="resize" />
          <Text
            className="text-white font-extrabold text-[14px] tracking-wide"
            numberOfLines={1}
          >
            {match.away.name}
          </Text>
        </View>
      </View>

      {/* Right column: Notification Bell Icon */}
      <TouchableOpacity
        onPress={handleBellPress}
        className={`p-2.5 rounded-full ${
          isBellActive ? "bg-[#02DB54]/15" : "bg-white/5"
        }`}
      >
        <Bell
          size={18}
          color={isBellActive ? "#02DB54" : "#ECEDEE"}
          fill={isBellActive ? "#02DB54" : "none"}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const POPULAR_LEAGUE_IDS = new Set([
  '39',   // Premier League
  '140',  // La Liga
  '135',  // Serie A
  '78',   // Bundesliga
  '61',   // Ligue 1
  '2',    // UEFA Champions League
  '3',    // UEFA Europa League
  '848',  // UEFA Conference League
  '88',   // Eredivisie
  '94',   // Primeira Liga
  '71',   // Brasileirão Série A
  '128',  // Liga Profesional Argentina
  '253',  // MLS
  '307',  // Saudi Pro League
  '13',   // Copa Libertadores
  '1',    // World Cup
  '4',    // Euro Championship
  '9',    // Copa America
  '10',   // International Friendlies
  '11',   // UEFA Nations League
  '15',   // FIFA Club World Cup
  '393',  // AFC Champions League
  '239'   // Süper Lig
]);

export default function Leagues({
  leaguesList,
  activeNotifications,
  onToggleNotification,
  onPressDetails,
  loadingFixtures,
  searchQuery,
}: LeaguesProps) {
  const [displayLimit, setDisplayLimit] = React.useState(15);

  const filteredLeaguesList = React.useMemo(() => {
    if (!leaguesList) return [];
    return leaguesList.filter((league) => POPULAR_LEAGUE_IDS.has(String(league.leagueId)));
  }, [leaguesList]);

  // Reset display limit when leaguesList changes (e.g. date changed)
  React.useEffect(() => {
    setDisplayLimit(15);
  }, [leaguesList]);

  if (loadingFixtures && (!filteredLeaguesList || filteredLeaguesList.length === 0)) {
    return (
      <View className="mt-8 px-4 items-center justify-center py-12">
        <ActivityIndicator size="large" color="#02DB54" />
        <Text className="text-gray-400 font-semibold text-xs mt-3">
          Loading fixtures for date...
        </Text>
      </View>
    );
  }

  if (!filteredLeaguesList || filteredLeaguesList.length === 0) {
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

  const visibleLeagues = filteredLeaguesList.slice(0, displayLimit);
  const remainingCount = filteredLeaguesList.length - visibleLeagues.length;

  return (
    <View className="mt-6 px-4 mb-24 bg-[#0D0E0F]">
      {loadingFixtures && (
        <View className="flex-row items-center justify-center py-2 mb-2 bg-[#131415] rounded-xl border border-white/5">
          <ActivityIndicator size="small" color="#02DB54" />
          <Text className="text-gray-400 font-semibold text-xs ml-2">
            Loading matches for date...
          </Text>
        </View>
      )}
      {visibleLeagues.map((league) => (
        <View key={league.leagueId} className="mb-6">
          {/* League Header Title Accordion */}
          <View className="flex-row items-center justify-between mb-3.5">
            <View className="flex-row items-center gap-2.5">
              <Image source={{ uri: league.leagueLogo }} className="w-6 h-6 rounded-full" resizeMethod="resize" />
              <Text className="text-white font-extrabold text-base">
                {league.leagueName}
              </Text>
            </View>
            <ChevronDown size={18} color="#9BA1A6" />
          </View>

          {/* League Match Cards */}
          {league.matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              leagueName={league.leagueName}
              leagueId={league.leagueId}
              leagueLogo={league.leagueLogo}
              isBellActive={!!activeNotifications[match.id]}
              onToggleNotification={onToggleNotification}
              onPressDetails={onPressDetails}
            />
          ))}
        </View>
      ))}

      {remainingCount > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setDisplayLimit((prev) => prev + 20)}
          className="bg-[#131415] py-3.5 px-6 rounded-2xl items-center justify-center flex-row gap-2 border border-white/10 my-4"
        >
          <Text className="text-[#02DB54] font-extrabold text-sm">
            Show More Leagues ({remainingCount} remaining)
          </Text>
          <ChevronDown size={18} color="#02DB54" />
        </TouchableOpacity>
      )}
    </View>
  );
}
