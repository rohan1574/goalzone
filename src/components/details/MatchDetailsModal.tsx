import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, RotateCw, MapPin } from "lucide-react-native";
import Svg, { Path, Circle, Rect, Line as SvgLine } from "react-native-svg";
import {
  fetchHomeTeamLineup,
  fetchAwayTeamLineup,
  fetchLeagueStandings,
  fetchFixtureStatistics,
  fetchFixtureEvents,
  fetchFixtureH2H,
} from "../../services/footballApi";
import BannerAdComponent from "../ads/BannerAdComponent";

interface Team {
  id?: string | number;
  name: string;
  short: string;
  logo: string;
}

interface Match {
  id: string;
  league: string;
  leagueId?: string | number;
  leagueLogo?: string;
  home: Team;
  away: Team;
  score: string;
  minute: string;
  status: string;
}

interface MatchDetailsModalProps {
  visible: boolean;
  match: Match | null;
  onClose: () => void;
}

export default function MatchDetailsModal({
  visible,
  match,
  onClose,
}: MatchDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<
    "infor" | "stats" | "lineup" | "table" | "h2h"
  >("infor");
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [homeLineup, setHomeLineup] = useState<any>(null);
  const [awayLineup, setAwayLineup] = useState<any>(null);
  const [loadingLineup, setLoadingLineup] = useState<boolean>(false);
  const [standings, setStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState<boolean>(false);
  const [stats, setStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [h2hData, setH2hData] = useState<any>(null);
  const [loadingH2h, setLoadingH2h] = useState<boolean>(false);

  // 1. Fetch Timeline Events for Infor tab
  useEffect(() => {
    if (!visible || !match?.id) return;
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const data = await fetchFixtureEvents(match.id);
        setEvents(data || []);
      } catch (err) {
        console.error("Failed to load events:", err);
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, [visible, match?.id]);

  // 2. Fetch Statistics for Stats tab
  useEffect(() => {
    if (!visible || !match?.id || activeTab !== "stats") return;
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const statsData = await fetchFixtureStatistics(match.id);
        setStats(statsData || []);
      } catch (err) {
        console.error("Failed to load statistics:", err);
      } finally {
        setLoadingStats(false);
      }
    };
    loadStats();
  }, [visible, match?.id, activeTab]);

  // 3. Fetch Lineups for Lineup tab
  useEffect(() => {
    if (!visible || !match?.id || activeTab !== "lineup") return;
    const loadLineups = async () => {
      setLoadingLineup(true);
      try {
        const homeData = await fetchHomeTeamLineup(match.id);
        await new Promise((resolve) => setTimeout(resolve, 800));
        const awayData = await fetchAwayTeamLineup(match.id);
        setHomeLineup(homeData);
        setAwayLineup(awayData);
      } catch (err) {
        console.error("Failed to load lineups:", err);
      } finally {
        setLoadingLineup(false);
      }
    };
    loadLineups();
  }, [visible, match?.id, activeTab]);

  // 4. Fetch Standings for Table tab
  useEffect(() => {
    if (!visible || !match?.leagueId || activeTab !== "table") return;
    const loadStandings = async () => {
      setLoadingStandings(true);
      try {
        const rawData = await fetchLeagueStandings(match.leagueId);
        if (rawData && rawData.length > 0) {
          const mapped = rawData.map((item: any, idx: number) => {
            const teamObj = item.team || item;
            const pos =
              item.pos || item.position || item.rank || item.idx || idx + 1;
            const name = teamObj.name || teamObj.teamName || "Team";
            const logo =
              teamObj.logo ||
              teamObj.teamLogo ||
              teamObj.logoUrl ||
              `https://images.fotmob.com/image_resources/logo/teamlogo/${item.teamId || item.id}.png`;
            const pl =
              item.pl || item.played || item.playedCount || item.all?.played || 0;
            const gd = String(
              item.gd ??
                item.goalDiff ??
                item.goal_diff ??
                item.goalsDiff ??
                item.goalDifference ??
                item.diff ??
                item.all?.goalsDiff ??
                "0"
            );
            const pts = item.pts || item.points || 0;

            const isHome =
              (teamObj.id && String(teamObj.id) === String(match.home.id)) ||
              name.toLowerCase().includes(match.home.name.toLowerCase()) ||
              match.home.name.toLowerCase().includes(name.toLowerCase());
            const isAway =
              (teamObj.id && String(teamObj.id) === String(match.away.id)) ||
              name.toLowerCase().includes(match.away.name.toLowerCase()) ||
              match.away.name.toLowerCase().includes(name.toLowerCase());
            const active = !!(isHome || isAway);

            return { pos, name, logo, pl, gd, pts, active };
          });
          setStandings(mapped);
        } else {
          setStandings([]);
        }
      } catch (err) {
        console.error("Failed to load standings:", err);
        setStandings([]);
      } finally {
        setLoadingStandings(false);
      }
    };
    loadStandings();
  }, [visible, match?.leagueId, activeTab]);

  // 5. Fetch H2H for H2H tab
  useEffect(() => {
    if (!visible || !match?.home?.id || !match?.away?.id || activeTab !== "h2h") return;
    const loadH2H = async () => {
      setLoadingH2h(true);
      try {
        const data = await fetchFixtureH2H(match.home.id!, match.away.id!);
        setH2hData(data);
      } catch (err) {
        console.error("Failed to load H2H:", err);
      } finally {
        setLoadingH2h(false);
      }
    };
    loadH2H();
  }, [visible, match?.home?.id, match?.away?.id, activeTab]);

  if (!match) return null;

  // Fallback Stadium
  const stadiumName = "ESTADIO NORBERTO TITO TOMAGHELLO";

  const isUpcoming =
    (!match.score || match.score === "VS") &&
    (match.status === "NS" ||
      match.status === "Scheduled" ||
      match.status === "Upcoming" ||
      match.status === "TBD");

  // Fallback timeline events if API returned empty
  const getTimelineEvents = () => {
    if (events && events.length > 0) {
      return events;
    }
    if (isUpcoming) return [];

    const scores = match.score.split("-").map((s) => parseInt(s.trim()));
    const homeGoals = isNaN(scores[0]) ? 0 : scores[0];
    const awayGoals = isNaN(scores[1]) ? 0 : scores[1];
    if (homeGoals === 0 && awayGoals === 0) return [];

    const fallbackList: any[] = [];

    for (let i = 0; i < homeGoals; i++) {
      fallbackList.push({
        id: `h-g-${i}`,
        type: "goal",
        player: `Goalscorer H${i + 1}`,
        minute: `${90 - i * 4}'`,
        elapsed: 90 - i * 4,
        teamId: match.home.id,
        isHome: true,
      });
    }
    for (let i = 0; i < awayGoals; i++) {
      fallbackList.push({
        id: `a-g-${i}`,
        type: "goal",
        player: `Goalscorer A${i + 1}`,
        minute: `${80 - i * 10}'`,
        elapsed: 80 - i * 10,
        teamId: match.away.id,
        isHome: false,
      });
    }
    return fallbackList.sort((a, b) => b.elapsed - a.elapsed);
  };

  const timelineEvents = getTimelineEvents();

  // Helper to extract lineup data flexibly (no demo fallback)
  const getLineupObj = (data: any, fallbackName: string) => {
    if (!data) return { starters: [], formation: "", teamName: fallbackName };
    const l = data.lineup || data;
    const starters = l.starters || l.startXI || l.startingXI || l.startersList || [];
    const formation = l.formation || "";
    const teamName = l.name || l.teamName || fallbackName;
    return { starters, formation, teamName };
  };

  const homeLineupData = getLineupObj(homeLineup, match.home.name);
  const awayLineupData = getLineupObj(awayLineup, match.away.name);
  const homeStarters = homeLineupData.starters;
  const awayStarters = awayLineupData.starters;
  // Use actual API stats only — no demo fallback
  const effectiveStats = stats;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0C0E" }}>
        {/* Header Block */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#ffffff08] bg-[#0B0C0E]">
          <TouchableOpacity onPress={onClose} className="p-1">
            <ArrowLeft size={22} color="#ECEDEE" />
          </TouchableOpacity>

          <Text className="text-lg font-black text-white tracking-widest uppercase">
            LIVE SCORE
          </Text>

          <TouchableOpacity className="p-1">
            <RotateCw size={18} color="#ECEDEE" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 mt-3" showsVerticalScrollIndicator={false}>
          {/* Main Scorecard Panel */}
          <View className="bg-[#131517] rounded-3xl p-5 border border-[#ffffff08] mb-5 relative overflow-hidden">
            {/* Background Wavy Lines SVG */}
            <View className="absolute inset-0 opacity-15 justify-center items-center">
              <Svg height="100%" width="100%" viewBox="0 0 100 100">
                <Path d="M0,40 Q25,10 50,40 T100,40" fill="none" stroke="#02DB54" strokeWidth="0.8" />
                <Path d="M0,55 Q25,25 50,55 T100,55" fill="none" stroke="#FFFFFF" strokeWidth="0.8" />
                <Path d="M0,70 Q25,40 50,70 T100,70" fill="none" stroke="#02DB54" strokeWidth="0.8" />
              </Svg>
            </View>

            {/* League Details */}
            <Text className="text-gray-300 text-xs font-bold text-center mb-1">
              {match.home.name} vs {match.away.name}
            </Text>
            <Text className="text-[#86EFAC] text-[11px] font-extrabold text-center mb-4">
              {match.league}
            </Text>

            {/* Score layout */}
            <View className="flex-row justify-between items-center my-1 px-1">
              {/* Home Team */}
              <View className="items-center flex-1">
                <View className="w-16 h-16 bg-[#181A1C] border border-white/10 items-center justify-center rounded-2xl mb-2">
                  <Image
                    source={{ uri: match.home.logo }}
                    className="w-11 h-11"
                    resizeMode="contain"
                  />
                </View>
                <Text className="text-white font-extrabold text-xs text-center" numberOfLines={1}>
                  {match.home.name}
                </Text>
                <Text className="text-gray-400 text-[10px] font-bold mt-0.5">Home</Text>
              </View>

              {/* Score & Minute */}
              <View className="items-center mx-4">
                <Text className="text-white text-3xl font-black tracking-tight">
                  {match.score}
                </Text>
                <View className="bg-black/50 px-3 py-1 rounded-full mt-2">
                  <Text className="text-[#02DB54] text-[11px] font-black uppercase">
                    {match.minute || match.status}
                  </Text>
                </View>
              </View>

              {/* Away Team */}
              <View className="items-center flex-1">
                <View className="w-16 h-16 bg-[#181A1C] border border-white/10 items-center justify-center rounded-2xl mb-2">
                  <Image
                    source={{ uri: match.away.logo }}
                    className="w-11 h-11"
                    resizeMode="contain"
                  />
                </View>
                <Text className="text-white font-extrabold text-xs text-center" numberOfLines={1}>
                  {match.away.name}
                </Text>
                <Text className="text-gray-400 text-[10px] font-bold mt-0.5">Away</Text>
              </View>
            </View>

            {/* Stadium Info */}
            <View className="flex-row items-center justify-between mt-5 pt-3 border-t border-white/5 px-2">
              <View className="flex-row items-center gap-1.5 flex-1">
                <MapPin size={13} color="#02DB54" />
                <Text className="text-[#02DB54] text-[11px] font-black uppercase tracking-wider" numberOfLines={1}>
                  {stadiumName}
                </Text>
              </View>
              <Text className="text-white text-[11px] font-extrabold">Round 11</Text>
            </View>
          </View>

          {/* Interactive Navigation Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row mb-5"
            contentContainerStyle={{ gap: 8 }}
          >
            {[
              { id: "infor", label: "Infor" },
              { id: "stats", label: "Stats" },
              { id: "lineup", label: "Lineup" },
              { id: "table", label: "Table" },
              { id: "h2h", label: "H2H" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  className={`px-5 py-2 rounded-full border ${
                    isActive
                      ? "border-[#02DB54] bg-[#02DB54]/10"
                      : "border-white/10 bg-[#131517]"
                  }`}
                >
                  <Text
                    className={`font-black text-xs ${
                      isActive ? "text-[#02DB54]" : "text-gray-400"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* TAB 1: INFOR (Match Timeline) */}
          {activeTab === "infor" && (
            <View className="mb-6">
              {/* Section Header */}
              <View className="flex-row items-center justify-center mb-6">
                <View className="flex-1 h-[1px] bg-white/10" />
                <Text className="text-white font-extrabold text-sm mx-4">
                  Match timeline
                </Text>
                <View className="flex-1 h-[1px] bg-white/10" />
              </View>

              {loadingEvents ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : isUpcoming ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">Match Has Not Started</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Timeline data will appear once the match begins.</Text>
                </View>
              ) : timelineEvents.length === 0 ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">No Timeline Available</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Data is not available for this match.</Text>
                </View>
              ) : (
                <View className="space-y-4">
                  {timelineEvents.map((item, index) => {
                    const isHome =
                      item.isHome ??
                      (item.teamId
                        ? String(item.teamId) === String(match.home.id)
                        : true);

                    return (
                      <View
                        key={item.id || index}
                        className="flex-row items-center justify-between my-2"
                      >
                        {/* Home Side Event */}
                        <View className="flex-1 flex-row items-center justify-end pr-3">
                          {isHome && (
                            <View className="items-end">
                              <Text className="text-white font-bold text-xs">
                                {item.player}
                              </Text>
                              {item.assist && (
                                <Text className="text-gray-400 text-[10px]">
                                  {item.assist}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>

                        {/* Icon & Minute Pill */}
                        <View className="flex-row items-center gap-2">
                          {isHome && (
                            <View className="w-6 h-6 items-center justify-center">
                              {item.type === "goal" ? (
                                <Text className="text-base">⚽</Text>
                              ) : item.type === "subst" ? (
                                <View className="w-5 h-5 bg-green-500/20 rounded-full items-center justify-center">
                                  <Text className="text-[10px]">🔄</Text>
                                </View>
                              ) : (
                                <View className="w-3.5 h-4 bg-yellow-400 rounded-sm" />
                              )}
                            </View>
                          )}

                          <View className="bg-white px-3 py-1 rounded-full border border-gray-200 min-w-[42px] items-center">
                            <Text className="text-black font-black text-[11px]">
                              {item.minute}
                            </Text>
                          </View>

                          {!isHome && (
                            <View className="w-6 h-6 items-center justify-center">
                              {item.type === "goal" ? (
                                <Text className="text-base">⚽</Text>
                              ) : item.type === "subst" ? (
                                <View className="w-5 h-5 bg-green-500/20 rounded-full items-center justify-center">
                                  <Text className="text-[10px]">🔄</Text>
                                </View>
                              ) : (
                                <View className="w-3.5 h-4 bg-yellow-400 rounded-sm" />
                              )}
                            </View>
                          )}
                        </View>

                        {/* Away Side Event */}
                        <View className="flex-1 flex-row items-center justify-start pl-3">
                          {!isHome && (
                            <View className="items-start">
                              <Text className="text-white font-bold text-xs">
                                {item.player}
                              </Text>
                              {item.assist && (
                                <Text className="text-gray-400 text-[10px]">
                                  {item.assist}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: STATS */}
          {activeTab === "stats" && (
            <View className="mb-6">
              {loadingStats ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : isUpcoming ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">Match Has Not Started</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Statistics will appear once the match begins.</Text>
                </View>
              ) : effectiveStats.length === 0 ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">No Statistics Available</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Data is not available for this match.</Text>
                </View>
              ) : (
                <View className="space-y-3">
                  {effectiveStats.map((stat, idx) => {
                    const homeNum = parseFloat(String(stat.home).replace("%", "")) || 0;
                    const awayNum = parseFloat(String(stat.away).replace("%", "")) || 0;
                    const homeWin = homeNum >= awayNum;
                    const awayWin = awayNum >= homeNum;

                    return (
                      <View
                        key={idx}
                        className="flex-row items-center justify-between my-1.5"
                      >
                        {/* Home Value Pill */}
                        <View className="w-16 items-start">
                          <View
                            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${
                              homeWin ? "bg-[#02DB54]/20 border border-[#02DB54]/50" : "bg-[#181A1C]"
                            }`}
                          >
                            <Text className="text-white font-bold text-xs">
                              {stat.home}
                            </Text>
                            {homeWin && <View className="w-2 h-2 rounded-full bg-[#02DB54]" />}
                          </View>
                        </View>

                        {/* Stat Name */}
                        <Text className="text-gray-300 font-extrabold text-xs text-center flex-1 mx-2">
                          {stat.name}
                        </Text>

                        {/* Away Value Pill */}
                        <View className="w-16 items-end">
                          <View
                            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${
                              awayWin ? "bg-[#02DB54]/20 border border-[#02DB54]/50" : "bg-[#181A1C]"
                            }`}
                          >
                            {awayWin && <View className="w-2 h-2 rounded-full bg-[#02DB54]" />}
                            <Text className="text-white font-bold text-xs">
                              {stat.away}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: LINEUP */}
          {activeTab === "lineup" && (
            <View className="mb-6">
              {loadingLineup ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : isUpcoming ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">Match Has Not Started</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Lineups will appear once the match begins.</Text>
                </View>
              ) : (homeStarters.length === 0 && awayStarters.length === 0) ? (
                <View className="py-12 px-4 items-center justify-center bg-[#131517] rounded-2xl border border-white/5 my-2">
                  <Text className="text-[#02DB54] font-black text-sm mb-1">Lineups Not Available</Text>
                  <Text className="text-gray-400 font-bold text-xs text-center">Lineup data could not be found for this match.</Text>
                </View>
              ) : (
                <View className="bg-[#122818] rounded-2xl p-4 border border-[#02DB54]/30 relative overflow-hidden min-h-[460px]">
                  {/* Soccer Pitch Markings Overlay */}
                  <Svg height="100%" width="100%" style={{ position: "absolute" }}>
                    <Rect x="5%" y="3%" width="90%" height="94%" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.25} />
                    <SvgLine x1="5%" y1="50%" x2="95%" y2="50%" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.25} />
                    <Circle cx="50%" cy="50%" r="40" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.25} />
                  </Svg>

                  {/* Home Team (Top Half Pitch) */}
                  <View className="flex-1 justify-around py-2">
                    <Text className="text-[#86EFAC] text-[10px] font-black uppercase text-center mb-2">
                      {homeLineupData.teamName} ({homeLineupData.formation})
                    </Text>

                    <View className="flex-row justify-around my-2">
                      {homeStarters.slice(0, 4).map((p: any, i: number) => (
                        <View key={i} className="items-center">
                          <View className="w-9 h-9 rounded-full bg-white/10 border border-[#02DB54] items-center justify-center">
                            <Text className="text-white font-black text-xs">{p.number || p.shirtNumber || p.player?.number || i+1}</Text>
                          </View>
                          <Text className="text-white font-bold text-[9px] mt-1 text-center max-w-[65px]" numberOfLines={1}>
                            {p.name || p.player?.name}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View className="flex-row justify-around my-2">
                      {homeStarters.slice(4, 7).map((p: any, i: number) => (
                        <View key={i} className="items-center">
                          <View className="w-9 h-9 rounded-full bg-white/10 border border-[#02DB54] items-center justify-center">
                            <Text className="text-white font-black text-xs">{p.number || p.shirtNumber || p.player?.number || i+5}</Text>
                          </View>
                          <Text className="text-white font-bold text-[9px] mt-1 text-center max-w-[65px]" numberOfLines={1}>
                            {p.name || p.player?.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Pitch Divider Line */}
                  <View className="h-[1px] bg-white/20 my-3" />

                  {/* Away Team (Bottom Half Pitch) */}
                  <View className="flex-1 justify-around py-2">
                    <View className="flex-row justify-around my-2">
                      {awayStarters.slice(4, 7).map((p: any, i: number) => (
                        <View key={i} className="items-center">
                          <View className="w-9 h-9 rounded-full bg-white/10 border border-white/50 items-center justify-center">
                            <Text className="text-white font-black text-xs">{p.number || p.shirtNumber || p.player?.number || i+5}</Text>
                          </View>
                          <Text className="text-white font-bold text-[9px] mt-1 text-center max-w-[65px]" numberOfLines={1}>
                            {p.name || p.player?.name}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View className="flex-row justify-around my-2">
                      {awayStarters.slice(0, 4).map((p: any, i: number) => (
                        <View key={i} className="items-center">
                          <View className="w-9 h-9 rounded-full bg-white/10 border border-white/50 items-center justify-center">
                            <Text className="text-white font-black text-xs">{p.number || p.shirtNumber || p.player?.number || i+1}</Text>
                          </View>
                          <Text className="text-white font-bold text-[9px] mt-1 text-center max-w-[65px]" numberOfLines={1}>
                            {p.name || p.player?.name}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <Text className="text-gray-300 text-[10px] font-black uppercase text-center mt-2">
                      {awayLineupData.teamName} ({awayLineupData.formation})
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* TAB 4: TABLE (Standings) */}
          {activeTab === "table" && (
            <View className="mb-6">
              {loadingStandings ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : standings.length === 0 ? (
                <Text className="text-gray-400 text-center py-6">
                  No table standings available.
                </Text>
              ) : (
                <View className="bg-[#131517] rounded-2xl overflow-hidden border border-white/5">
                  {/* Table Header */}
                  <View className="flex-row items-center py-3 px-4 bg-white/5 border-b border-white/5">
                    <Text className="text-gray-400 font-extrabold text-xs w-8 text-center">#</Text>
                    <Text className="text-gray-400 font-extrabold text-xs flex-1 ml-2">Team</Text>
                    <Text className="text-gray-400 font-extrabold text-xs w-10 text-center">P</Text>
                    <Text className="text-gray-400 font-extrabold text-xs w-10 text-center">GD</Text>
                    <Text className="text-gray-400 font-extrabold text-xs w-12 text-center">PTS</Text>
                  </View>

                  {/* Table Rows */}
                  {standings.slice(0, 15).map((item, idx) => (
                    <View
                      key={idx}
                      className={`flex-row items-center py-3 px-4 border-b border-white/5 ${
                        item.active ? "bg-[#02DB54]/15" : ""
                      }`}
                    >
                      <Text className="text-white font-black text-xs w-8 text-center">
                        {item.pos}
                      </Text>
                      <View className="flex-row items-center flex-1 ml-2 gap-2">
                        <Image source={{ uri: item.logo }} className="w-5 h-5" resizeMode="contain" />
                        <Text className="text-white font-bold text-xs" numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>
                      <Text className="text-gray-300 font-bold text-xs w-10 text-center">
                        {item.pl}
                      </Text>
                      <Text className="text-gray-300 font-bold text-xs w-10 text-center">
                        {item.gd}
                      </Text>
                      <Text className="text-white font-black text-xs w-12 text-center">
                        {item.pts}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 5: H2H */}
          {activeTab === "h2h" && (
            <View className="mb-6 space-y-4">
              {loadingH2h ? (
                <ActivityIndicator color="#02DB54" className="my-6" />
              ) : (
                <>
                  {/* Overall Wins Card */}
                  <View className="bg-[#131517] rounded-2xl p-4 border border-white/10 my-2 flex-row justify-between items-center">
                    <Text className="text-white font-extrabold text-sm flex-row items-center gap-2">
                      📊 Home Wins
                    </Text>
                    <View className="bg-[#86EFAC] py-2 px-4 rounded-xl">
                      <Text className="text-black font-black text-xs">
                        {h2hData?.homeWins ?? 3}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-[#131517] rounded-2xl p-4 border border-white/10 my-2 flex-row justify-between items-center">
                    <Text className="text-white font-extrabold text-sm">
                      📊 Away Wins
                    </Text>
                    <View className="bg-[#86EFAC] py-2 px-4 rounded-xl">
                      <Text className="text-black font-black text-xs">
                        {h2hData?.awayWins ?? 2}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-[#131517] rounded-2xl p-4 border border-white/10 my-2 flex-row justify-between items-center">
                    <Text className="text-white font-extrabold text-sm">
                      📊 Draws
                    </Text>
                    <View className="bg-[#86EFAC] py-2 px-4 rounded-xl">
                      <Text className="text-black font-black text-xs">
                        {h2hData?.draws ?? 1}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Banner Ad inside Match Details Modal */}
        <BannerAdComponent />
      </SafeAreaView>
    </Modal>
  );
}
