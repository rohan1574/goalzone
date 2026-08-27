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
  onToggleNotification: (id: string) => void;
  width: number;
  onPressDetails: (match: Match) => void;
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
}: ExploreViewProps) {
  return (
    <ScrollView
      className="flex-1"
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

      {/* Sticker Collection WC Yellow Promo Banner */}
      <TouchableOpacity className="mx-4 mt-6 bg-[#FFC800] rounded-3xl p-5 flex-row items-center justify-between relative overflow-hidden">
        <View className="flex-row items-center gap-3">
          <View className="bg-white/20 p-2.5 rounded-full">
            <Trophy size={26} color="#0D0E0F" />
          </View>
          <Text className="text-black font-black text-base tracking-tight">
            Sticker Collection WC
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="bg-[#69F0AE] px-2.5 py-1 rounded-lg">
            <Text className="text-black text-[10px] font-black uppercase tracking-wider">
              New
            </Text>
          </View>
          <ChevronRight size={18} color="#000000" />
        </View>
      </TouchableOpacity>

      {/* Match Fixture lists categorized by League */}
      <Leagues
        leaguesList={leaguesList}
        activeNotifications={activeNotifications}
        onToggleNotification={onToggleNotification}
      />
    </ScrollView>
  );
}
