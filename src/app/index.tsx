import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Dimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    fetchFixturesByDate,
    getMatchEventId,
    getMatchLeague,
    getMatchLeagueId,
    getMatchScore,
    getMatchStatus,
    getMatchValue,
    getTeamLogo,
    loadFootballDashboard,
} from "../services/footballApi";

// Component imports for tabs
import {
    AdEventType,
    InterstitialAd,
    TestIds,
} from "react-native-google-mobile-ads";
import BannerAdComponent from "../components/ads/BannerAdComponent";
import BottomNavBar, { TabType } from "../components/bottom/BottomNavBar";
import MatchDetailsModal from "../components/details/MatchDetailsModal";
import ExploreView from "../components/explore/ExploreView";
import Header from "../components/explore/Header";
import HighlightView from "../components/highlight/HighlightView";
import LeaguesView from "../components/leagues/LeaguesView";
import LoadingModal from "../components/loading/LoadingModal";
import PredictionView from "../components/prediction/PredictionView";
import SplashScreen from "../components/SplashScreen/SplashScreen";
import TeamsView from "../components/teams/TeamsView";

const { width } = Dimensions.get("window");

// Interstitial Ad Unit ID (TestIds.INTERSTITIAL for dev, real ID for production)
const interstitialAdUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : "ca-app-pub-9215418195647603/7486528721"; // Real AdMob Interstitial Ad Unit ID

const interstitialAd = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

