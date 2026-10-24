import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { Image as ExpoImage } from "expo-image";
import LiveMatchClock from "../common/LiveMatchClock";

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
  extra?: string | number;
  timestamp?: number;
}

interface LiveMatchesProps {
  liveMatches: Match[];
  width: number;
  onPressDetails: (match: Match) => void;
}

interface LiveMatchCardProps {
  match: Match;
  width: number;
  onPressDetails: (match: Match) => void;
}

// The live poll rebuilds every match object every 15s; only re-render a card when what it shows changed
const LiveMatchCard = React.memo(function LiveMatchCard({ match, width, onPressDetails }: LiveMatchCardProps) {
  return (
    <View
      className="flex-row bg-[#131415] rounded-3xl overflow-hidden mr-4 border border-[#ffffff08]"
      style={{ width: width * 0.82, height: 165 }}
    >
      {/* Left Panel: Lightweight pitch styling with League Crest (0 heavy SVGs) */}
      <View className="w-[36%] relative items-center justify-center bg-[#072412]">
        {/* Minimal pitch lines using pure lightweight Views */}
        <View className="absolute inset-2 border border-white/10 rounded-2xl pointer-events-none items-center justify-center">
          <View className="w-full h-[1px] bg-white/10" />
          <View className="absolute w-8 h-8 rounded-full border border-white/10" />
        </View>

        <View className="bg-[#131415] p-2.5 rounded-2xl border border-white/15 z-10">
          <ExpoImage
            source={match?.leagueLogo ? { uri: match.leagueLogo } : undefined}
            style={{ width: 44, height: 44 }}
            contentFit="contain"
          />
        </View>
      </View>

      {/* Right Panel: Teams, Score, and Details button */}
      <View className="w-[64%] p-4 justify-between bg-[#131415]">
        {/* Teams & Score Layout */}
        <View className="flex-row justify-between items-center mt-1">
          {/* Home Team */}
          <View className="items-center flex-1">
            <ExpoImage source={match.home?.logo ? { uri: match.home.logo } : undefined} style={{ width: 36, height: 36 }} contentFit="contain" />
            <Text
              className="text-gray-300 text-xs font-black mt-2 text-center"
              numberOfLines={1}
            >
              {match.home?.short || match.home?.name || "HOM"}
            </Text>
          </View>

          {/* Score & Time */}
          <View className="items-center flex-1 mx-1">
            <Text className="text-white text-xl font-extrabold tracking-tight">
              {match.score}
            </Text>
            <View className="bg-black/60 px-2.5 py-0.5 rounded-full mt-1">
              <LiveMatchClock minute={match.minute} status={match.status} extra={match.extra} timestamp={match.timestamp} showSeconds={false} />
            </View>
          </View>

          {/* Away Team */}
          <View className="items-center flex-1">
            <ExpoImage source={match.away?.logo ? { uri: match.away.logo } : undefined} style={{ width: 36, height: 36 }} contentFit="contain" />
            <Text
              className="text-gray-300 text-xs font-black mt-2 text-center"
              numberOfLines={1}
            >
              {match.away?.short || match.away?.name || "AWY"}
            </Text>
          </View>
        </View>

        {/* Details green button */}
        <TouchableOpacity
          onPress={() => onPressDetails(match)}
          className="w-full bg-[#02DB54] py-2.5 rounded-full items-center active:bg-[#00FF55] mt-1"
        >
          <Text className="text-black font-extrabold text-sm tracking-wide">
            Details
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}, (prev, next) =>
  prev.width === next.width &&
  prev.onPressDetails === next.onPressDetails &&
  prev.match.id === next.match.id &&
  prev.match.league === next.match.league &&
  prev.match.score === next.match.score &&
  prev.match.minute === next.match.minute &&
  prev.match.status === next.match.status &&
  prev.match.extra === next.match.extra &&
  prev.match.timestamp === next.match.timestamp &&
  prev.match.leagueLogo === next.match.leagueLogo &&
  prev.match.home?.logo === next.match.home?.logo &&
  prev.match.away?.logo === next.match.away?.logo
);

function LiveMatches({ liveMatches, width, onPressDetails }: LiveMatchesProps) {
  // All live matches without any limit
  const matches = React.useMemo(() => {
    if (!liveMatches || !Array.isArray(liveMatches)) return [];
    return liveMatches;
  }, [liveMatches]);

  const renderItem = React.useCallback(
    ({ item }: { item: Match }) => (
      <LiveMatchCard
        match={item}
        width={width}
        onPressDetails={onPressDetails}
      />
    ),
    [width, onPressDetails]
  );

  const cardItemWidth = width * 0.82 + 16;

  const getItemLayout = React.useCallback(
    (_: any, index: number) => ({
      length: cardItemWidth,
      offset: cardItemWidth * index,
      index,
    }),
    [cardItemWidth]
  );

  return (
    <View className="mt-4 px-4 bg-[#0D0E0F]">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <View className="w-2.5 h-2.5 bg-red-600 rounded-full mr-1" />
          <Text className="text-white font-extrabold text-base tracking-wide uppercase">
            Live Matches
          </Text>
        </View>
      </View>

      {/* Horizontal FlatList of ALL Live Matches (virtualized for ultra-fast performance) */}
      {matches.length === 0 ? (
        <View
          className="bg-[#131415] rounded-3xl p-5 items-center justify-center border border-[#ffffff08] self-center"
          style={{ width: width - 32, height: 110 }}
        >
          <View className="flex-row items-center gap-2 mb-1.5">
            <View className="w-2.5 h-2.5 rounded-full bg-gray-500" />
            <Text className="text-gray-200 font-extrabold text-sm tracking-wide">
              No Live Matches Currently
            </Text>
          </View>
          <Text className="text-gray-400 text-xs text-center font-medium">
            Nothing is being played right now. Check the fixtures below.
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          horizontal
          showsHorizontalScrollIndicator={false}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={false}
          getItemLayout={getItemLayout}
          keyExtractor={(match, idx) => match?.id || `live-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingRight: 20 }}
        />
      )}
    </View>
  );
}

export default React.memo(LiveMatches);
