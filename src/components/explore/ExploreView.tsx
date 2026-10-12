import React from "react";
import { ScrollView, TouchableOpacity, View, Text, RefreshControl } from "react-native";
import { Trophy, ChevronRight } from "lucide-react-native";
import LiveMatches from "./LiveMatches";
import Leagues from "./Leagues";

interface Team {
  name: string;
  short: string;
  logo: string;
}

interface Match {
  id: string;
  league: string;
  leagueLogo?: string;
  home: Team;
  away: Team;
  score: string;
  minute: string;
  status: string;
}

interface LeagueMatch {
  id: string;
  status: string;
  time: string;
  date?: string;
  home: { name: string; logo: string };
  away: { name: string; logo: string };
}

interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  leagueLogo: string;
  matches: LeagueMatch[];
}

interface ExploreViewProps {
  refreshing: boolean;
  onRefresh: () => void;
  liveMatches: Match[];
  leaguesList: LeagueGroup[];
  width: number;
  onPressDetails: (match: Match) => void;
  loadingFixtures?: boolean;
  searchQuery?: string;
  selectedDate?: Date;
}

export default function ExploreView({
  refreshing,
  onRefresh,
  liveMatches,
  leaguesList,
  width,
  onPressDetails,
  loadingFixtures,
  searchQuery,
  selectedDate,
}: ExploreViewProps) {
  const isSearching = !!searchQuery?.trim();
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 140 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#02DB54"
          colors={["#02DB54"]}
        />
      }
    >
      {/* Search scope hint: results come from the selected day's fixtures */}
      {isSearching && (
        <Text className="text-gray-400 text-xs font-bold px-4 mt-4">
          Results for "{searchQuery!.trim()}" on{" "}
          {selectedDate?.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
          {" · "}pick another day to search it
        </Text>
      )}

      {/* Horizontal Carousel of Live Matches (hidden while searching unless a live match matches) */}
      {(!isSearching || liveMatches.length > 0) && (
        <LiveMatches liveMatches={liveMatches} width={width} onPressDetails={onPressDetails} />
      )}

     

      {/* Match Fixture lists categorized by League */}
      <Leagues
        leaguesList={leaguesList}
        onPressDetails={onPressDetails}
        loadingFixtures={loadingFixtures}
        searchQuery={searchQuery}
      />
    </ScrollView>
  );
}
