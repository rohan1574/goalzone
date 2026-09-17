import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  Text,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  loadFootballDashboard,
  fetchFixturesByDate,
  getTeamLogo,
  getMatchScore,
  getMatchStatus,
  getMatchLeague,
  getMatchLeagueId,
  getMatchEventId,
  getMatchValue,
} from "../services/footballApi";

// Component imports for tabs
import ExploreView from "../components/explore/ExploreView";
import LeaguesView from "../components/leagues/LeaguesView";
import HighlightView from "../components/highlight/HighlightView";
import TeamsView from "../components/teams/TeamsView";
import PredictionView from "../components/prediction/PredictionView";
import Header from "../components/explore/Header";
import MatchDetailsModal from "../components/details/MatchDetailsModal";
import BottomNavBar, { TabType } from "../components/bottom/BottomNavBar";
import SplashScreen from "../components/SplashScreen/SplashScreen";
import LoadingModal from "../components/loading/LoadingModal";
import BannerAdComponent from "../components/ads/BannerAdComponent";
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

const { width } = Dimensions.get("window");

// Interstitial Ad Unit ID (TestIds.INTERSTITIAL for dev, real ID for production)
const interstitialAdUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : "ca-app-pub-3940256099942544/1033173712"; // <-- Replace with your real AdMob Interstitial Ad Unit ID in production

const interstitialAd = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

// Mock Data matching screenshot exactly as fallbacks
const MOCK_LIVE_MATCHES = [
  {
    id: "live-mls-1",
    league: "MLS",
    leagueLogo: "https://images.fotmob.com/image_resources/logo/leaguelogo/130.png",
    home: {
      name: "Nashville SC",
      short: "NSH",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10599.png",
    },
    away: {
      name: "Columbus Crew",
      short: "COL",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/4559.png",
    },
    score: "0 - 0",
    minute: "9'",
    status: "Live",
  },
  {
    id: "live-laliga-2",
    league: "La Liga",
    leagueLogo: "https://images.fotmob.com/image_resources/logo/leaguelogo/87.png",
    home: {
      name: "Real Madrid",
      short: "RMA",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png",
    },
    away: {
      name: "Barcelona",
      short: "BAR",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8634.png",
    },
    score: "2 - 1",
    minute: "76'",
    status: "Live",
  },
];

const MOCK_LEAGUES = [
  {
    leagueId: "47",
    leagueName: "Premier League",
    leagueLogo: "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png",
    matches: [
      {
        id: "epl-1",
        status: "NS",
        time: "19:00",
        date: "23/08",
        home: {
          name: "Manchester City",
          logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8457.png",
        },
        away: {
          name: "AFC Bournemouth",
          logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8086.png",
        },
      },
      {
        id: "epl-2",
        status: "NS",
        time: "19:00",
        date: "23/08",
        home: {
          name: "Brighton & Hove Albion",
          logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10204.png",
        },
        away: {
          name: "Chelsea",
          logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png",
        },
      },
    ],
  },
];

