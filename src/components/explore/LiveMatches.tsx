import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Svg, { Rect, Circle, Line, Polygon, Path } from "react-native-svg";

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

interface LiveMatchesProps {
  liveMatches: Match[];
  width: number;
  onPressDetails: (match: Match) => void;
}

export default function LiveMatches({ liveMatches, width, onPressDetails }: LiveMatchesProps) {
  // Vector Soccer Field pattern
  const SoccerFieldVector = () => (
    <View className="absolute inset-0 w-full h-full overflow-hidden opacity-60">
      <Svg height="100%" width="100%" viewBox="0 0 100 160">
        <Rect width="100" height="160" fill="#082c16" />
        <Line x1="0" y1="80" x2="100" y2="80" stroke="#ffffff30" strokeWidth="1" />
        <Circle cx="50" cy="80" r="18" fill="none" stroke="#ffffff30" strokeWidth="1" />
        <Rect x="15" y="0" width="70" height="25" fill="none" stroke="#ffffff30" strokeWidth="1" />
        <Rect x="28" y="0" width="44" height="10" fill="none" stroke="#ffffff30" strokeWidth="1" />
        <Rect x="15" y="135" width="70" height="25" fill="none" stroke="#ffffff30" strokeWidth="1" />
        <Rect x="28" y="135" width="44" height="10" fill="none" stroke="#ffffff30" strokeWidth="1" />
      </Svg>
    </View>
  );

  return (
    <View className="mt-4 px-4 bg-[#0D0E0F]">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <View className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse mr-1" />
          <Text className="text-white font-extrabold text-base tracking-wide uppercase">
            Live Matches
          </Text>
        </View>
        <TouchableOpacity className="flex-row items-center">
          <Text className="text-gray-400 text-sm font-bold mr-1">See all</Text>
          <ChevronRight size={16} color="#9BA1A6" />
        </TouchableOpacity>
      </View>

      {/* Horizontal scroll of Live Matches */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
      >
        {liveMatches.map((match) => (
          <View
            key={match.id}
            className="flex-row bg-[#131415] rounded-3xl overflow-hidden mr-4 border border-[#ffffff08]"
            style={{ width: width * 0.82, height: 165 }}
          >
            {/* Left Panel: Soccer Field with League Crest */}
            <View className="w-[36%] relative items-center justify-center bg-[#092d16]">
              <SoccerFieldVector />
              <View className="bg-[#131415] p-2.5 rounded-3xl border border-[#ffffff20] z-10 shadow-lg">
                {match.league === "MLS" ? (
                  <View className="w-16 h-16 relative overflow-hidden items-center justify-center">
                    <Svg width="60" height="60" viewBox="0 0 100 100">
                      <Polygon points="10,10 90,10 90,60 50,90 10,60" fill="#ffffff" />
                      <Polygon points="14,14 86,14 86,58 50,85 14,58" fill="#1C3F94" />
                      <Path d="M14,14 L86,58" stroke="#ffffff" strokeWidth="5" />
                      <Text className="text-[14px] font-black text-white text-center">MLS</Text>
                    </Svg>
                  </View>
                ) : (
                  <Image
                    source={{ uri: match.leagueLogo }}
                    className="w-14 h-14"
                    resizeMode="contain"
                  />
                )}
              </View>
            </View>

            {/* Right Panel: Teams, Score, and Details button */}
            <View className="w-[64%] p-4 justify-between bg-[#131415]">
              {/* Teams & Score Layout */}
              <View className="flex-row justify-between items-center mt-1">
                {/* Home Team */}
                <View className="items-center flex-1">
                  <Image source={{ uri: match.home.logo }} className="w-9 h-9" />
                  <Text
                    className="text-gray-300 text-xs font-black mt-2 text-center"
                    numberOfLines={1}
                  >
                    {match.home.short}
                  </Text>
                </View>

                {/* Score & Time */}
                <View className="items-center flex-1 mx-1">
                  <Text className="text-white text-xl font-extrabold tracking-tight">
                    {match.score}
                  </Text>
                  <View className="bg-black/60 px-2 py-0.5 rounded-full mt-1">
                    <Text className="text-[#02DB54] text-[10px] font-bold">
                      {match.minute}
                    </Text>
                  </View>
                </View>

                {/* Away Team */}
                <View className="items-center flex-1">
                  <Image source={{ uri: match.away.logo }} className="w-9 h-9" />
                  <Text
                    className="text-gray-300 text-xs font-black mt-2 text-center"
                    numberOfLines={1}
                  >
                    {match.away.short}
                  </Text>
                </View>
              </View>

              {/* Details green button */}
              <TouchableOpacity
                onPress={() => onPressDetails(match)}
                className="w-full bg-[#02DB54] py-2.5 rounded-full items-center active:bg-[#00FF55] shadow-sm shadow-[#02DB54]/20 mt-1"
              >
                <Text className="text-black font-extrabold text-sm tracking-wide">
                  Details
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
