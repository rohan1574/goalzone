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
  activeNotifications: { [key: string]: boolean };
  onToggleNotification: (id: string, matchName?: string) => void;
  width: number;
  onPressDetails: (match: Match) => void;
  loadingFixtures?: boolean;
  searchQuery?: string;
}

export default function ExploreView({
  refreshing,
  onRefresh,
  liveMatches,
  leaguesList,
  activeNotifications,
  onToggleNotification,
  width,
  onPressDetails,
  loadingFixtures,
}: ExploreViewProps) {
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
      {/* Horizontal Carousel of Live Matches */}
      <LiveMatches liveMatches={liveMatches} width={width} onPressDetails={onPressDetails} />

     

      {/* Match Fixture lists categorized by League */}
      <Leagues
        leaguesList={leaguesList}
        activeNotifications={activeNotifications}
        onToggleNotification={onToggleNotification}
        onPressDetails={onPressDetails}
        loadingFixtures={loadingFixtures}
      />
    </ScrollView>
  );
}
