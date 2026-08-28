import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, RotateCw, MapPin, Sparkles } from "lucide-react-native";
import Svg, { Polygon, Path, Circle } from "react-native-svg";
import { fetchHomeTeamLineup, fetchAwayTeamLineup, fetchLeagueStandings, fetchFixtureStatistics, fetchFixturePredictions } from "../../services/footballApi";

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
  const [activeTab, setActiveTab] = useState<"infor" | "stats" | "lineup" | "table">("infor");
  const [votedSide, setVotedSide] = useState<"home" | "draw" | "away" | null>(null);
  const [homeLineup, setHomeLineup] = useState<any>(null);
  const [awayLineup, setAwayLineup] = useState<any>(null);
  const [loadingLineup, setLoadingLineup] = useState<boolean>(false);
  const [lineupTeam, setLineupTeam] = useState<"home" | "away">("home");
  const [standings, setStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState<boolean>(false);
  const [stats, setStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [predictions, setPredictions] = useState<any>(null);
  const [loadingPredictions, setLoadingPredictions] = useState<boolean>(false);

  useEffect(() => {
    if (!visible || !match?.id) return;

    const loadPredictions = async () => {
      setLoadingPredictions(true);
      try {
        const predData = await fetchFixturePredictions(match.id);
        setPredictions(predData);
      } catch (err) {
        console.error("Failed to load predictions:", err);
      } finally {
        setLoadingPredictions(false);
      }
    };

    loadPredictions();
  }, [visible, match?.id]);

  useEffect(() => {
    if (!visible || !match?.id) return;

    const loadLineups = async () => {
      setLoadingLineup(true);
      try {
        const homeData = await fetchHomeTeamLineup(match.id);
        
        // Wait 1200ms to avoid 429 Rate Limit (QPS limit) from RapidAPI Free Tier
        await new Promise((resolve) => setTimeout(resolve, 1200));
        
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
  }, [visible, match?.id]);

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

  useEffect(() => {
    if (!visible || !match?.leagueId || activeTab !== "table") return;

    const loadStandings = async () => {
      setLoadingStandings(true);
      try {
        const rawData = await fetchLeagueStandings(match.leagueId);
        if (rawData && rawData.length > 0) {
          const mapped = rawData.map((item: any, idx: number) => {
            const teamObj = item.team || item;
            const pos = item.pos || item.position || item.rank || item.idx || (idx + 1);
            const name = teamObj.name || teamObj.teamName || "Team";
            const logo = teamObj.logo || teamObj.teamLogo || teamObj.logoUrl || `https://images.fotmob.com/image_resources/logo/teamlogo/${item.teamId || item.id}.png`;
            const pl = item.pl || item.played || item.playedCount || item.all?.played || 0;
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

            const isHome = (teamObj.id && String(teamObj.id) === String(match.home.id)) ||
                           (teamObj.teamId && String(teamObj.teamId) === String(match.home.id)) ||
                           name.toLowerCase().includes(match.home.name.toLowerCase()) || 
                           match.home.name.toLowerCase().includes(name.toLowerCase()) || 
                           (match.home.short && name.toLowerCase().includes(match.home.short.toLowerCase()));
            const isAway = (teamObj.id && String(teamObj.id) === String(match.away.id)) ||
                           (teamObj.teamId && String(teamObj.teamId) === String(match.away.id)) ||
                           name.toLowerCase().includes(match.away.name.toLowerCase()) || 
                           match.away.name.toLowerCase().includes(name.toLowerCase()) || 
                           (match.away.short && name.toLowerCase().includes(match.away.short.toLowerCase()));
            const active = !!(isHome || isAway);

            return { pos, name, logo, pl, gd, pts, active };
          });
          setStandings(mapped);
        } else {
          setStandings([]);
        }
      } catch (err) {
        console.error("Failed to load standing:", err);
        setStandings([]);
      } finally {
        setLoadingStandings(false);
      }
    };

    loadStandings();
  }, [visible, match?.leagueId, activeTab]);

  if (!match) return null;

  // Premium Hexagon Crown Badge
  const PremiumHexagonBadge = () => (
    <View className="items-center justify-center">
      <Svg height="30" width="30" viewBox="0 0 100 100">
        <Polygon points="50,0 93,25 93,75 50,100 7,75 7,25" fill="#FFC800" />
        <Polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="#0D0E0F" />
        <Path d="M30,68 L70,68 L75,38 L60,48 L50,28 L40,48 L25,38 Z" fill="#FFC800" />
      </Svg>
    </View>
  );

  // Stadium fallback solver
  const getStadium = (teamName: string) => {
    if (teamName.includes("Austin")) return "Q2 Stadium";
    if (teamName.includes("Nashville")) return "Geodis Park";
    if (teamName.includes("Manchester City")) return "Etihad Stadium";
    if (teamName.includes("Brighton")) return "Amex Stadium";
    return "Football Arena";
  };

  // Mock Timeline events depending on score / team names
  const getTimelineEvents = () => {
    // If it matches Austin vs Philadelphia Union in the screenshot
    if (match.home.name.includes("Austin") || match.away.name.includes("Philadelphia") || match.home.short === "NSH") {
      return [
        { id: "1", type: "home_goal", player: "Brendan Hines-Ike", minute: "21'" },
        { id: "2", type: "away_goal", player: "Cavan Sullivan", minute: "18'" },
      ];
    }
    // Default dummy events if live match has goals
    const scores = match.score.split("-").map(s => parseInt(s.trim()));
    const homeGoals = isNaN(scores[0]) ? 0 : scores[0];
    const awayGoals = isNaN(scores[1]) ? 0 : scores[1];
    const events = [];
    
    for (let i = 0; i < homeGoals; i++) {
      events.push({
        id: `h-g-${i}`,
        type: "home_goal",
        player: `Goalscorer H${i + 1}`,
        minute: `${10 + i * 25}'`
      });
    }
    for (let i = 0; i < awayGoals; i++) {
      events.push({
        id: `a-g-${i}`,
        type: "away_goal",
        player: `Goalscorer A${i + 1}`,
        minute: `${15 + i * 25}'`
      });
    }
    // Sort events by minute
    return events.sort((a, b) => parseInt(b.minute) - parseInt(a.minute));
  };

  const timelineEvents = getTimelineEvents();

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
        {/* Header Block */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#ffffff05] bg-[#0D0E0F]">
          <TouchableOpacity onPress={onClose} className="p-1">
            <ArrowLeft size={24} color="#ECEDEE" />
          </TouchableOpacity>

          <Text className="text-xl font-black text-white tracking-widest uppercase">
            Live Score
          </Text>

          <View className="flex-row items-center gap-3">
            <TouchableOpacity className="p-1 bg-white/5 rounded-full">
              <RotateCw size={18} color="#ECEDEE" />
            </TouchableOpacity>
            <TouchableOpacity>
              <PremiumHexagonBadge />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1 px-4 mt-4" showsVerticalScrollIndicator={false}>
          {/* Main Scorecard Panel */}
          <View className="bg-[#131415] rounded-3xl p-5 border border-[#ffffff08] mb-6 relative overflow-hidden">
            {/* Wavy line vector pattern simulation overlay */}
            <View className="absolute inset-0 opacity-10 justify-center items-center">
              <Svg height="100%" width="100%" viewBox="0 0 100 100">
                <Path d="M0,50 Q25,20 50,50 T100,50" fill="none" stroke="#FFFFFF" strokeWidth="1" />
                <Path d="M0,60 Q25,30 50,60 T100,60" fill="none" stroke="#FFFFFF" strokeWidth="1" />
                <Path d="M0,70 Q25,40 50,70 T100,70" fill="none" stroke="#FFFFFF" strokeWidth="1" />
              </Svg>
            </View>

            {/* League Details */}
            <Text className="text-gray-400 text-xs font-bold text-center mb-1">
              {match.home.name} vs {match.away.name}
            </Text>
            <Text className="text-[#02DB54] text-xs font-extrabold text-center mb-4">
              {match.league}
            </Text>

            {/* Score layout */}
            <View className="flex-row justify-between items-center my-2 px-2">
              {/* Home */}
              <View className="items-center flex-1">
                <View className="w-16 h-16 bg-[#181A1B] border border-white/5 items-center justify-center rounded-2xl mb-2">
                  <Image source={{ uri: match.home.logo }} className="w-12 h-12" resizeMode="contain" />
                </View>
                <Text className="text-white font-extrabold text-xs text-center" numberOfLines={1}>
                  {match.home.name}
                </Text>
                <Text className="text-gray-500 text-[10px] font-bold mt-0.5">Home</Text>
              </View>

              {/* Score & Minute */}
              <View className="items-center mx-4">
                <Text className="text-white text-3xl font-black tracking-tighter">
                  {match.score}
                </Text>
                <View className="bg-black/40 px-3 py-1 rounded-full mt-2.5">
                  <Text className="text-[#02DB54] text-[11px] font-black">
                    {match.minute}
                  </Text>
                </View>
              </View>

              {/* Away */}
              <View className="items-center flex-1">
                <View className="w-16 h-16 bg-[#181A1B] border border-white/5 items-center justify-center rounded-2xl mb-2">
                  <Image source={{ uri: match.away.logo }} className="w-12 h-12" resizeMode="contain" />
                </View>
                <Text className="text-white font-extrabold text-xs text-center" numberOfLines={1}>
                  {match.away.name}
                </Text>
                <Text className="text-gray-500 text-[10px] font-bold mt-0.5">Away</Text>
              </View>
            </View>

            {/* Stadium location info */}
            <View className="flex-row items-center justify-center gap-1.5 mt-5">
              <MapPin size={12} color="#02DB54" />
              <Text className="text-[#02DB54] text-xs font-black uppercase tracking-wider">
                {getStadium(match.home.name)}
              </Text>
            </View>
          </View>

          {/* Interactive Navigation Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row mb-6"
            contentContainerStyle={{ gap: 10 }}
          >
            {[
              { id: "infor", label: "Infor" },
              { id: "stats", label: "Stats" },
              { id: "lineup", label: "Lineup" },
              { id: "table", label: "Table" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-2.5 rounded-full border ${
                    isActive
                      ? "border-[#02DB54] bg-[#02DB54]/5"
                      : "border-white/10 bg-[#131415]"
                  }`}
                >
                  <Text
                    className={`font-black text-sm ${isActive ? "text-white" : "text-gray-400"}`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Dynamic Tab view rendering */}
          {activeTab === "infor" && (
            <View>
              {/* Who will wins voting card */}
              <View className="bg-[#131415] border border-[#ffffff08] rounded-3xl p-5 mb-6">
                <Text className="text-white text-center font-black text-lg mb-1">
                  Who will win?
                </Text>
                <Text className="text-gray-400 text-center text-[11px] leading-relaxed mb-5">
                  Predictions from API analysis based on form, stats, and odds.
                </Text>

                {loadingPredictions ? (
                  <View className="py-8 items-center justify-center">
                    <ActivityIndicator size="small" color="#02DB54" />
                    <Text className="text-gray-400 text-xs mt-2 font-bold">Calculating predictions...</Text>
                  </View>
                ) : (
                  <View>
                    {/* Vote / Predict buttons row */}
                    <View className="flex-row justify-between gap-2.5">
                      {/* Home Team */}
                      <TouchableOpacity
                        onPress={() => setVotedSide("home")}
                        className={`flex-1 items-center justify-center p-3 rounded-2xl border ${
                          votedSide === "home"
                            ? "border-[#02DB54] bg-[#02DB54]/5"
                            : "border-white/10 bg-[#181A1B]"
                        }`}
                      >
                        <Image source={{ uri: match.home.logo }} className="w-8 h-8 mb-2" />
                        <Text className="text-white text-xs font-black text-center" numberOfLines={1}>
                          {match.home.short}
                        </Text>
                        {predictions && (
                          <Text className="text-[#02DB54] text-[11px] font-black mt-1">
                            {predictions.percent?.home}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {/* Draw */}
                      <TouchableOpacity
                        onPress={() => setVotedSide("draw")}
                        className={`flex-1 items-center justify-center p-3 rounded-2xl border ${
                          votedSide === "draw"
                            ? "border-[#02DB54] bg-[#02DB54]/5"
                            : "border-white/10 bg-[#181A1B]"
                        }`}
                      >
                        <View className="w-8 h-8 items-center justify-center bg-white/5 rounded-full mb-2">
                          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <Circle cx="12" cy="12" r="10" stroke="#ECEDEE" strokeWidth="2" />
                            <Path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#ECEDEE" />
                          </Svg>
                        </View>
                        <Text className="text-white text-xs font-black text-center">Draw</Text>
                        {predictions && (
                          <Text className="text-gray-400 text-[11px] font-black mt-1">
                            {predictions.percent?.draw}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {/* Away Team */}
                      <TouchableOpacity
                        onPress={() => setVotedSide("away")}
                        className={`flex-1 items-center justify-center p-3 rounded-2xl border ${
                          votedSide === "away"
                            ? "border-[#02DB54] bg-[#02DB54]/5"
                            : "border-white/10 bg-[#181A1B]"
                        }`}
                      >
                        <Image source={{ uri: match.away.logo }} className="w-8 h-8 mb-2" />
                        <Text className="text-white text-xs font-black text-center" numberOfLines={1}>
                          {match.away.short}
                        </Text>
                        {predictions && (
                          <Text className="text-yellow-500 text-[11px] font-black mt-1">
                            {predictions.percent?.away}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {predictions && (
                      <View>
                        {/* Segmented Distribution Bar */}
                        <View className="h-2 flex-row rounded-full overflow-hidden bg-white/10 mt-5 mb-2">
                          <View style={{ width: predictions.percent?.home }} className="bg-[#02DB54]" />
                          <View style={{ width: predictions.percent?.draw }} className="bg-gray-500" />
                          <View style={{ width: predictions.percent?.away }} className="bg-yellow-500" />
                        </View>

                        {/* Advice Card */}
                        <View className="flex-row items-center gap-2.5 mt-3.5 bg-[#02DB54]/5 border border-[#02DB54]/10 p-3.5 rounded-2xl">
                          <Sparkles size={16} color="#02DB54" />
                          <Text className="text-gray-300 text-xs font-semibold flex-1 leading-relaxed">
                            <Text className="text-[#02DB54] font-black">AI Advice: </Text>
                            {predictions.advice}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Match Timeline Section */}
              <View className="mb-8">
                {/* Timeline Header divider */}
                <View className="flex-row items-center gap-3 mb-5">
                  <View className="flex-1 h-[1px] bg-white/10" />
                  <Text className="text-white font-extrabold text-base uppercase tracking-wider">
                    Match timeline
                  </Text>
                  <View className="flex-1 h-[1px] bg-white/10" />
                </View>

                {/* Timeline Items list */}
                {timelineEvents.length > 0 ? (
                  timelineEvents.map((evt) => (
                    <View key={evt.id} className="flex-row items-center justify-center mb-4.5 py-1">
                      {/* Left: Home goal info */}
                      <View className="flex-1 items-end pr-4 justify-center">
                        {evt.type === "home_goal" && (
                          <Text className="text-white font-extrabold text-sm text-right leading-tight">
                            {evt.player}
                          </Text>
                        )}
                      </View>

                      {/* Center: ball and minute divider */}
                      <View className="flex-row items-center gap-3.5">
                        {evt.type === "home_goal" && (
                          <View className="w-8 h-8 items-center justify-center bg-white/5 rounded-full">
                            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                              <Circle cx="12" cy="12" r="10" stroke="#ECEDEE" strokeWidth="2" />
                              <Path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#ECEDEE" />
                            </Svg>
                          </View>
                        )}
                        
                        <View className="bg-white px-3 py-1 rounded-full border border-white/10 shadow-sm shadow-black/10">
                          <Text className="text-black font-extrabold text-xs">
                            {evt.minute}
                          </Text>
                        </View>

                        {evt.type === "away_goal" && (
                          <View className="w-8 h-8 items-center justify-center bg-white/5 rounded-full">
                            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                              <Circle cx="12" cy="12" r="10" stroke="#ECEDEE" strokeWidth="2" />
                              <Path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#ECEDEE" />
                            </Svg>
                          </View>
                        )}
                      </View>

                      {/* Right: Away goal info */}
                      <View className="flex-1 items-start pl-4 justify-center">
                        {evt.type === "away_goal" && (
                          <Text className="text-white font-extrabold text-sm text-left leading-tight">
                            {evt.player}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text className="text-gray-500 text-center text-xs my-4">
                    No timeline events available yet.
                  </Text>
                )}
              </View>
            </View>
          )}

          {activeTab === "stats" && (
            <View className="bg-[#131415] border border-[#ffffff08] rounded-3xl p-5 mb-8">
              <Text className="text-white font-black text-base mb-4">Match Statistics</Text>
              
              {loadingStats ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator size="small" color="#02DB54" />
                  <Text className="text-gray-400 text-xs mt-2 font-bold">Loading statistics...</Text>
                </View>
              ) : stats.length > 0 ? (
                stats.map((stat, idx) => (
                  <View key={idx} className="mb-4">
                    <View className="flex-row justify-between text-xs text-gray-400 mb-1">
                      <Text className="text-[#02DB54] font-bold">{stat.home}</Text>
                      <Text className="text-white font-bold">{stat.name}</Text>
                      <Text className="text-yellow-500 font-bold">{stat.away}</Text>
                    </View>
                    <View className="h-1.5 flex-row rounded-full overflow-hidden bg-white/10">
                      <View style={{ width: `${stat.homePct}%` as any }} className="bg-[#02DB54]" />
                      <View style={{ width: `${stat.awayPct}%` as any }} className="bg-yellow-500" />
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-gray-500 text-center text-xs my-4">
                  No statistics available yet.
                </Text>
              )}
            </View>
          )}

          {activeTab === "lineup" && (
            <View className="bg-[#131415] border border-[#ffffff08] rounded-3xl p-4 mb-8">
              {/* Home / Away segmented toggle */}
              <View className="flex-row justify-between mb-4 bg-black/40 p-1 rounded-2xl border border-white/5">
                <TouchableOpacity
                  onPress={() => setLineupTeam("home")}
                  className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-1.5 ${
                    lineupTeam === "home" ? "bg-[#02DB54]" : ""
                  }`}
                >
                  <Text className={`font-black text-xs ${lineupTeam === "home" ? "text-black" : "text-gray-400"}`}>
                    {match.home.name}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setLineupTeam("away")}
                  className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-1.5 ${
                    lineupTeam === "away" ? "bg-[#02DB54]" : ""
                  }`}
                >
                  <Text className={`font-black text-xs ${lineupTeam === "away" ? "text-black" : "text-gray-400"}`}>
                    {match.away.name}
                  </Text>
                </TouchableOpacity>
              </View>

              {loadingLineup ? (
                <View className="py-20 items-center justify-center">
                  <ActivityIndicator size="small" color="#02DB54" />
                  <Text className="text-gray-400 text-xs mt-2 font-bold">Loading lineups...</Text>
                </View>
              ) : (
                (() => {
                  const currentLineup = lineupTeam === "home" ? homeLineup : awayLineup;
                  const starters = currentLineup?.lineup?.starters || [];
                  const subs = currentLineup?.lineup?.subs || [];
                  const formation = currentLineup?.lineup?.formation || "";
                  const teamLogo = lineupTeam === "home" ? match.home.logo : match.away.logo;
                  const teamName = lineupTeam === "home" ? match.home.name : match.away.name;

                  if (starters.length === 0) {
                    return (
                      <View className="py-12 items-center justify-center bg-[#181A1B] rounded-2xl border border-white/5">
                        <Text className="text-gray-500 font-bold text-sm">Lineup not available yet</Text>
                      </View>
                    );
                  }

                  const formatPlayerName = (name: string) => {
                    const parts = name.trim().split(/\s+/);
                    if (parts.length > 1) {
                      const firstInitial = parts[0].charAt(0).toUpperCase();
                      const lastName = parts[parts.length - 1];
                      return `${firstInitial}. ${lastName}`;
                    }
                    return name;
                  };

                  return (
                    <View>
                      {/* Pitch Header */}
                      <View className="bg-[#244b35] flex-row items-center justify-between p-3.5 rounded-t-3xl border-b border-white/10">
                        <View className="flex-row items-center gap-2.5">
                          <View className="w-8 h-8 bg-white rounded-lg p-1 items-center justify-center shadow-sm">
                            <Image source={{ uri: teamLogo }} className="w-6 h-6" resizeMode="contain" />
                          </View>
                          <Text className="text-white font-extrabold text-sm tracking-wide">{teamName}</Text>
                        </View>
                        {formation && (
                          <View className="bg-[#132c1e] px-3 py-1 rounded-full border border-white/5">
                            <Text className="text-[#02DB54] text-xs font-black tracking-wider">{formation}</Text>
                          </View>
                        )}
                      </View>

                      {/* Football Field Pitch */}
                      <View 
                        className="bg-[#2d523a] border-x border-b border-white/10 rounded-b-3xl relative overflow-hidden" 
                        style={{ height: 420 }}
                      >
                        {/* Pitch Markings Overlay */}
                        <View className="absolute inset-0 m-3 border border-white/10 rounded-2xl pointer-events-none">
                          {/* Center Circle */}
                          <View 
                            className="absolute border border-white/10 rounded-full" 
                            style={{ 
                              width: 80, 
                              height: 80, 
                              top: "50%", 
                              left: "50%", 
                              transform: [{ translateX: -40 }, { translateY: -40 }] 
                            }} 
                          />
                          {/* Midfield Line */}
                          <View className="absolute left-0 right-0 h-[1px] bg-white/10" style={{ top: "50%" }} />
                          
                          {/* Top Penalty Box */}
                          <View 
                            className="absolute border-x border-b border-white/10" 
                            style={{ width: "60%", height: 60, top: 0, left: "20%" }} 
                          />
                          {/* Top Goal Area */}
                          <View 
                            className="absolute border-x border-b border-white/10" 
                            style={{ width: "30%", height: 25, top: 0, left: "35%" }} 
                          />

                          {/* Bottom Penalty Box */}
                          <View 
                            className="absolute border-x border-t border-white/10" 
                            style={{ width: "60%", height: 60, bottom: 0, left: "20%" }} 
                          />
                          {/* Bottom Goal Area */}
                          <View 
                            className="absolute border-x border-t border-white/10" 
                            style={{ width: "30%", height: 25, bottom: 0, left: "35%" }} 
                          />
                        </View>

                        {/* Players on Pitch */}
                        {starters.map((player: any) => {
                          const x = player.verticalLayout?.x ?? 0.5;
                          const y = player.verticalLayout?.y ?? 0.5;
                          const hasYellowCard = player.events?.some((e: any) => e.type === "yellowCard") || 
                                                player.performance?.events?.some((e: any) => e.type === "yellowCard");
                          const hasRedCard = player.events?.some((e: any) => e.type === "redCard") || 
                                             player.performance?.events?.some((e: any) => e.type === "redCard");

                          return (
                            <View
                              key={player.id}
                              style={{
                                position: "absolute",
                                left: `${x * 100}%`,
                                top: `${y * 100}%`,
                                transform: [{ translateX: -30 }, { translateY: -35 }],
                                width: 60,
                                alignItems: "center",
                              }}
                            >
                              {/* Avatar Container */}
                              <View className="w-11 h-11 bg-[#a3beb1] rounded-full border-2 border-white/20 items-center justify-center relative shadow-sm">
                                <Image
                                  source={{ uri: `https://images.fotmob.com/image_resources/playerimages/${player.id}.png` }}
                                  className="w-10 h-10"
                                  resizeMode="contain"
                                />
                                {hasYellowCard && (
                                  <View className="absolute -top-1 -right-1 w-2.5 h-3.5 bg-yellow-500 rounded-[2px] border border-black/40 rotate-12 shadow-sm" />
                                )}
                                {hasRedCard && (
                                  <View className="absolute -top-1 -right-1 w-2.5 h-3.5 bg-red-500 rounded-[2px] border border-black/40 rotate-12 shadow-sm" />
                                )}
                              </View>
                              {/* Name label */}
                              <Text 
                                className="text-white text-[9px] font-extrabold text-center mt-1 bg-black/60 px-1 py-0.5 rounded shadow-sm max-w-[58px]"
                                numberOfLines={1}
                              >
                                {player.shirtNumber} {formatPlayerName(player.name)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Substitutes Section */}
                      {subs.length > 0 && (
                        <View className="mt-6">
                          <Text className="text-gray-400 font-extrabold text-xs uppercase tracking-wider mb-2.5">
                            Substitutes
                          </Text>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            contentContainerStyle={{ gap: 10, paddingBottom: 5 }}
                          >
                            {subs.map((sub: any, idx: number) => {
                              const hasYellowCard = sub.events?.some((e: any) => e.type === "yellowCard");
                              const hasRedCard = sub.events?.some((e: any) => e.type === "redCard");

                              return (
                                <View 
                                  key={sub.id || idx} 
                                  className="items-center bg-[#181A1B] border border-white/5 p-2 rounded-2xl w-20 relative"
                                >
                                  <View className="w-9 h-9 rounded-full bg-[#a3beb1]/20 items-center justify-center mb-1 relative">
                                    <Image
                                      source={{ uri: `https://images.fotmob.com/image_resources/playerimages/${sub.id}.png` }}
                                      className="w-8 h-8"
                                      resizeMode="contain"
                                    />
                                    {hasYellowCard && (
                                      <View className="absolute -top-0.5 -right-0.5 w-2 h-2.5 bg-yellow-500 rounded-[1px]" />
                                    )}
                                    {hasRedCard && (
                                      <View className="absolute -top-0.5 -right-0.5 w-2 h-2.5 bg-red-500 rounded-[1px]" />
                                    )}
                                  </View>
                                  <Text className="text-white text-[9px] font-black text-center" numberOfLines={1}>
                                    {sub.shirtNumber ? `${sub.shirtNumber}. ` : ""}{sub.name.split(" ").pop()}
                                  </Text>
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  );
                })()
              )}
            </View>
          )}

          {activeTab === "table" && (
            <View className="bg-[#131415] border border-[#ffffff08] rounded-3xl p-5 mb-8">
              <Text className="text-white font-black text-base mb-4">League Table Teaser</Text>
              {loadingStandings ? (
                <View className="py-8 items-center justify-center">
                  <ActivityIndicator size="small" color="#02DB54" />
                  <Text className="text-gray-400 text-xs mt-2 font-bold">Loading standings...</Text>
                </View>
              ) : (
                <View>
                  <View className="flex-row border-b border-white/10 pb-2 mb-2">
                    <Text className="text-gray-400 font-bold text-xs w-[10%]">Pos</Text>
                    <Text className="text-gray-400 font-bold text-xs flex-1">Team</Text>
                    <Text className="text-gray-400 font-bold text-xs w-[12%] text-center">PL</Text>
                    <Text className="text-gray-400 font-bold text-xs w-[15%] text-center">GD</Text>
                    <Text className="text-gray-400 font-bold text-xs w-[12%] text-center">PTS</Text>
                  </View>
                  {(standings.length > 0 ? standings : [
                    { pos: 1, name: match.home.name, logo: match.home.logo, pl: 24, gd: "+18", pts: 48, active: true },
                    { pos: 2, name: match.away.name, logo: match.away.logo, pl: 24, gd: "+12", pts: 42, active: false },
                    { pos: 3, name: "Inter Miami", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/19024.png", pl: 23, gd: "+8", pts: 39, active: false }
                  ]).map((row: any, idx: number) => (
                    <View key={idx} className="flex-row py-2.5 border-b border-white/5 items-center">
                      <Text className={`font-black text-xs w-[10%] ${row.active ? "text-[#02DB54]" : "text-gray-400"}`}>
                        {row.pos}
                      </Text>
                      <View className="flex-row items-center flex-1 pr-2">
                        {row.logo ? (
                          <Image source={{ uri: row.logo }} className="w-5 h-5 mr-2" resizeMode="contain" />
                        ) : null}
                        <Text className={`font-black text-xs ${row.active ? "text-[#02DB54]" : "text-white"}`} numberOfLines={1}>
                          {row.name}
                        </Text>
                      </View>
                      <Text className="text-gray-300 text-xs w-[12%] text-center font-bold">{row.pl}</Text>
                      <Text className="text-gray-300 text-xs w-[15%] text-center font-bold">{row.gd}</Text>
                      <Text className={`font-extrabold text-xs w-[12%] text-center ${row.active ? "text-[#02DB54]" : "text-white"}`}>
                        {row.pts}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
