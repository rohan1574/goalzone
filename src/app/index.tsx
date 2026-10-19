import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Dimensions, View, Platform } from "react-native";
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
    warmupFixturesCache,
    toggleServerMatchNotification,
} from "../services/footballApi";
import {
    findMatchForNotification,
    getNotificationTarget,
    type MatchDetailsTab,
} from "../services/notificationRouting";

import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HAS_SEEN_SPLASH_KEY = "hasSeenOnboarding";

// Configure local notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Setup Android Notification Channels
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("goal_alerts", {
    name: "Goal Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#02DB54",
  }).catch(() => {});

  Notifications.setNotificationChannelAsync("match_alerts", {
    name: "Match Alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#02DB54",
  }).catch(() => {});
}

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
  // Mount tabs on-demand (lazy mounting) so background tabs don't fire API requests at launch
  const [mountedTabs, setMountedTabs] = useState<Set<TabType>>(
    new Set(["explore"])
  );
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  // A new object per notification tap, so the same tab can be requested again
  const [detailsTabRequest, setDetailsTabRequest] = useState<{ tab: MatchDetailsTab } | null>(null);
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
  const [isSplashCheckDone, setIsSplashCheckDone] = useState<boolean>(false);
  const [shouldShowSplash, setShouldShowSplash] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(HAS_SEEN_SPLASH_KEY)
      .then((val) => {
        if (val === "true") {
          setShouldShowSplash(false);
        } else {
          setShouldShowSplash(true);
        }
        setIsSplashCheckDone(true);
      })
      .catch(() => {
        setShouldShowSplash(false);
        setIsSplashCheckDone(true);
      });
  }, []);
  const interstitialLoadedRef = React.useRef(false);
  const pendingMatchRef = React.useRef<any>(null);
  const pendingTabRef = React.useRef<TabType | null>(null);

  // Load interstitial ad safely in background after app has mounted
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

        // Capture refs before clearing
        const pendingMatch = pendingMatchRef.current;
        const pendingTab = pendingTabRef.current;
        pendingMatchRef.current = null;
        pendingTabRef.current = null;

        // Use a 0ms timeout so tab switch happens after native ad dismiss animation
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

    // Delay initial ad request by 4s to avoid competing with startup JS hydration and UI thread
    const timer = setTimeout(() => {
      try {
        interstitialAd.load();
      } catch (err) {
        console.warn("Error loading initial interstitial ad:", err);
      }
    }, 4000);

    return () => {
      clearTimeout(timer);
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
      return;
    }

    if (isToday && apiData?.fixtures && apiData.fixtures.length > 0) {
      setDateFixtures(apiData.fixtures);
      setLoadingFixtures(false);
      return;
    }

    // Uncached date: clear previous matches immediately so old matches don't linger
    setDateFixtures([]);
    setLoadingFixtures(true);

    // When dates are tapped quickly, a slower response for an earlier date must not win
    let cancelled = false;
    const loadFixtures = async () => {
      try {
        const data = await fetchFixturesByDate(yyyymmdd);
        if (!cancelled) setDateFixtures(data || []);
      } catch (err) {
        console.error("Failed to load fixtures for date:", err);
      } finally {
        if (!cancelled) setLoadingFixtures(false);
      }
    };

    loadFixtures();
    return () => {
      cancelled = true;
    };
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
    warmupFixturesCache(); // loads existing AsyncStorage cache into memory, no API calls
    loadData(false);
  }, []);

  // Goal & kickoff push alerts: every install that allows notifications is subscribed to
  // the "popular_matches" topic (the backend sends alerts for all popular-league matches).
  // Asked once onboarding is done so the system prompt doesn't land on top of the splash.
  useEffect(() => {
    if (!isSplashCheckDone || shouldShowSplash) return;
    // The token listener also fires for the token fetched below; only subscribe each token once
    let subscribedToken: string | null = null;
    const subscribe = async (token: string) => {
      if (token === subscribedToken) return;
      subscribedToken = token;
      // Retry on the next token event / app launch if the server couldn't subscribe it
      if (!(await toggleServerMatchNotification(token, "popular", "subscribe"))) {
        subscribedToken = null;
      }
    };

    (async () => {
      try {
        let { status, canAskAgain } = await Notifications.getPermissionsAsync();
        if (status !== "granted" && canAskAgain) {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        if (status !== "granted") return;
        const tokenObj = await Notifications.getDevicePushTokenAsync();
        if (tokenObj?.data) await subscribe(String(tokenObj.data));
      } catch (err) {
        console.warn("Push notification registration failed:", err);
      }
    })();

    // FCM can rotate the device token; the new token must be subscribed again
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      if (token?.data) subscribe(String(token.data));
    });
    return () => tokenSubscription.remove();
  }, [isSplashCheckDone, shouldShowSplash]);

  // Tapping a goal / kickoff alert opens that match on the Infor tab, a lineup alert on the
  // Lineup tab (also works when the tap launched the app)
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!lastNotificationResponse) return;
    const target = getNotificationTarget(lastNotificationResponse.notification);
    Notifications.clearLastNotificationResponse();
    if (!target) return;

    (async () => {
      const match = await findMatchForNotification(target);
      if (match) {
        setSelectedMatch(match);
        setDetailsTabRequest({ tab: target.tab });
        setDetailsVisible(true);
      }
    })();
  }, [lastNotificationResponse]);

  // Real-time live score auto-update without manual refresh (polls every 15s silently)
  useEffect(() => {
    const livePollInterval = setInterval(async () => {
      try {
        const freshLive = await fetchLiveMatches();
        if (freshLive && Array.isArray(freshLive) && freshLive.length > 0) {
          // 1. Only update dashboard live matches if something actually changed
          setApiData((prev: any) => {
            if (!prev) return prev;
            const prevLive = prev.live || [];
            if (prevLive.length !== freshLive.length) {
              return { ...prev, live: freshLive };
            }
            const isDiff = freshLive.some((fl: any, i: number) => {
              const pl = prevLive[i];
              if (!pl) return true;
              return (
                fl.id !== pl.id ||
                fl.score !== pl.score ||
                fl.minute !== pl.minute ||
                fl.status !== pl.status
              );
            });
            return isDiff ? { ...prev, live: freshLive } : prev;
          });

          // 2. If a match is currently open in MatchDetailsModal, update its score & minute
          setSelectedMatch((prevSelected: any) => {
            if (!prevSelected) return null;
            const updated = freshLive.find(
              (m: any) => String(getMatchEventId(m) || m.id) === String(prevSelected.id)
            );
            if (updated) {
              const newScore = updated.score || getMatchScore(updated).display || prevSelected.score;
              const newMin = updated.minute || getMatchStatus(updated) || prevSelected.minute;
              const newSt = updated.status || prevSelected.status;
              if (
                prevSelected.score !== newScore ||
                prevSelected.minute !== newMin ||
                prevSelected.status !== newSt
              ) {
                return {
                  ...prevSelected,
                  score: newScore,
                  minute: newMin,
                  status: newSt,
                };
              }
            }
            return prevSelected;
          });

          // 3. Update matching live fixtures in dateFixtures list ONLY if changed
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

  const handleSelectDate = React.useCallback((date: Date) => {
    setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  }, []);

  const handlePressDetails = React.useCallback((match: any) => {
    setSelectedMatch(match);
    setDetailsVisible(true);
    pendingMatchRef.current = null;
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

    // Limit to top 25 live matches to prevent UI freezing (exclude finished matches)
    return apiData.live
      .filter((m: any) => {
        const ts = m.timestamp || (m.date ? Math.floor(new Date(m.date).getTime() / 1000) : null) || m.fixture?.timestamp;
        const diff = ts ? (Date.now() - ts * 1000) / 60000 : null;
        if (diff !== null && diff >= 115) return false;
        const st = String(m.status || "").toUpperCase();
        if (st === "FT" || st === "AET" || st === "PEN") return false;
        return true;
      })
      .slice(0, 25)
      .map((m: any, idx: number) => {
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

      const mTs = m.timestamp || (m.date ? Math.floor(new Date(m.date).getTime() / 1000) : undefined) || m.fixture?.timestamp;

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
        status: m.status || "Live",
        extra: m.extra ?? m.fixture?.status?.extra ?? undefined,
        timestamp: mTs,
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

      const mTimestamp = m.timestamp || (m.date ? Math.floor(new Date(m.date).getTime() / 1000) : null) || m.fixture?.timestamp;
      const minsSinceKO = mTimestamp ? (Date.now() - mTimestamp * 1000) / 60000 : null;
      const isTimeExpired = minsSinceKO !== null && minsSinceKO >= 115;

      const mStatusUpper = String(m.status || "").trim().toUpperCase();
      const mMinuteUpper = String(m.minute || "").trim().toUpperCase();

      const bracketMatch = mMinuteUpper.match(/[\(\[]\+?(\d+)[\)\]]/);
      const bracketExtra = bracketMatch ? parseInt(bracketMatch[1], 10) : null;
      const propExtra = m.extra != null ? parseInt(String(m.extra), 10) : null;
      const plusMatch = mMinuteUpper.match(/\+(\d+)/);
      const plusExtra = plusMatch ? parseInt(plusMatch[1], 10) : null;
      const targetExtra = bracketExtra || propExtra || plusExtra;
      const elapsedExtra = plusExtra || 0;

      const isExtraComplete = Boolean(
        targetExtra &&
        elapsedExtra >= targetExtra &&
        (mStatusUpper === "2H" || mStatusUpper === "1H" || mMinuteUpper.startsWith("90") || mMinuteUpper.startsWith("45"))
      );

      const isFinishedMatch =
        isTimeExpired ||
        (isExtraComplete && (mStatusUpper === "2H" || mMinuteUpper.startsWith("90"))) ||
        mStatusUpper === "FT" ||
        mStatusUpper === "AET" ||
        mStatusUpper === "PEN" ||
        mStatusUpper.includes("FINISH") ||
        mStatusUpper.includes("ENDED") ||
        mStatusUpper.includes("FULL TIME") ||
        mMinuteUpper === "FT" ||
        mMinuteUpper === "AET" ||
        mMinuteUpper === "PEN" ||
        mMinuteUpper.includes("FINISH") ||
        mMinuteUpper.includes("ENDED") ||
        mMinuteUpper.includes("FULL TIME");

      const isHalfTime =
        mStatusUpper === "HT" ||
        mMinuteUpper === "HT" ||
        (isExtraComplete && (mStatusUpper === "1H" || mMinuteUpper.startsWith("45")));

      const matchStatus = isFinishedMatch
        ? (mStatusUpper === "AET" || mMinuteUpper === "AET" ? "AET" : mStatusUpper === "PEN" || mMinuteUpper === "PEN" ? "PEN" : "FT")
        : isHalfTime
        ? "HT"
        : (m.status || (m.minute === "Live" || m.statusType === "live" ? "Live" : "NS"));

      const matchScore = m.score || (m.homeScore !== undefined && m.awayScore !== undefined ? `${m.homeScore} - ${m.awayScore}` : "VS");

      const matchMinute = isFinishedMatch
        ? matchStatus
        : isHalfTime
        ? "HT"
        : (m.minute || (matchStatus === "FT" ? "FT" : matchStatus === "NS" ? "NS" : "Live"));

      const matchItem = {
        id: getMatchEventId(m) || `${lId}-${hName}-${aName}-${idx}`,
        status: matchStatus,
        score: matchScore,
        minute: matchMinute,
        extra: m.extra ?? m.fixture?.status?.extra ?? undefined,
        time: formatLocalMatchTime(m),
        date: defaultDateStr,
        rawDate: m.rawDate || m.date || m.fixture?.date,
        timestamp: mTimestamp || undefined,
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
      "AFC Champions League",
      "Saudi Pro League",
      "King Cup of Champions",
      "King's Cup",
      "King Cup",
      "Saudi Super Cup",
      "Premier League",
      "FA Cup",
      "League Cup",
      "Carabao Cup",
      "Community Shield",
      "Championship",
      "La Liga",
      "Copa del Rey",
      "Supercopa de España",
      "Segunda División",
      "Serie A",
      "Coppa Italia",
      "Supercoppa Italiana",
      "Serie B",
      "Bundesliga",
      "DFB Pokal",
      "DFL-Supercup",
      "2. Bundesliga",
      "Ligue 1",
      "Coupe de France",
      "Trophée des Champions",
      "Ligue 2",
      "Brasileirão Série A",
      "Copa do Brasil",
      "Supercopa do Brasil",
      "Brasileirão Série B",
      "Major League Soccer",
      "MLS",
      "US Open Cup",
      "Leagues Cup",
      "UEFA Champions League",
      "UEFA Europa League",
      "UEFA Conference League",
      "Copa Libertadores",
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
      // Search every league of the selected date
      leaguesList.forEach((group: any) => {
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

  // While checking AsyncStorage (takes ~1-2 frames), keep dark background matching native splash
  if (!isSplashCheckDone) {
    return <View style={{ flex: 1, backgroundColor: "#0D0E0F" }} />;
  }

  // Only show splash screen once after initial install. Never show again on subsequent launches!
  if (shouldShowSplash) {
    return (
      <SplashScreen
        onComplete={() => {
          AsyncStorage.setItem(HAS_SEEN_SPLASH_KEY, "true").catch(() => {});
          pendingMatchRef.current = null;
          pendingTabRef.current = null;
          setShouldShowSplash(false);
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
          onSelectDate={handleSelectDate}
          onRefresh={handleRefresh}
          showDateSelector={true}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
      )}

      {/* Dynamic Main Body Content: Explore always kept in DOM; other tabs unmounted when inactive to save C++ memory */}
      {/* Explore: Always mounted (default tab) */}
      <View style={{ flex: 1, display: activeTab === "explore" ? "flex" : "none" }}>
        <ExploreView
          refreshing={refreshing}
          onRefresh={handleRefresh}
          liveMatches={filteredLiveMatches}
          leaguesList={filteredLeaguesList}
          width={width}
          loadingFixtures={loadingFixtures}
          onPressDetails={handlePressDetails}
          searchQuery={debouncedSearchQuery}
          selectedDate={selectedDate}
        />
      </View>

      {/* Leagues: Mounted only when active to avoid maintaining duplicate native trees */}
      {activeTab === "leagues" && (
        <View style={{ flex: 1 }}>
          <LeaguesView
            apiLeagues={apiData?.leagues}
            onPressDetails={handlePressDetails}
          />
        </View>
      )}

      {/* Highlight: Mounted only when active */}
      {activeTab === "highlight" && (
        <View style={{ flex: 1 }}>
          <HighlightView isActive={true} />
        </View>
      )}

      {/* Teams: Mounted only when active */}
      {activeTab === "teams" && (
        <View style={{ flex: 1 }}>
          <TeamsView apiTeams={apiData?.teams} apiLeagues={apiData?.leagues} onPressDetails={handlePressDetails} />
        </View>
      )}

      {/* Prediction: Mounted only when active */}
      {activeTab === "prediction" && (
        <View style={{ flex: 1 }}>
          <PredictionView initialFixtures={apiData?.fixtures} isActive={true} />
        </View>
      )}

      {/* Full-Screen Bouncing Football Loading Overlay - Only on fresh boot without any cache */}
      <LoadingModal visible={loading && !apiData} />

      {/* Match Details Modal */}
      <MatchDetailsModal
        visible={detailsVisible}
        match={selectedMatch}
        tabRequest={detailsTabRequest}
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
