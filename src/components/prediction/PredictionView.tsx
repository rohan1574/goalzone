import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import {
  Sparkles,
  Trophy,
  CheckCircle,
  HelpCircle,
  TrendingUp,
} from "lucide-react-native";
import {
  fetchFixturesByDate,
  formatFootballDate,
  getMatchValue,
  getTeamLogo,
  getMatchLeague,
  getMatchEventId,
} from "../../services/footballApi";

const { width } = Dimensions.get("window");

interface MatchData {
  id: string;
  league: string;
  home: {
    name: string;
    logo: string;
    short: string;
  };
  away: {
    name: string;
    logo: string;
    short: string;
  };
  communityPoll: {
    home: number;
    draw: number;
    away: number;
  };
  aiProbabilities: {
    home: number;
    draw: number;
    away: number;
  };
  aiVerdict: string;
  h2h: {
    homeWins: number;
    draws: number;
    awayWins: number;
    avgGoals: number;
    cleanSheets: { home: number; away: number };
  };
}

// Fallback matches in case API fails or is empty
const MOCK_PREDICTIONS: MatchData[] = [
  {
    id: "pred-1",
    league: "UEFA Champions League",
    home: {
      name: "Manchester City",
      short: "MCI",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8457.png",
    },
    away: {
      name: "Real Madrid",
      short: "RMA",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png",
    },
    communityPoll: { home: 54, draw: 16, away: 30 },
    aiProbabilities: { home: 48, draw: 22, away: 30 },
    aiVerdict: "Manchester City holds a slight advantage due to their dominant home form and high goal-conversion rate, but Real Madrid's strong counter-attacks make them highly dangerous in cup ties.",
    h2h: {
      homeWins: 4,
      draws: 2,
      awayWins: 3,
      avgGoals: 2.8,
      cleanSheets: { home: 22, away: 35 },
    },
  },
  {
    id: "pred-2",
    league: "Premier League",
    home: {
      name: "Arsenal",
      short: "ARS",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9825.png",
    },
    away: {
      name: "Chelsea",
      short: "CHE",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png",
    },
    communityPoll: { home: 60, draw: 25, away: 15 },
    aiProbabilities: { home: 55, draw: 27, away: 18 },
    aiVerdict: "Arsenal is heavily favored here. Their pressing intensity and positional structure under Arteta will likely choke Chelsea's buildup, leading to transitions in Chelsea's defensive third.",
    h2h: {
      homeWins: 5,
      draws: 3,
      awayWins: 2,
      avgGoals: 3.1,
      cleanSheets: { home: 40, away: 10 },
    },
  },
  {
    id: "pred-3",
    league: "La Liga",
    home: {
      name: "Barcelona",
      short: "BAR",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8634.png",
    },
    away: {
      name: "Atletico Madrid",
      short: "ATM",
      logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9906.png",
    },
    communityPoll: { home: 45, draw: 20, away: 35 },
    aiProbabilities: { home: 42, draw: 30, away: 28 },
    aiVerdict: "A highly tactical match expected. Atletico will set up a compact low block, challenging Barcelona's creative midfielders to break them down. A draw or a narrow home victory is highly probable.",
    h2h: {
      homeWins: 3,
      draws: 4,
      awayWins: 3,
      avgGoals: 1.9,
      cleanSheets: { home: 30, away: 30 },
    },
  },
];

// Helper to generate realistic deterministic stats for live API matches based on ID
const generateStatsForMatch = (id: string, homeName: string, awayName: string) => {
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed + id.charCodeAt(i)) % 100;
  }
  
  const homeProb = 35 + (seed % 25); // 35 to 60
  const awayProb = 20 + ((seed * 7) % 20); // 20 to 40
  const drawProb = 100 - homeProb - awayProb;
  
  const commHome = 30 + ((seed * 11) % 40);
  const commAway = 20 + ((seed * 13) % 30);
  const commDraw = 100 - commHome - commAway;
  
  const homeWins = 2 + (seed % 4); // 2 to 5
  const awayWins = 1 + ((seed * 3) % 4); // 1 to 4
  const draws = 9 - homeWins - awayWins;
  
  const avgGoals = 1.8 + ((seed % 15) / 10); // 1.8 to 3.3
  const cleanSheetsHome = 15 + (seed % 35);
  const cleanSheetsAway = 10 + ((seed * 3) % 40);

  const aiVerdict = `${homeName} shows strong tactical form recently. Under their current system, they average high progressive passes. However, ${awayName} remains dangerous on transitions and counter-attacks, meaning a competitive, tight match is expected with ${homeName} holding the tactical advantage.`;

  return {
    communityPoll: { home: commHome, draw: commDraw, away: commAway },
    aiProbabilities: { home: homeProb, draw: drawProb, away: awayProb },
    aiVerdict,
    h2h: {
      homeWins,
      draws,
      awayWins,
      avgGoals: parseFloat(avgGoals.toFixed(1)),
      cleanSheets: { home: cleanSheetsHome, away: cleanSheetsAway }
    }
  };
};

