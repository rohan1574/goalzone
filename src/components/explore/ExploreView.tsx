import React from "react";
import { FlatList, View, Text, RefreshControl } from "react-native";
import LiveMatches from "./LiveMatches";
import { LeagueSection, LeaguesEmpty, LeaguesLoadingBanner, POPULAR_LEAGUE_IDS, type LeagueGroup } from "./Leagues";

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

  // Popular leagues only, unless the user is searching (search covers every league of the day)
  const visibleLeagues = React.useMemo(() => {
    if (!leaguesList) return [];
    if (isSearching) return leaguesList;
    return leaguesList.filter((league) => POPULAR_LEAGUE_IDS.has(String(league.leagueId)));
  }, [leaguesList, isSearching]);

  const renderLeague = React.useCallback(
    ({ item }: { item: LeagueGroup }) => (
      <View className="px-4">
        <LeagueSection league={item} onPressDetails={onPressDetails} />
      </View>
    ),
    [onPressDetails],
  );

  // Virtualized: a busy match day has hundreds of cards, and keeping them all mounted in a
  // ScrollView made every redraw walk the whole tree on the UI thread (ANRs in dispatchDraw)
  return (
    <FlatList
      style={{ flex: 1 }}
      data={visibleLeagues}
      keyExtractor={(league, idx) => league?.leagueId || `lg-${idx}`}
      renderItem={renderLeague}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={7}
      // Android defaults this to true; with Fabric it can crash in ReactClippingViewManager.addView
      removeClippedSubviews={false}
      contentContainerStyle={{ paddingBottom: 140 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#02DB54"
          colors={["#02DB54"]}
        />
      }
      ListHeaderComponent={
        <>
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

          {visibleLeagues.length > 0 && (
            <View className="mt-6 px-4">
              {loadingFixtures && <LeaguesLoadingBanner />}
            </View>
          )}
        </>
      }
      ListEmptyComponent={<LeaguesEmpty loadingFixtures={loadingFixtures} searchQuery={searchQuery} />}
      ListFooterComponent={visibleLeagues.length > 0 ? <View className="h-24" /> : null}
    />
  );
}
