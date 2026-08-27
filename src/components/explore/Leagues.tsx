import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { ChevronDown, Bell } from "lucide-react-native";

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

interface LeaguesProps {
  leaguesList: LeagueGroup[];
  activeNotifications: { [key: string]: boolean };
  onToggleNotification: (id: string) => void;
}

export default function Leagues({
  leaguesList,
  activeNotifications,
  onToggleNotification,
}: LeaguesProps) {
  return (
    <View className="mt-6 px-4 mb-24 bg-[#0D0E0F]">
      {leaguesList.map((league) => (
        <View key={league.leagueId} className="mb-6">
          {/* League Header Title Accordion */}
          <View className="flex-row items-center justify-between mb-3.5">
            <View className="flex-row items-center gap-2.5">
              <Image source={{ uri: league.leagueLogo }} className="w-6 h-6 rounded-full" />
              <Text className="text-white font-extrabold text-base">
                {league.leagueName}
              </Text>
            </View>
            <ChevronDown size={18} color="#9BA1A6" />
          </View>

          {/* League Match Cards */}
          {league.matches.map((match) => {
            const isBellActive = activeNotifications[match.id];
            return (
              <View
                key={match.id}
                className="relative bg-[#131415] rounded-3xl p-4.5 mb-3 border border-[#ffffff08] overflow-hidden flex-row justify-between items-center"
              >
                {/* Glow indicator line on left */}
                <View className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#02DB54] rounded-l-3xl shadow-lg shadow-[#02DB54]" />

                {/* Left column: Match times / info */}
                <View className="w-[18%] pl-2 justify-center">
                  <Text className="text-gray-400 text-xs font-bold tracking-wider mb-1">
                    {match.status}
                  </Text>
                  <Text className="text-white font-black text-sm tracking-tight mb-0.5">
                    {match.time}
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
                    <Image source={{ uri: match.home.logo }} className="w-6 h-6" />
                    <Text
                      className="text-white font-extrabold text-[14px] tracking-wide"
                      numberOfLines={1}
                    >
                      {match.home.name}
                    </Text>
                  </View>
                  {/* Away Row */}
                  <View className="flex-row items-center gap-3">
                    <Image source={{ uri: match.away.logo }} className="w-6 h-6" />
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
                  onPress={() => onToggleNotification(match.id)}
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
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
