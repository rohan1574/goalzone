import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Dimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    fetchFixturesByDate,
    fetchLiveMatches,
    prefetchAdjacentDates,
    formatLocalMatchTime,
    getMatchLocalDateStr,
    getMatchEventId,
    getMatchLeague,
    getMatchLeagueId,
    getMatchScore,
    getMatchStatus,
    getMatchValue,
    getTeamLogo,
    loadFootballDashboard,
    getFromMemoryCache,
    getAllCachedFixtures,
    warmupFixturesCache,
} from "../services/footballApi";

import * as Notifications from "expo-notifications";

// Configure local notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
  : "ca-app-pub-9215418195647603/4397391991"; // Real AdMob Interstitial Ad Unit ID

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

const extractTeamName = (obj: any): string => {
  if (typeof obj === "string" && obj.trim().length > 0) return obj.trim();
  if (obj && typeof obj === "object") {
    if (typeof obj.name === "string" && obj.name.trim().length > 0) return obj.name.trim();
    if (typeof obj.title === "string" && obj.title.trim().length > 0) return obj.title.trim();
    if (typeof obj.shortName === "string" && obj.shortName.trim().length > 0) return obj.shortName.trim();
  }
  return "";
};

const getHomeTeamName = (m: any): string => {
  const name1 = extractTeamName(m?.home || m?.homeTeam || m?.teams?.home);
  if (name1) return name1;

  const explicit = getMatchValue(
    m,
    [
      "homeName",
      "home_name",
      "homeTeamName",
      "home_team_name",
      "home.name",
      "homeTeam.name",
      "teams.home.name",
      "home.title",
      "homeTeam.title",
      "home.shortName",
    ],
    ""
  );
  if (explicit && explicit !== "TBD") return explicit;
  return "TBD";
};

const getAwayTeamName = (m: any): string => {
  const name1 = extractTeamName(m?.away || m?.awayTeam || m?.teams?.away);
  if (name1) return name1;

  const explicit = getMatchValue(
    m,
    [
      "awayName",
      "away_name",
      "awayTeamName",
      "away_team_name",
      "away.name",
      "awayTeam.name",
      "teams.away.name",
      "away.title",
      "awayTeam.title",
      "away.shortName",
    ],
    ""
  );
  if (explicit && explicit !== "TBD") return explicit;
  return "TBD";
};