// Mock Data matching screenshot exactly as fallbacks
const MOCK_LIVE_MATCHES = [
  {
    id: "live-mls-1",
    league: "MLS",
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/130.png",
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
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/87.png",
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
    leagueLogo:
      "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png",
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
  // Lazy mount: track which tabs have been visited (mounted) at least once
  // Once mounted, stays mounted forever for instant switching
  const [mountedTabs, setMountedTabs] = useState<Set<TabType>>(new Set(["explore"]));
  const [activeNotifications, setActiveNotifications] = useState<{
    [key: string]: boolean;
  }>({
    "epl-1": true,
  });
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [dateFixtures, setDateFixtures] = useState<any[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOnboardingCompleted, setIsOnboardingCompleted] =
    useState<boolean>(false);
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
      },
    );

    const unsubscribeClosed = interstitialAd.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log("Interstitial ad closed");
        setInterstitialLoaded(false);

        // Check if this ad was shown from SplashScreen transition
        const comingFromSplash = pendingShowMainRef.current;
        if (comingFromSplash) {
          // Clear ALL pending refs - do NOT switch tab or open match after splash ad
          pendingShowMainRef.current = false;
          pendingMatchRef.current = null;
          pendingTabRef.current = null;
          setIsOnboardingCompleted(true);
          interstitialAd.load();
          return;
        }

        // Capture refs before clearing
        const pendingMatch = pendingMatchRef.current;
        const pendingTab = pendingTabRef.current;
        pendingMatchRef.current = null;
        pendingTabRef.current = null;

        // Use a 0ms timeout so tab switch happens after native ad dismiss animation
        // This prevents the UI freeze without adding any visible delay
        setTimeout(() => {
          if (pendingMatch) {
            setSelectedMatch(pendingMatch);
            setDetailsVisible(true);
          }
          if (pendingTab) {
            setActiveTab(pendingTab);
          }
        }, 0);

        // Pre-load the next interstitial ad
        interstitialAd.load();
      },
    );

    const unsubscribeError = interstitialAd.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.warn("Interstitial ad failed to load:", error);
        setInterstitialLoaded(false);
        // If ad fails, still go to main app
        if (pendingShowMainRef.current) {
          pendingShowMainRef.current = false;
          pendingMatchRef.current = null;
          pendingTabRef.current = null;
          setIsOnboardingCompleted(true);
          return;
        }
        // If ad fails, open the match details or switch tab directly
        const pendingMatch = pendingMatchRef.current;
        const pendingTab = pendingTabRef.current;
        pendingMatchRef.current = null;
        pendingTabRef.current = null;
        if (pendingMatch) {
          setSelectedMatch(pendingMatch);
          setDetailsVisible(true);
        }
        if (pendingTab) {
          setActiveTab(pendingTab);
        }
      },
    );

    // Start loading the first ad
    interstitialAd.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  // Handle navbar tab press: instant switch, no ads on tab navigation
  const handleTabPress = (tab: TabType) => {
    // Lazy mount: first time visiting this tab, mount it
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    // Switch instantly, no interstitial ad
    setActiveTab(tab);
  };

  const getYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
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
        teamsCount: res?.data?.teams?.length,
      });
      if (res && res.data) {
        setApiData(res.data);
      }
    } catch (e) {
      console.warn(
        "Failed to load dashboard from API, using fallback mock data.",
        e,
      );
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
  // Process data from API or fall back to mock data (useMemo + slice to prevent UI thread lag)
  const liveMatches = React.useMemo(() => {
    if (!apiData?.live || apiData.live.length === 0) {
      return MOCK_LIVE_MATCHES.map((m) => ({
        ...m,
        leagueId: m.id.includes("mls") ? "130" : "87",
      }));
    }

    // Limit to top 25 live matches to prevent UI freezing
    return apiData.live.slice(0, 25).map((m: any) => {
      const hName =
        m.home?.name ||
        getMatchValue(m, [
          "home.name",
          "homeTeam.name",
          "teams.home.name",
        ]) ||
        "TBD";
      const hShort =
        m.home?.short ||
        getMatchValue(m, ["home.shortName", "home.code", "homeTeam.code"]);
      const hShortStr =
        hShort && hShort !== "TBD"
          ? hShort
          : hName.substring(0, 3).toUpperCase();

      const aName =
        m.away?.name ||
        getMatchValue(m, [
          "away.name",
          "awayTeam.name",
          "teams.away.name",
        ]) ||
        "TBD";
      const aShort =
        m.away?.short ||
        getMatchValue(m, ["away.shortName", "away.code", "awayTeam.code"]);
      const aShortStr =
        aShort && aShort !== "TBD"
          ? aShort
          : aName.substring(0, 3).toUpperCase();

      return {
        id: getMatchEventId(m) || Math.random().toString(),
        league: m.league || getMatchLeague(m),
        leagueId: getMatchLeagueId(m),
        home: {
          id:
            m.home?.id ||
            getMatchValue(m, ["home.id", "homeTeam.id", "teams.home.id"]),
          name: hName,
          short: hShortStr,
          logo: m.home?.logo || getTeamLogo(m, "home"),
        },
        away: {
          id:
            m.away?.id ||
            getMatchValue(m, ["away.id", "awayTeam.id", "teams.away.id"]),
          name: aName,
          short: aShortStr,
          logo: m.away?.logo || getTeamLogo(m, "away"),
        },
        score: m.score || getMatchScore(m).display,
        minute: m.minute || getMatchStatus(m),
        status: "Live",
      };
    });
  }, [apiData?.live]);

  const leaguesList = React.useMemo(() => {
    if (!dateFixtures || dateFixtures.length === 0) {
      return MOCK_LEAGUES.map((l) => ({
        ...l,
        matches: l.matches.map((m) => ({ ...m, leagueId: "47" })),
      }));
    }

    // Limit to top 50 matches so ScrollView doesn't lag/freeze
    return [
      {
        leagueId: "popular",
        leagueName: isToday
          ? "Today's Matches"
          : `Matches on ${formatDateString(selectedDate)}`,
        leagueLogo:
          "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png",
        matches: dateFixtures.slice(0, 50).map((m: any) => {
          const hName =
            getMatchValue(m, ["home.name", "homeTeam.name"]) || "TBD";
          const hShort = getMatchValue(m, [
            "home.shortName",
            "home.code",
            "homeTeam.code",
          ]);
          const hShortStr =
            hShort && hShort !== "TBD"
              ? hShort
              : hName.substring(0, 3).toUpperCase();

          const aName =
            getMatchValue(m, ["away.name", "awayTeam.name"]) || "TBD";
          const aShort = getMatchValue(m, [
            "away.shortName",
            "away.code",
            "awayTeam.code",
          ]);
          const aShortStr =
            aShort && aShort !== "TBD"
              ? aShort
              : aName.substring(0, 3).toUpperCase();

          const matchStatus = m.status || (getMatchStatus(m) === "Live" ? "Live" : "NS");
          const matchScore = m.score || getMatchScore(m).display || "VS";
          const matchMinute = m.minute || (matchStatus === "FT" ? "FT" : matchStatus === "NS" ? "NS" : "Live");

          return {
            id: getMatchEventId(m) || Math.random().toString(),
            status: matchStatus,
            score: matchScore,
            minute: matchMinute,
            time:
              getMatchValue(m, ["time", "status.time", "date"]) || "19:00",
            date: formatDateString(selectedDate),
            leagueId: getMatchLeagueId(m),
            league: m.league || "Match",
            home: {
              id:
                m.home?.id ||
                getMatchValue(m, [
                  "home.id",
                  "homeTeam.id",
                  "teams.home.id",
                ]),
              name: hName,
              short: hShortStr,
              logo: getTeamLogo(m, "home"),
            },
            away: {
              id:
                m.away?.id ||
                getMatchValue(m, [
                  "away.id",
                  "awayTeam.id",
                  "teams.away.id",
                ]),
              name: aName,
              short: aShortStr,
              logo: getTeamLogo(m, "away"),
            },
          };
        }),
      },
    ];
  }, [dateFixtures, isToday, selectedDate]);

  const filteredLiveMatches = React.useMemo(() => {
    if (!searchQuery) return liveMatches;
    const q = searchQuery.toLowerCase();
    return liveMatches.filter(
      (m: any) =>
        m.home.name.toLowerCase().includes(q) ||
        m.away.name.toLowerCase().includes(q) ||
        m.league.toLowerCase().includes(q),
    );
  }, [searchQuery, liveMatches]);

  const filteredLeaguesList = React.useMemo(() => {
    if (!searchQuery) return leaguesList;
    const q = searchQuery.toLowerCase();
    return leaguesList
      .map((league: any) => {
        const filteredMatches = league.matches.filter(
          (m: any) =>
            m.home.name.toLowerCase().includes(q) ||
            m.away.name.toLowerCase().includes(q),
        );
        return { ...league, matches: filteredMatches };
      })
      .filter((league: any) => league.matches.length > 0);
  }, [searchQuery, leaguesList]);

  if (!isOnboardingCompleted) {
    return (
      <SplashScreen
        onComplete={() => {
          // Clear all pending refs to prevent any stale tab switch or match open
          pendingMatchRef.current = null;
          pendingTabRef.current = null;

          if (interstitialLoaded) {
            // Mark that we're transitioning from splash
            // The CLOSED event will call setIsOnboardingCompleted(true)
            pendingShowMainRef.current = true;
            try {
              interstitialAd.show();
            } catch (err) {
              console.warn("Failed to show interstitial ad:", err);
              // Ad failed to show, go directly to main app
              pendingShowMainRef.current = false;
              setIsOnboardingCompleted(true);
            }
          } else {
            // No ad loaded, go directly to main app
            setIsOnboardingCompleted(true);
          }
        }}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
      <StatusBar style="light" />

      {/* Top Banner Ad */}
      <View
        style={{
          width: "100%",
          alignItems: "center",
          backgroundColor: "#0D0E0F",
          paddingVertical: 2,
        }}
      >
        <BannerAdComponent />
      </View>

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

      {/* Dynamic Main Body Content: Lazy-mount + persistent tabs for instant navigation */}
      {/* Explore: Always mounted (default tab) */}
      <View style={{ flex: 1, display: activeTab === "explore" ? "flex" : "none" }}>
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
      </View>

      {/* Leagues: Lazy mount on first visit, then persist */}
      {mountedTabs.has("leagues") && (
        <View style={{ flex: 1, display: activeTab === "leagues" ? "flex" : "none" }}>
          <LeaguesView apiLeagues={apiData?.leagues} />
        </View>
      )}

      {/* Highlight: Lazy mount on first visit, then persist */}
      {mountedTabs.has("highlight") && (
        <View style={{ flex: 1, display: activeTab === "highlight" ? "flex" : "none" }}>
          <HighlightView />
        </View>
      )}

      {/* Teams: Lazy mount on first visit, then persist */}
      {mountedTabs.has("teams") && (
        <View style={{ flex: 1, display: activeTab === "teams" ? "flex" : "none" }}>
          <TeamsView apiTeams={apiData?.teams} apiLeagues={apiData?.leagues} />
        </View>
      )}

      {/* Prediction: Lazy mount on first visit, then persist */}
      {mountedTabs.has("prediction") && (
        <View style={{ flex: 1, display: activeTab === "prediction" ? "flex" : "none" }}>
          <PredictionView initialFixtures={apiData?.fixtures} />
        </View>
      )}

      {/* Full-Screen Bouncing Football Loading Overlay - Only on fresh boot without any cache */}
      <LoadingModal visible={loading && !apiData} />

      {/* Match Details Modal */}
      <MatchDetailsModal
        visible={detailsVisible}
        match={selectedMatch}
        onClose={() => setDetailsVisible(false)}
      />
      {/* Bottom Navigation Tab Bar & Banner Ad */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#0D0E0F",
        }}
      >
        <BannerAdComponent />
        <BottomNavBar activeTab={activeTab} setActiveTab={handleTabPress} />
      </View>
    </SafeAreaView>
  );
}