export default function PredictionView() {
  const [matches, setMatches] = useState<MatchData[]>(MOCK_PREDICTIONS);
  const [activeMatchId, setActiveMatchId] = useState("pred-1");
  const [userPredictions, setUserPredictions] = useState<{ [key: string]: "home" | "draw" | "away" }>({});
  const [xpPoints, setXpPoints] = useState(1450);
  const [activeDetailTab, setActiveDetailTab] = useState<"ai" | "h2h">("ai");
  const [loading, setLoading] = useState(true);

  // Fetch real matches on mount
  useEffect(() => {
    const loadRealMatches = async () => {
      try {
        setLoading(true);
        const todayDate = formatFootballDate(0);
        const data = await fetchFixturesByDate(todayDate);
        
        if (data && data.length > 0) {
          // Map raw API fixtures to our MatchData schema (top 8 matches)
          const mappedMatches: MatchData[] = data.slice(0, 8).map((m: any) => {
            const hName = getMatchValue(m, ["home.name", "homeTeam.name"]) || "Home Team";
            const hShort = getMatchValue(m, ["home.shortName", "home.code", "homeTeam.code"]);
            const hShortStr = hShort && hShort !== "TBD" ? hShort : hName.substring(0, 3).toUpperCase();
            const hLogo = getTeamLogo(m, "home");

            const aName = getMatchValue(m, ["away.name", "awayTeam.name"]) || "Away Team";
            const aShort = getMatchValue(m, ["away.shortName", "away.code", "awayTeam.code"]);
            const aShortStr = aShort && aShort !== "TBD" ? aShort : aName.substring(0, 3).toUpperCase();
            const aLogo = getTeamLogo(m, "away");

            const league = getMatchLeague(m) || "Live Matches";
            const id = String(getMatchEventId(m) || Math.random().toString());

            const generatedStats = generateStatsForMatch(id, hName, aName);

            return {
              id,
              league,
              home: { name: hName, short: hShortStr, logo: hLogo },
              away: { name: aName, short: aShortStr, logo: aLogo },
              ...generatedStats
            };
          });

          setMatches(mappedMatches);
          setActiveMatchId(mappedMatches[0].id);
        }
      } catch (err) {
        console.error("Failed to load real prediction fixtures:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRealMatches();
  }, []);

  const currentMatch = matches.find(m => m.id === activeMatchId) || matches[0] || MOCK_PREDICTIONS[0];
  const hasPredictedCurrent = !!userPredictions[currentMatch.id];
  const selectedPrediction = userPredictions[currentMatch.id];

  const handlePredict = (choice: "home" | "draw" | "away") => {
    if (hasPredictedCurrent) return;

    setUserPredictions(prev => ({
      ...prev,
      [currentMatch.id]: choice,
    }));
    
    // Award 50 points for predicting!
    setXpPoints(prev => prev + 50);
  };

  const predictedCount = Object.keys(userPredictions).length;
  const level = Math.floor(xpPoints / 500) + 1;
  const nextLevelXp = level * 500;
  const prevLevelXp = (level - 1) * 500;
  const levelProgress = ((xpPoints - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0D0E0F] h-96">
        <ActivityIndicator size="large" color="#02DB54" />
        <Text className="text-gray-400 font-bold text-xs mt-3">Loading live predictions...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#0D0E0F] px-4 pt-4 mb-20" showsVerticalScrollIndicator={false}>
      
      {/* 1. GAMIFIED USER SCORE & RANK CARD */}
      <View className="bg-[#131415] border border-white/5 rounded-3xl p-5 mb-5 shadow-lg">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="bg-[#02DB54]/10 p-2.5 rounded-full border border-[#02DB54]/20">
              <Trophy size={20} color="#02DB54" />
            </View>
            <View>
              <Text className="text-white font-black text-sm tracking-wide">GOLD LEVEL {level}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">Rank: #2,342 (Top 5%)</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-[#02DB54] font-black text-lg">{xpPoints} XP</Text>
            <Text className="text-gray-400 text-[10px] font-bold">Accuracy: 72%</Text>
          </View>
        </View>

        {/* Level progress bar */}
        <View className="mt-4">
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-gray-400 text-[10px] font-bold">Level {level}</Text>
            <Text className="text-gray-400 text-[10px] font-bold">{xpPoints % 500}/500 XP to Level {level + 1}</Text>
          </View>
          <View className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <View style={{ width: `${levelProgress}%` }} className="h-full bg-[#02DB54]" />
          </View>
        </View>

        {/* Quick stats indicator row */}
        <View className="flex-row justify-between mt-4 pt-4 border-t border-white/5">
          <View className="items-center flex-1">
            <Text className="text-white font-extrabold text-sm">{predictedCount}/{matches.length}</Text>
            <Text className="text-gray-500 text-[9px] font-black uppercase mt-0.5">Predictions Made</Text>
          </View>
          <View className="w-[1px] bg-white/5" />
          <View className="items-center flex-1">
            <Text className="text-white font-extrabold text-sm">{predictedCount * 50} XP</Text>
            <Text className="text-gray-500 text-[9px] font-black uppercase mt-0.5">Earned Today</Text>
          </View>
          <View className="w-[1px] bg-white/5" />
          <View className="items-center flex-1">
            <Text className="text-[#02DB54] font-extrabold text-sm">Winner</Text>
            <Text className="text-gray-500 text-[9px] font-black uppercase mt-0.5">Mock Title</Text>
          </View>
        </View>
      </View>

      {/* 2. HORIZONTAL SELECTABLE MATCH CAROUSEL */}
      <Text className="text-white font-black text-sm tracking-widest uppercase mb-3 pl-1">
        Choose Match
      </Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-5 flex-row"
        contentContainerStyle={{ gap: 10, paddingBottom: 5 }}
      >
        {matches.map((match) => {
          const isActive = match.id === activeMatchId;
          const isPredicted = !!userPredictions[match.id];
          return (
            <TouchableOpacity
              key={match.id}
              onPress={() => {
                setActiveMatchId(match.id);
                // Reset details tab default for cleaner UI transitions
                setActiveDetailTab("ai");
              }}
              className={`bg-[#131415] border ${
                isActive ? "border-[#02DB54]" : "border-white/5"
              } rounded-2xl p-3 flex-row items-center gap-3 w-44`}
              activeOpacity={0.8}
            >
              <View className="flex-col gap-2 flex-1">
                <View className="flex-row items-center gap-1.5">
                  {match.home.logo ? (
                    <Image source={{ uri: match.home.logo }} className="w-5 h-5" />
                  ) : (
                    <View className="w-5 h-5 bg-white/10 rounded-full" />
                  )}
                  <Text className="text-white font-bold text-xs" numberOfLines={1}>
                    {match.home.short}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  {match.away.logo ? (
                    <Image source={{ uri: match.away.logo }} className="w-5 h-5" />
                  ) : (
                    <View className="w-5 h-5 bg-white/10 rounded-full" />
                  )}
                  <Text className="text-white font-bold text-xs" numberOfLines={1}>
                    {match.away.short}
                  </Text>
                </View>
              </View>

              {/* Selection indicators */}
              {isPredicted ? (
                <View className="bg-[#02DB54]/10 p-1.5 rounded-full border border-[#02DB54]/20">
                  <CheckCircle size={14} color="#02DB54" />
                </View>
              ) : (
                <View className="bg-white/5 p-1.5 rounded-full">
                  <HelpCircle size={14} color="#9BA1A6" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. INTERACTIVE MATCH VOTING CARD */}
      <View className="bg-[#131415] border border-white/5 rounded-3xl p-5 mb-5 shadow-lg">
        {/* League and title */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Sparkles size={16} color="#02DB54" />
            <Text className="text-[#02DB54] font-black text-[10px] tracking-widest uppercase">
              VOTE & PREDICT
            </Text>
          </View>
          <View className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-full max-w-[50%]">
            <Text className="text-gray-300 text-[9px] font-bold uppercase tracking-wider" numberOfLines={1}>
              {currentMatch.league}
            </Text>
          </View>
        </View>

        {/* Team Matchup illustration */}
        <View className="flex-row justify-between items-center my-4">
          <View className="items-center w-1/3">
            {currentMatch.home.logo ? (
              <Image source={{ uri: currentMatch.home.logo }} className="w-14 h-14" />
            ) : (
              <View className="w-14 h-14 bg-white/5 rounded-full items-center justify-center">
                <Text className="text-white font-bold text-lg">{currentMatch.home.short}</Text>
              </View>
            )}
            <Text className="text-white font-black text-xs mt-2 text-center" numberOfLines={2}>
              {currentMatch.home.name}
            </Text>
          </View>
          <View className="items-center w-1/3">
            <View className="bg-white/5 px-3 py-1 rounded-full border border-white/5">
              <Text className="text-gray-400 font-extrabold text-xs">VS</Text>
            </View>
            {hasPredictedCurrent && (
              <View className="bg-[#02DB54]/10 border border-[#02DB54]/20 px-2 py-0.5 rounded mt-2">
                <Text className="text-[#02DB54] font-bold text-[9px] uppercase tracking-widest">
                  Voted
                </Text>
              </View>
            )}
          </View>
          <View className="items-center w-1/3">
            {currentMatch.away.logo ? (
              <Image source={{ uri: currentMatch.away.logo }} className="w-14 h-14" />
            ) : (
              <View className="w-14 h-14 bg-white/5 rounded-full items-center justify-center">
                <Text className="text-white font-bold text-lg">{currentMatch.away.short}</Text>
              </View>
            )}
            <Text className="text-white font-black text-xs mt-2 text-center" numberOfLines={2}>
              {currentMatch.away.name}
            </Text>
          </View>
        </View>

        {/* Dynamic voting interaction layout */}
        {!hasPredictedCurrent ? (
          /* NOT VOTED: Render home, draw, away interactive prediction buttons */
          <View className="mt-4">
            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest text-center mb-3">
              Who will win? Predict to earn 50 XP
            </Text>
            <View className="flex-row justify-between gap-2.5">
              <TouchableOpacity
                onPress={() => handlePredict("home")}
                className="flex-1 bg-white/5 border border-white/5 active:border-[#02DB54] py-3.5 rounded-2xl items-center"
                activeOpacity={0.7}
              >
                <Text className="text-white font-extrabold text-xs text-center px-1" numberOfLines={1}>
                  {currentMatch.home.short} Win
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => handlePredict("draw")}
                className="flex-1 bg-white/5 border border-white/5 active:border-[#02DB54] py-3.5 rounded-2xl items-center"
                activeOpacity={0.7}
              >
                <Text className="text-white font-extrabold text-xs">Draw</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => handlePredict("away")}
                className="flex-1 bg-white/5 border border-white/5 active:border-[#02DB54] py-3.5 rounded-2xl items-center"
                activeOpacity={0.7}
              >
                <Text className="text-white font-extrabold text-xs text-center px-1" numberOfLines={1}>
                  {currentMatch.away.short} Win
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* VOTED: Render Fan consensus progress distributions */
          <View className="mt-4 pt-4 border-t border-white/5">
            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest text-center mb-3">
              Live Fan Consensus Poll
            </Text>
            
            <View className="flex-row justify-between mb-1.5 text-xs">
              <Text
                className={`font-black ${
                  selectedPrediction === "home" ? "text-[#02DB54]" : "text-white"
                }`}
              >
                {currentMatch.home.short} ({currentMatch.communityPoll.home}%)
                {selectedPrediction === "home" && " ✓"}
              </Text>
              
              <Text
                className={`font-black ${
                  selectedPrediction === "draw" ? "text-[#02DB54]" : "text-white"
                }`}
              >
                Draw ({currentMatch.communityPoll.draw}%)
                {selectedPrediction === "draw" && " ✓"}
              </Text>
              
              <Text
                className={`font-black ${
                  selectedPrediction === "away" ? "text-[#02DB54]" : "text-white"
                }`}
              >
                {currentMatch.away.short} ({currentMatch.communityPoll.away}%)
                {selectedPrediction === "away" && " ✓"}
              </Text>
            </View>

            {/* Combined color bar */}
            <View className="h-3 flex-row rounded-full overflow-hidden bg-white/5 border border-white/5">
              <View
                style={{ width: `${currentMatch.communityPoll.home}%` }}
                className={`h-full ${
                  selectedPrediction === "home" ? "bg-[#02DB54]" : "bg-gray-600"
                }`}
              />
              <View
                style={{ width: `${currentMatch.communityPoll.draw}%` }}
                className={`h-full ${
                  selectedPrediction === "draw" ? "bg-[#02DB54]" : "bg-gray-700"
                }`}
              />
              <View
                style={{ width: `${currentMatch.communityPoll.away}%` }}
                className={`h-full ${
                  selectedPrediction === "away" ? "bg-[#02DB54]" : "bg-gray-500"
                }`}
              />
            </View>
          </View>
        )}
      </View>

      {/* 4. INTERACTIVE INSIGHTS TAB (AI vs H2H) */}
      <View className="bg-[#131415] border border-white/5 rounded-3xl p-5 mb-10 shadow-lg">
        {/* Selector Tabs */}
        <View className="flex-row bg-[#0D0E0F] p-1 rounded-2xl border border-white/5 mb-4">
          <TouchableOpacity
            onPress={() => setActiveDetailTab("ai")}
            className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-2 ${
              activeDetailTab === "ai" ? "bg-[#131415] border border-white/5" : "bg-transparent"
            }`}
            activeOpacity={0.8}
          >
            <Sparkles size={14} color={activeDetailTab === "ai" ? "#02DB54" : "#9BA1A6"} />
            <Text
              className={`text-xs font-black ${
                activeDetailTab === "ai" ? "text-white" : "text-gray-400"
              }`}
            >
              AI Pick
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveDetailTab("h2h")}
            className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-2 ${
              activeDetailTab === "h2h" ? "bg-[#131415] border border-white/5" : "bg-transparent"
            }`}
            activeOpacity={0.8}
          >
            <TrendingUp size={14} color={activeDetailTab === "h2h" ? "#02DB54" : "#9BA1A6"} />
            <Text
              className={`text-xs font-black ${
                activeDetailTab === "h2h" ? "text-white" : "text-gray-400"
              }`}
            >
              H2H Stats
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: AI Probabilities and description */}
        {activeDetailTab === "ai" ? (
          <View>
            {/* Probability Bars */}
            <View className="mb-4">
              <View className="flex-row justify-between mb-1">
                <Text className="text-[#02DB54] text-[10px] font-extrabold uppercase">
                  {currentMatch.home.short} Win ({currentMatch.aiProbabilities.home}%)
                </Text>
                <Text className="text-gray-400 text-[10px] font-extrabold uppercase">
                  Draw ({currentMatch.aiProbabilities.draw}%)
                </Text>
                <Text className="text-yellow-500 text-[10px] font-extrabold uppercase">
                  {currentMatch.away.short} Win ({currentMatch.aiProbabilities.away}%)
                </Text>
              </View>
              <View className="h-2 flex-row rounded-full overflow-hidden bg-white/5 border border-white/5">
                <View style={{ width: `${currentMatch.aiProbabilities.home}%` }} className="bg-[#02DB54]" />
                <View style={{ width: `${currentMatch.aiProbabilities.draw}%` }} className="bg-gray-600" />
                <View style={{ width: `${currentMatch.aiProbabilities.away}%` }} className="bg-yellow-500" />
              </View>
            </View>

            {/* AI Verdict details */}
            <Text className="text-gray-300 text-xs leading-6">
              <Text className="font-extrabold text-[#02DB54] tracking-widest uppercase">
                AI Verdict:{" "}
              </Text>
              {currentMatch.aiVerdict}
            </Text>
          </View>
        ) : (
          /* Tab 2: H2H Statistics and past details */
          <View>
            {/* Head to head distribution */}
            <Text className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest text-center mb-3">
              Last 9 Matches Records
            </Text>
            
            <View className="flex-row justify-between mb-1.5 text-[10px] font-black uppercase text-gray-300">
              <Text>{currentMatch.home.short} Wins: {currentMatch.h2h.homeWins}</Text>
              <Text>Draws: {currentMatch.h2h.draws}</Text>
              <Text>{currentMatch.away.short} Wins: {currentMatch.h2h.awayWins}</Text>
            </View>

            <View className="h-2.5 flex-row rounded-full overflow-hidden bg-white/5 border border-white/5 mb-6">
              <View style={{ width: `${(currentMatch.h2h.homeWins / 9) * 100}%` }} className="bg-[#02DB54]" />
              <View style={{ width: `${(currentMatch.h2h.draws / 9) * 100}%` }} className="bg-gray-600" />
              <View style={{ width: `${(currentMatch.h2h.awayWins / 9) * 100}%` }} className="bg-yellow-500" />
            </View>

            {/* Other key metrics */}
            <View className="flex-row justify-between py-2.5 border-b border-white/5">
              <Text className="text-gray-400 text-xs font-bold">Average Goals per Match</Text>
              <Text className="text-white font-extrabold text-xs">{currentMatch.h2h.avgGoals}</Text>
            </View>

            <View className="flex-row justify-between py-2.5">
              <Text className="text-gray-400 text-xs font-bold">Clean Sheet Rate</Text>
              <Text className="text-white font-extrabold text-xs">
                {currentMatch.home.short} {currentMatch.h2h.cleanSheets.home}% | {currentMatch.h2h.cleanSheets.away}% {currentMatch.away.short}
              </Text>
            </View>
          </View>
        )}
      </View>

    </ScrollView>
  );
}