export default function ExploreScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<TabType>("explore");
  // Pre-mount all tabs so switching between tabs is 100% instant from the first tap
  const [mountedTabs, setMountedTabs] = useState<Set<TabType>>(
    new Set(["explore", "leagues", "highlight", "teams", "prediction"])
  );
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 60);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  const [isOnboardingCompleted, setIsOnboardingCompleted] =
    useState<boolean>(false);
  const interstitialLoadedRef = React.useRef(false);
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
        interstitialLoadedRef.current = true;
      },
    );

    const unsubscribeClosed = interstitialAd.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log("Interstitial ad closed");
        interstitialLoadedRef.current = false;

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
        interstitialLoadedRef.current = false;
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
  const handleTabPress = React.useCallback((tab: TabType) => {
    // Lazy mount: first time visiting this tab, mount it
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    // Switch instantly, no interstitial ad
    setActiveTab(tab);
  }, []);

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
    const yyyymmdd = getYYYYMMDD(selectedDate);
    const MEM_KEY = `@goalzone_mem_fixtures_${yyyymmdd}`;
    const cachedMem = getFromMemoryCache(MEM_KEY);

    if (cachedMem) {
      // Instant 0ms response from memory cache — no spinner, zero flicker
      setDateFixtures(cachedMem);
      setLoadingFixtures(false);
      prefetchAdjacentDates(selectedDate);
      return;
    }

    if (isToday && apiData?.fixtures && apiData.fixtures.length > 0) {
      setDateFixtures(apiData.fixtures);
      setLoadingFixtures(false);
      prefetchAdjacentDates(selectedDate);
      return;
    }

    // Uncached date: clear previous matches immediately so old matches don't linger
    setDateFixtures([]);
    setLoadingFixtures(true);

    const loadFixtures = async () => {
      try {
        const data = await fetchFixturesByDate(yyyymmdd);
        setDateFixtures(data || []);
      } catch (err) {
        console.error("Failed to load fixtures for date:", err);
      } finally {
        setLoadingFixtures(false);
      }
    };

    loadFixtures();
    prefetchAdjacentDates(selectedDate);
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
        prefetchAdjacentDates(new Date());
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
    warmupFixturesCache().then(() => {
      prefetchAdjacentDates(new Date());
    });
    loadData(false);
  }, []);

  // Real-time live score auto-update without manual refresh (polls every 15s silently)
  useEffect(() => {
    const livePollInterval = setInterval(async () => {
      try {
        const freshLive = await fetchLiveMatches();
        if (freshLive && Array.isArray(freshLive) && freshLive.length > 0) {
          // 1. Update dashboard live matches silently
          setApiData((prev: any) => (prev ? { ...prev, live: freshLive } : prev));

          // 2. If a match is currently open in MatchDetailsModal, update its score & minute
          setSelectedMatch((prevSelected: any) => {
            if (!prevSelected) return null;
            const updated = freshLive.find(
              (m: any) => String(getMatchEventId(m) || m.id) === String(prevSelected.id)
            );
            if (updated) {
              return {
                ...prevSelected,
                score: updated.score || getMatchScore(updated).display || prevSelected.score,
                minute: updated.minute || getMatchStatus(updated) || prevSelected.minute,
                status: updated.status || prevSelected.status,
              };
            }
            return prevSelected;
          });

          // 3. Update matching live fixtures in dateFixtures list
          setDateFixtures((prevFixtures: any[]) => {
            if (!prevFixtures || prevFixtures.length === 0) return prevFixtures;
            let hasChanged = false;
            const next = prevFixtures.map((m: any) => {
              const mId = String(getMatchEventId(m) || m.id);
              const liveMatch = freshLive.find(
                (lm: any) => String(getMatchEventId(lm) || lm.id) === mId
              );
              if (liveMatch) {
                const newScore = liveMatch.score || getMatchScore(liveMatch).display || m.score;
                const newMinute = liveMatch.minute || getMatchStatus(liveMatch) || m.minute;
                if (m.score !== newScore || m.minute !== newMinute) {
                  hasChanged = true;
                  return {
                    ...m,
                    score: newScore,
                    minute: newMinute,
                    status: "Live",
                  };
                }
              }
              return m;
            });
            return hasChanged ? next : prevFixtures;
          });
        }
      } catch (err) {
        // Silent background fail
      }
    }, 15000);

    return () => clearInterval(livePollInterval);
  }, []);

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, []);

  const handlePrevDate = React.useCallback(() => {
    setSelectedDate((prevDate) => {
      const nextDate = new Date(prevDate);
      nextDate.setDate(prevDate.getDate() - 1);
      return nextDate;
    });
  }, []);

  const handleNextDate = React.useCallback(() => {
    setSelectedDate((prevDate) => {
      const nextDate = new Date(prevDate);
      nextDate.setDate(prevDate.getDate() + 1);
      return nextDate;
    });
  }, []);

  const toggleNotification = React.useCallback(
    (matchId: string, matchName?: string) => {
      setActiveNotifications((prev) => {
        const isCurrentlyActive = !!prev[matchId];
        const nextState = !isCurrentlyActive;

        if (nextState) {
          Notifications.requestPermissionsAsync()
            .then(({ status }) => {
              if (status === "granted") {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: "🔔 Match Notification Enabled",
                    body: matchName
                      ? `Alerts enabled for ${matchName}`
                      : "You will receive notifications for this match.",
                    sound: true,
                  },
                  trigger: null,
                }).catch(() => {});
              }
            })
            .catch(() => {});
        }

        return {
          ...prev,
          [matchId]: nextState,
        };
      });
    },
    [],
  );

  const handlePressDetails = React.useCallback((match: any) => {
    pendingMatchRef.current = match;
    if (interstitialLoadedRef.current) {
      interstitialAd.show();
    } else {
      setSelectedMatch(match);
      setDetailsVisible(true);
      pendingMatchRef.current = null;
    }
  }, []);

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
      return [];
    }

    // Limit to top 25 live matches to prevent UI freezing
    return apiData.live.slice(0, 25).map((m: any, idx: number) => {
      const hName = getHomeTeamName(m);
      const hShort =
        m.home?.short ||
        getMatchValue(m, ["home.shortName", "home.code", "homeTeam.code"]);
      const hShortStr =
        hShort && hShort !== "TBD"
          ? hShort
          : hName.substring(0, 3).toUpperCase();

      const aName = getAwayTeamName(m);
      const aShort =
        m.away?.short ||
        getMatchValue(m, ["away.shortName", "away.code", "awayTeam.code"]);
      const aShortStr =
        aShort && aShort !== "TBD"
          ? aShort
          : aName.substring(0, 3).toUpperCase();

      return {
        id: getMatchEventId(m) || `${hName}-${aName}-${idx}`,
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
      return [];
    }

    // Group dateFixtures by league name / id
    const groupedMap = new Map<
      string,
      {
        leagueId: string;
        leagueName: string;
        leagueLogo: string;
        matches: any[];
      }
    >();

    const defaultDateStr = getMatchLocalDateStr(null, selectedDate);

    dateFixtures.forEach((m: any, idx: number) => {
      const lName =
        m.league ||
        m.leagueName ||
        m.league?.name ||
        m.competition?.name ||
        "Other League";
      const lId = String(
        m.leagueId ||
          m.league?.id ||
          m.competition?.id ||
          lName,
      );
      const lLogo =
        m.leagueLogo ||
        m.league?.logo ||
        m.league?.image ||
        "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png";

      const hObj = m.home || m.homeTeam || m.teams?.home || {};
      const aObj = m.away || m.awayTeam || m.teams?.away || {};

      const hName = getHomeTeamName(m);
      const aName = getAwayTeamName(m);

      const hShortStr = (hObj.shortName || hObj.code || hName.substring(0, 3)).toUpperCase();
      const aShortStr = (aObj.shortName || aObj.code || aName.substring(0, 3)).toUpperCase();

      const hLogo = hObj.logo || hObj.image || (hObj.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${hObj.id}.png` : "");
      const aLogo = aObj.logo || aObj.image || (aObj.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${aObj.id}.png` : "");

      const matchStatus =
        m.status || (m.minute === "Live" || m.statusType === "live" ? "Live" : "NS");
      const matchScore = m.score || (m.homeScore !== undefined && m.awayScore !== undefined ? `${m.homeScore} - ${m.awayScore}` : "VS");
      const matchMinute = m.minute || (matchStatus === "FT" ? "FT" : matchStatus === "NS" ? "NS" : "Live");

      const matchItem = {
        id: getMatchEventId(m) || `${lId}-${hName}-${aName}-${idx}`,
        status: matchStatus,
        score: matchScore,
        minute: matchMinute,
        time: formatLocalMatchTime(m),
        date: defaultDateStr,
        rawDate: m.rawDate || m.date || m.fixture?.date,
        timestamp: m.timestamp || m.fixture?.timestamp,
        leagueId: lId,
        league: lName,
        home: {
          id: hObj.id || "",
          name: hName,
          short: hShortStr,
          logo: hLogo,
        },
        away: {
          id: aObj.id || "",
          name: aName,
          short: aShortStr,
          logo: aLogo,
        },
      };

      if (!groupedMap.has(lId)) {
        groupedMap.set(lId, {
          leagueId: lId,
          leagueName: lName,
          leagueLogo: lLogo,
          matches: [],
        });
      }
      groupedMap.get(lId)!.matches.push(matchItem);
    });

    const result = Array.from(groupedMap.values());

    // Priority ordering for major leagues so top leagues appear first
    const PRIORITY_LEAGUES = [
      "Premier League",
      "La Liga",
      "Serie A",
      "Bundesliga",
      "Ligue 1",
      "Brasileirão Série A",
      "Serie A - Betano",
      "Saudi Pro League",
      "Major League Soccer",
      "MLS",
      "UEFA Champions League",
      "UEFA Europa League",
      "Liga Profesional",
      "Eredivisie",
      "Primeira Liga",
    ];

    result.sort((a, b) => {
      const idxA = PRIORITY_LEAGUES.findIndex((name) =>
        a.leagueName.toLowerCase().includes(name.toLowerCase()),
      );
      const idxB = PRIORITY_LEAGUES.findIndex((name) =>
        b.leagueName.toLowerCase().includes(name.toLowerCase()),
      );

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.leagueName.localeCompare(b.leagueName);
    });

    return result;
  }, [dateFixtures, isToday, selectedDate]);

  const filteredLiveMatches = React.useMemo(() => {
    if (!debouncedSearchQuery || !debouncedSearchQuery.trim()) return liveMatches;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return liveMatches
      .filter((m: any) => {
        const hName = (m.home?.name || "").toLowerCase();
        const hShort = (m.home?.short || "").toLowerCase();
        const aName = (m.away?.name || "").toLowerCase();
        const aShort = (m.away?.short || "").toLowerCase();
        const lName = (m.league || "").toLowerCase();
        return (
          hName.includes(q) ||
          hShort.includes(q) ||
          aName.includes(q) ||
          aShort.includes(q) ||
          lName.includes(q)
        );
      })
      .sort((a: any, b: any) => {
        const aExact =
          (a.home?.name || "").toLowerCase() === q ||
          (a.away?.name || "").toLowerCase() === q ||
          (a.home?.short || "").toLowerCase() === q ||
          (a.away?.short || "").toLowerCase() === q;
        const bExact =
          (b.home?.name || "").toLowerCase() === q ||
          (b.away?.name || "").toLowerCase() === q ||
          (b.home?.short || "").toLowerCase() === q ||
          (b.away?.short || "").toLowerCase() === q;

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });
  }, [debouncedSearchQuery, liveMatches]);

  const filteredLeaguesList = React.useMemo(() => {
    if (!debouncedSearchQuery || !debouncedSearchQuery.trim()) return leaguesList;
    const q = debouncedSearchQuery.toLowerCase().trim();

    try {
      const matchedGroups: any[] = [];
      // Strictly limit search to the 15 leagues of the selected date ONLY
      const activeDate15Leagues = leaguesList.slice(0, 15);

      activeDate15Leagues.forEach((group: any) => {
        if (!group || !group.matches) return;
        const lName = (group.leagueName || "").toLowerCase();
        const lMatch = lName.includes(q);

        const matchingMatches = group.matches.filter((m: any) => {
          if (!m) return false;
          const hName = (m.home?.name || "").toLowerCase();
          const aName = (m.away?.name || "").toLowerCase();
          const hShort = (m.home?.short || "").toLowerCase();
          const aShort = (m.away?.short || "").toLowerCase();

          return lMatch || hName.includes(q) || aName.includes(q) || hShort.includes(q) || aShort.includes(q);
        });

        if (matchingMatches.length > 0) {
          // Score league relevance so exact team matches jump to the top
          let score = 10;
          matchingMatches.forEach((m: any) => {
            const hName = (m.home?.name || "").toLowerCase();
            const aName = (m.away?.name || "").toLowerCase();
            if (hName === q || aName === q) score = 100;
            else if (hName.startsWith(q) || aName.startsWith(q)) score = Math.max(score, 70);
          });

          matchedGroups.push({
            league: {
              ...group,
              matches: matchingMatches,
            },
            score,
          });
        }
      });

      matchedGroups.sort((a, b) => b.score - a.score);
      return matchedGroups.map((g) => g.league);
    } catch (err) {
      console.warn("Search filter error:", err);
      return leaguesList;
    }
  }, [debouncedSearchQuery, leaguesList]);

  if (!isOnboardingCompleted) {
    return (
      <SplashScreen
        onComplete={() => {
          // Clear all pending refs to prevent any stale tab switch or match open
          pendingMatchRef.current = null;
          pendingTabRef.current = null;

          if (interstitialLoadedRef.current) {
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
          loadingFixtures={loadingFixtures}
          onPressDetails={handlePressDetails}
          searchQuery={searchQuery}
        />
      </View>

      {/* Leagues: Lazy mount on first visit, then persist */}
      {mountedTabs.has("leagues") && (
        <View style={{ flex: 1, display: activeTab === "leagues" ? "flex" : "none" }}>
          <LeaguesView
            apiLeagues={apiData?.leagues}
            onPressDetails={handlePressDetails}
          />
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
