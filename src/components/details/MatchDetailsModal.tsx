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
import Svg, { Path, Circle } from "react-native-svg";
import { fetchHomeTeamLineup, fetchAwayTeamLineup, fetchLeagueStandings, fetchFixtureStatistics, fetchFixturePredictions } from "../../services/footballApi";
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

          

         
        </ScrollView>
        {/* Banner Ad inside Match Details Modal */}
        <BannerAdComponent />
      </SafeAreaView>
    </Modal>
  );
}