export default function ExploreScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<TabType>("explore");
  const [activeNotifications, setActiveNotifications] = useState<{ [key: string]: boolean }>({
    "epl-1": true,
  });
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [dateFixtures, setDateFixtures] = useState<any[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(false);
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const pendingMatchRef = React.useRef<any>(null);
  const pendingTabRef = React.useRef<TabType | null>(null);
  const pendingShowMainRef = React.useRef<boolean>(false);

  // SplashScreen shown every time the app starts (no AsyncStorage check needed)

  // Load interstitial ad and set up event listeners
  useEffect(() => {
    const unsubscribeLoaded = interstitialAd.addAdEventListener(
      AdEventType.LOADED,
      () => {
        console.log("Interstitial ad loaded");
        setInterstitialLoaded(true);
      }
    );

    const unsubscribeClosed = interstitialAd.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log("Interstitial ad closed");
        setInterstitialLoaded(false);
        // Transition from SplashScreen to main app after ad
        if (pendingShowMainRef.current) {
          pendingShowMainRef.current = false;
          setIsOnboardingCompleted(true);
        }
        // Open match details after the ad is dismissed
        if (pendingMatchRef.current) {
          setSelectedMatch(pendingMatchRef.current);
          setDetailsVisible(true);
          pendingMatchRef.current = null;
        }
        // Switch to the pending tab after the ad is dismissed
        if (pendingTabRef.current) {
          setActiveTab(pendingTabRef.current);
          pendingTabRef.current = null;
        }
        // Pre-load the next interstitial ad
        interstitialAd.load();
      }
    );

    const unsubscribeError = interstitialAd.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.warn("Interstitial ad failed to load:", error);
        setInterstitialLoaded(false);
        // If ad fails, still go to main app
        if (pendingShowMainRef.current) {
          pendingShowMainRef.current = false;
          setIsOnboardingCompleted(true);
        }
        // If ad fails, open the match details directly
        if (pendingMatchRef.current) {
          setSelectedMatch(pendingMatchRef.current);
          setDetailsVisible(true);
          pendingMatchRef.current = null;
        }
        // If ad fails, still switch to the pending tab
        if (pendingTabRef.current) {
          setActiveTab(pendingTabRef.current);
          pendingTabRef.current = null;
        }
      }
    );

    // Start loading the first ad
    interstitialAd.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  // Handle navbar tab press: show interstitial ad for non-explore tabs
  const handleTabPress = (tab: TabType) => {
    if (tab === "explore") {
      // Explore tab: no ad, switch directly
      setActiveTab(tab);
      return;
    }
    // Non-explore tabs: show interstitial ad first
    pendingTabRef.current = tab;
    if (interstitialLoaded) {
      interstitialAd.show();
    } else {
      // Ad not ready, switch directly
      setActiveTab(tab);
      pendingTabRef.current = null;
    }
  };

  const getYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const today = new Date();
  const isToday =
    selectedDate.getDate() === today.getDate() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getFullYear() === today.getFullYear();

  useEffect(() => {
    if (isToday) {
      if (apiData?.fixtures) {
        setDateFixtures(apiData.fixtures);
      }
      return;
    }

    const loadFixtures = async () => {
      setLoadingFixtures(true);
      try {
        const yyyymmdd = getYYYYMMDD(selectedDate);
        const data = await fetchFixturesByDate(yyyymmdd);
        setDateFixtures(data || []);
      } catch (err) {
        console.error("Failed to load fixtures for date:", err);
      } finally {
        setLoadingFixtures(false);
      }
    };

    loadFixtures();
  }, [selectedDate, isToday, apiData?.fixtures]);

  const loadData = async (force = false) => {
    try {
      const res = await loadFootballDashboard(force);
      console.log("API DATA METRICS:", {
        liveMatchesCount: res?.data?.live?.length,
        fixturesCount: res?.data?.fixtures?.length,
        leaguesCount: res?.data?.leagues?.length,
      });
      if (res && res.data) {
        setApiData(res.data);
      }
    } catch (e) {
      console.warn("Failed to load dashboard from API, using fallback mock data.", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handlePrevDate = () => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() - 1);
    setSelectedDate(nextDate);
  };

  const handleNextDate = () => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() + 1);
    setSelectedDate(nextDate);
  };

  const toggleNotification = (matchId: string) => {
    setActiveNotifications((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };

  const formatDateString = (date: Date) => {
    const day = date.getDate();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // FORCE_REAL_API: Set to true to show real API data (even if empty), set to false to automatically fall back to mock data when API is empty
  const FORCE_REAL_API = true;

  // Process data from API or fall back to mock data
  const liveMatches =
    apiData?.live && apiData.live.length > 0
      ? apiData.live.map((m: any) => {
          const hName = m.home?.name || getMatchValue(m, ["home.name", "homeTeam.name", "teams.home.name"]) || "TBD";
          const hShort = m.home?.short || getMatchValue(m, ["home.shortName", "home.code", "homeTeam.code"]);
          const hShortStr = hShort && hShort !== "TBD" ? hShort : hName.substring(0, 3).toUpperCase();

          const aName = m.away?.name || getMatchValue(m, ["away.name", "awayTeam.name", "teams.away.name"]) || "TBD";
          const aShort = m.away?.short || getMatchValue(m, ["away.shortName", "away.code", "awayTeam.code"]);
          const aShortStr = aShort && aShort !== "TBD" ? aShort : aName.substring(0, 3).toUpperCase();

          return {
            id: getMatchEventId(m) || Math.random().toString(),
            league: m.league || getMatchLeague(m),
            leagueId: getMatchLeagueId(m),
            home: {
              id: m.home?.id || getMatchValue(m, ["home.id", "homeTeam.id", "teams.home.id"]),
              name: hName,
              short: hShortStr,
              logo: m.home?.logo || getTeamLogo(m, "home"),
            },
            away: {
              id: m.away?.id || getMatchValue(m, ["away.id", "awayTeam.id", "teams.away.id"]),
              name: aName,
              short: aShortStr,
              logo: m.away?.logo || getTeamLogo(m, "away"),
            },
            score: m.score || getMatchScore(m).display,
            minute: m.minute || getMatchStatus(m),
            status: "Live",
          };
        })
      : MOCK_LIVE_MATCHES.map(m => ({ ...m, leagueId: m.id.includes("mls") ? "130" : "87" }));

  const leaguesList =
    dateFixtures && dateFixtures.length > 0
      ? [
          {
            leagueId: "popular",
            leagueName: isToday ? "Today's Matches" : `Matches on ${formatDateString(selectedDate)}`,
            leagueLogo: "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png",
            matches: dateFixtures.map((m: any) => {
              const hName = getMatchValue(m, ["home.name", "homeTeam.name"]) || "TBD";
              const hShort = getMatchValue(m, ["home.shortName", "home.code", "homeTeam.code"]);
              const hShortStr = hShort && hShort !== "TBD" ? hShort : hName.substring(0, 3).toUpperCase();

              const aName = getMatchValue(m, ["away.name", "awayTeam.name"]) || "TBD";
              const aShort = getMatchValue(m, ["away.shortName", "away.code", "awayTeam.code"]);
              const aShortStr = aShort && aShort !== "TBD" ? aShort : aName.substring(0, 3).toUpperCase();

              return {
                id: getMatchEventId(m) || Math.random().toString(),
                status: getMatchStatus(m) === "Live" ? "Live" : "NS",
                time: getMatchValue(m, ["time", "status.time", "date"]) || "19:00",
                date: formatDateString(selectedDate),
                leagueId: getMatchLeagueId(m),
                home: {
                  id: m.home?.id || getMatchValue(m, ["home.id", "homeTeam.id", "teams.home.id"]),
                  name: hName,
                  short: hShortStr,
                  logo: getTeamLogo(m, "home"),
                },
                away: {
                  id: m.away?.id || getMatchValue(m, ["away.id", "awayTeam.id", "teams.away.id"]),
                  name: aName,
                  short: aShortStr,
                  logo: getTeamLogo(m, "away"),
                },
              };
            }),
          },
        ]
      : MOCK_LEAGUES.map(l => ({
          ...l,
          matches: l.matches.map(m => ({ ...m, leagueId: "47" }))
        }));

  // Local getMatchValue helper is now removed in favor of imported getMatchValue from footballApi.ts

  const filteredLiveMatches = searchQuery
    ? liveMatches.filter((m: any) =>
        m.home.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.away.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.league.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : liveMatches;

  const filteredLeaguesList = searchQuery
    ? leaguesList
        .map((league: any) => {
          const filteredMatches = league.matches.filter((m: any) =>
            m.home.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.away.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
          return { ...league, matches: filteredMatches };
        })
        .filter((league: any) => league.matches.length > 0)
    : leaguesList;

  // View Components depending on Active Bottom Tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "leagues":
        return <LeaguesView apiLeagues={apiData?.leagues} />;
      case "highlight":
        return <HighlightView />;
      case "teams":
        return <TeamsView />;
      case "prediction":
        return <PredictionView />;
      default:
        return (
          <ExploreView
            refreshing={refreshing}
            onRefresh={handleRefresh}
            liveMatches={filteredLiveMatches}
            leaguesList={filteredLeaguesList}
            activeNotifications={activeNotifications}
            onToggleNotification={toggleNotification}
            width={width}
            onPressDetails={(match: any) => {
              pendingMatchRef.current = match;
              if (interstitialLoaded) {
                // Show interstitial ad; modal opens after ad is dismissed (via CLOSED event)
                interstitialAd.show();
              } else {
                // Ad not ready yet, open modal directly
                setSelectedMatch(match);
                setDetailsVisible(true);
                pendingMatchRef.current = null;
              }
            }}
          />
        );
    }
  };
  if (!isOnboardingCompleted) {
    return (
      <SplashScreen
        onComplete={() => {
          // Show interstitial ad after SplashScreen, then go to main app
          pendingShowMainRef.current = true;
          if (interstitialLoaded) {
            interstitialAd.show();
          } else {
            // Ad not ready, go directly to main app
            setIsOnboardingCompleted(true);
          }
        }}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
      <StatusBar style="light" />

      {/* Modular Header */}
      {activeTab === "explore" && (
        <Header
          selectedDate={selectedDate}
          onPrevDate={handlePrevDate}
          onNextDate={handleNextDate}
          onRefresh={handleRefresh}
          showDateSelector={true}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
      )}

      {/* Dynamic Main Body Content */}
      {renderTabContent()}

      {/* Full-Screen Bouncing Football Loading Overlay */}
      <LoadingModal visible={loading} />

      {/* Match Details Modal */}
      <MatchDetailsModal
        visible={detailsVisible}
        match={selectedMatch}
        onClose={() => setDetailsVisible(false)}
      />
      {/* Bottom Navigation Tab Bar & Banner Ad */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#0D0E0F" }}>
        <BannerAdComponent />
        <BottomNavBar activeTab={activeTab} setActiveTab={handleTabPress} />
      </View>
    </SafeAreaView>
  );
}
