import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  Sparkles,
  Trophy,
  CheckCircle,
  Clock,
  TrendingUp,
  Flame,
} from "lucide-react-native";
import {
  fetchFixturesByDate,
  fetchFixturePredictions,
  fetchFixtureH2H,
  formatFootballDate,
  getMatchValue,
  getTeamLogo,
  getMatchLeague,
  getMatchEventId,
  getMatchKickoffMs,
  formatKickoffLabel,
} from "../../services/footballApi";
import {
  loadMyPicks,
  settleMyPicks,
  computeStats,
  MyPicks,
  XP_REWARDS,
} from "../../services/myPredictions";
import MatchPrediction from "../details/MatchPrediction";

interface Team {
  id?: string | number;
  name: string;
  short: string;
  logo: string;
}

interface UpcomingMatch {
  id: string;
  league: string;
  leagueLogo?: string;
  home: Team;
  away: Team;
  kickoff: number; // ms
}

interface ModelPrediction {
  advice: string | null;
  percent: { home: number; draw: number; away: number };
  winner: string | null;
  winnerComment: string | null;
  comparison: { key: string; label: string; home: number; away: number }[];
}

interface PredictionViewProps {
  initialFixtures?: any[];
  isActive?: boolean;
}

const HOME_COLOR = "#02DB54";
const DRAW_COLOR = "#9CA3AF";
const AWAY_COLOR = "#60A5FA";
const MAX_MATCHES = 12;
const NOT_STARTED = new Set(["NS", "TBD"]);

// Fixtures that haven't kicked off yet, soonest first
const toUpcomingMatches = (fixtures: any[]): UpcomingMatch[] => {
  const seen = new Set<string>();
  const now = Date.now();
  const list: UpcomingMatch[] = [];

  for (const m of fixtures) {
    const id = String(getMatchEventId(m) || m?.id || "");
    const kickoff = getMatchKickoffMs(m);
    const status = String(m?.status || "").toUpperCase();
    if (!id || seen.has(id) || !kickoff || kickoff <= now || !NOT_STARTED.has(status)) continue;
    seen.add(id);

    const team = (side: "home" | "away"): Team => {
      const name = getMatchValue(m, [`${side}.name`, `${side}Team.name`], "") || (side === "home" ? "Home" : "Away");
      const short = getMatchValue(m, [`${side}.short`, `${side}.code`, `${side}Team.code`], "");
      return {
        id: m?.[side]?.id,
        name,
        short: short || name.substring(0, 3).toUpperCase(),
        logo: getTeamLogo(m, side),
      };
    };

    list.push({
      id,
      league: getMatchLeague(m) || "",
      leagueLogo: m?.leagueLogo,
      home: team("home"),
      away: team("away"),
      kickoff,
    });
  }
  return list.sort((a, b) => a.kickoff - b.kickoff).slice(0, MAX_MATCHES);
};

const TeamLogo = ({ team, size }: { team: Team; size: number }) =>
  team.logo ? (
    <Image source={{ uri: team.logo }} style={{ width: size, height: size }} resizeMode="contain" />
  ) : (
    <View
      className="bg-white/10 rounded-full items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text className="text-white font-bold text-[10px]">{team.short}</Text>
    </View>
  );

// Home / draw / away split shown as one bar with labels above it
const SplitBar = ({
  labels,
  values,
}: {
  labels: [string, string, string];
  values: [number, number, number];
}) => {
  const colors = [HOME_COLOR, DRAW_COLOR, AWAY_COLOR];
  return (
    <View>
      <View className="flex-row justify-between mb-1.5">
        {labels.map((label, i) => (
          <Text
            key={i}
            className={`text-[10px] font-extrabold uppercase flex-1 ${i === 1 ? "text-center" : i === 2 ? "text-right" : ""}`}
            style={{ color: colors[i] }}
            numberOfLines={1}
          >
            {label}
          </Text>
        ))}
      </View>
      <View className="h-2 flex-row rounded-full overflow-hidden bg-white/5">
        {values.map((v, i) => (v > 0 ? <View key={i} style={{ flex: v, backgroundColor: colors[i] }} /> : null))}
      </View>
    </View>
  );
};

function PredictionView({ initialFixtures, isActive }: PredictionViewProps) {
  const [matches, setMatches] = useState<UpcomingMatch[]>(() => toUpcomingMatches(initialFixtures || []));
  const [loadingMatches, setLoadingMatches] = useState(matches.length === 0);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(matches[0]?.id ?? null);
  const [myPicks, setMyPicks] = useState<MyPicks>({});
  const [activeDetailTab, setActiveDetailTab] = useState<"model" | "h2h">("model");
  const [model, setModel] = useState<ModelPrediction | null>(null);
  const [h2h, setH2h] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Upcoming fixtures: today's from the dashboard plus the next two days
  useEffect(() => {
    if (isActive === false) return;
    let cancelled = false;
    (async () => {
      const extra = await Promise.all(
        [0, 1, 2].map((offset) => fetchFixturesByDate(formatFootballDate(offset)).catch(() => [])),
      );
      if (cancelled) return;
      const upcoming = toUpcomingMatches([...(initialFixtures || []), ...extra.flat()]);
      setMatches(upcoming);
      setActiveMatchId((current) =>
        current && upcoming.some((m) => m.id === current) ? current : upcoming[0]?.id ?? null,
      );
      setLoadingMatches(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialFixtures, isActive]);

  // Picks can also be made from the match screen, so reload (and settle finished matches)
  // whenever this tab is opened
  const refreshPicks = useCallback(async () => {
    const picks = await loadMyPicks();
    setMyPicks(picks);
    setMyPicks(await settleMyPicks(picks));
  }, []);
  useEffect(() => {
    if (isActive !== false) refreshPicks();
  }, [isActive, refreshPicks]);

  const currentMatch = matches.find((m) => m.id === activeMatchId) || matches[0] || null;

  // Model prediction + head to head for the selected match
  const insightsFor = useRef<string | null>(null);
  useEffect(() => {
    if (isActive === false || !currentMatch) return;
    const matchId = currentMatch.id;
    insightsFor.current = matchId;
    setModel(null);
    setH2h(null);
    setLoadingInsights(true);
    Promise.all([
      fetchFixturePredictions(matchId).catch(() => null),
      currentMatch.home.id && currentMatch.away.id
        ? fetchFixtureH2H(currentMatch.home.id, currentMatch.away.id).catch(() => null)
        : Promise.resolve(null),
    ]).then(([modelData, h2hData]) => {
      if (insightsFor.current !== matchId) return;
      // Older backends answered with a mock object without `comparison`; don't show those numbers
      setModel(modelData && Array.isArray(modelData.comparison) ? modelData : null);
      setH2h(h2hData && h2hData.totalMatches ? h2hData : null);
      setLoadingInsights(false);
    });
  }, [currentMatch?.id]);

  const stats = useMemo(() => computeStats(myPicks), [myPicks]);
  const levelProgress = (stats.levelXp / stats.xpPerLevel) * 100;

  return (
    <ScrollView
      className="flex-1 bg-[#0D0E0F] px-4 pt-4"
      contentContainerStyle={{ paddingBottom: 150 }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. YOUR PREDICTION RECORD */}
      <View className="bg-[#131415] border border-white/5 rounded-3xl p-5 mb-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="bg-[#02DB54]/10 p-2.5 rounded-full border border-[#02DB54]/20">
              <Trophy size={20} color="#02DB54" />
            </View>
            <View>
              <Text className="text-white font-black text-sm tracking-wide uppercase">
                {stats.tier} · Level {stats.level}
              </Text>
              <Text className="text-gray-400 text-xs mt-0.5">
                {stats.accuracy === null
                  ? stats.total > 0
                    ? "Accuracy shows after your first result"
                    : "Make your first pick below"
                  : `Accuracy ${stats.accuracy}% (${stats.correct}/${stats.settled})`}
              </Text>
            </View>
          </View>
          <Text className="text-[#02DB54] font-black text-lg">{stats.xp} XP</Text>
        </View>

        <View className="mt-4">
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-gray-400 text-[10px] font-bold">Level {stats.level}</Text>
            <Text className="text-gray-400 text-[10px] font-bold">
              {stats.levelXp}/{stats.xpPerLevel} XP to Level {stats.level + 1}
            </Text>
          </View>
          <View className="h-2.5 bg-white/5 rounded-full overflow-hidden">
            <View style={{ width: `${levelProgress}%` }} className="h-full bg-[#02DB54] rounded-full" />
          </View>
          <Text className="text-gray-500 text-[10px] font-bold mt-2">
            +{XP_REWARDS.pick} XP per pick · +{XP_REWARDS.correct} XP when you're right
          </Text>
        </View>

        <View className="flex-row justify-between mt-4 pt-4 border-t border-white/5">
          {[
            { value: stats.total, label: "Picks" },
            { value: stats.correct, label: "Correct" },
            { value: stats.pending, label: "Pending" },
            { value: stats.streak, label: "Streak", icon: stats.streak > 1 },
          ].map((item, i) => (
            <View key={item.label} className={`items-center flex-1 ${i > 0 ? "border-l border-white/5" : ""}`}>
              <View className="flex-row items-center gap-1">
                {item.icon ? <Flame size={13} color="#F97316" /> : null}
                <Text className="text-white font-extrabold text-sm">{item.value}</Text>
              </View>
              <Text className="text-gray-500 text-[9px] font-black uppercase mt-0.5">{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 2. UPCOMING MATCH CAROUSEL */}
      <Text className="text-white font-black text-sm tracking-widest uppercase mb-3 pl-1">
        Upcoming Matches
      </Text>

      {loadingMatches ? (
        <ActivityIndicator color="#02DB54" className="my-8" />
      ) : !currentMatch ? (
        <View className="py-12 px-4 items-center justify-center bg-[#131415] rounded-3xl border border-white/5 mb-5">
          <Text className="text-[#02DB54] font-black text-sm mb-1">No Upcoming Matches</Text>
          <Text className="text-gray-400 font-bold text-xs text-center">
            Check back later — fixtures for the next few days will appear here.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-5"
            contentContainerStyle={{ gap: 10, paddingBottom: 5 }}
          >
            {matches.map((match) => {
              const isSelected = match.id === currentMatch.id;
              const isPicked = !!myPicks[match.id];
              return (
                <TouchableOpacity
                  key={match.id}
                  onPress={() => {
                    setActiveMatchId(match.id);
                    setActiveDetailTab("model");
                  }}
                  className={`bg-[#131415] border ${isSelected ? "border-[#02DB54]" : "border-white/5"} rounded-2xl p-3 w-44`}
                  activeOpacity={0.8}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-1">
                      <Clock size={10} color="#9BA1A6" />
                      <Text className="text-gray-400 text-[10px] font-bold">{formatKickoffLabel(match.kickoff)}</Text>
                    </View>
                    {isPicked ? <CheckCircle size={14} color="#02DB54" /> : null}
                  </View>
                  {[match.home, match.away].map((team, i) => (
                    <View key={i} className={`flex-row items-center gap-1.5 ${i === 0 ? "mb-1.5" : ""}`}>
                      <TeamLogo team={team} size={18} />
                      <Text className="text-white font-bold text-xs flex-1" numberOfLines={1}>
                        {team.name}
                      </Text>
                    </View>
                  ))}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 3. SELECTED MATCH */}
          <View className="bg-[#131415] border border-white/5 rounded-3xl p-5 mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2 flex-1">
                {currentMatch.leagueLogo ? (
                  <Image source={{ uri: currentMatch.leagueLogo }} className="w-4 h-4" resizeMode="contain" />
                ) : null}
                <Text className="text-gray-300 text-[10px] font-bold uppercase tracking-wider flex-1" numberOfLines={1}>
                  {currentMatch.league}
                </Text>
              </View>
              <Text className="text-gray-400 text-[10px] font-bold">{formatKickoffLabel(currentMatch.kickoff)}</Text>
            </View>
            <View className="flex-row justify-between items-center mt-3">
              {[currentMatch.home, currentMatch.away].map((team, i) => (
                <React.Fragment key={i}>
                  {i === 1 ? (
                    <View className="bg-white/5 px-3 py-1 rounded-full border border-white/5">
                      <Text className="text-gray-400 font-extrabold text-xs">VS</Text>
                    </View>
                  ) : null}
                  <View className="items-center w-[38%]">
                    <TeamLogo team={team} size={52} />
                    <Text className="text-white font-black text-xs mt-2 text-center" numberOfLines={2}>
                      {team.name}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Community vote (same poll as the match screen) */}
          <MatchPrediction
            key={currentMatch.id}
            matchId={currentMatch.id}
            home={currentMatch.home}
            away={currentMatch.away}
            score="VS"
            isUpcoming
            isFinished={false}
            kickoff={currentMatch.kickoff}
            onVote={refreshPicks}
          />

          {/* 4. INSIGHTS: MODEL PICK / HEAD TO HEAD */}
          <View className="bg-[#131415] border border-white/5 rounded-3xl p-5 mb-10">
            <View className="flex-row bg-[#0D0E0F] p-1 rounded-2xl border border-white/5 mb-4">
              {(
                [
                  { id: "model", label: "Model Pick", Icon: Sparkles },
                  { id: "h2h", label: "Head to Head", Icon: TrendingUp },
                ] as const
              ).map(({ id, label, Icon }) => {
                const selected = activeDetailTab === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setActiveDetailTab(id)}
                    className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-2 ${selected ? "bg-[#131415] border border-white/5" : ""}`}
                    activeOpacity={0.8}
                  >
                    <Icon size={14} color={selected ? "#02DB54" : "#9BA1A6"} />
                    <Text className={`text-xs font-black ${selected ? "text-white" : "text-gray-400"}`}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {loadingInsights ? (
              <ActivityIndicator color="#02DB54" className="my-6" />
            ) : activeDetailTab === "model" ? (
              !model ? (
                <Text className="text-gray-400 text-xs font-bold text-center py-6">
                  No model prediction is available for this match yet.
                </Text>
              ) : (
                <View>
                  <SplitBar
                    labels={[
                      `${currentMatch.home.short} ${model.percent.home}%`,
                      `Draw ${model.percent.draw}%`,
                      `${currentMatch.away.short} ${model.percent.away}%`,
                    ]}
                    values={[model.percent.home, model.percent.draw, model.percent.away]}
                  />

                  {model.winner || model.advice ? (
                    <View className="bg-[#02DB54]/10 border border-[#02DB54]/20 rounded-2xl p-3 mt-4">
                      {model.winner ? (
                        <Text className="text-white text-xs font-extrabold">
                          Favourite: <Text className="text-[#02DB54]">{model.winner}</Text>
                          {model.winnerComment ? <Text className="text-gray-400"> ({model.winnerComment})</Text> : null}
                        </Text>
                      ) : null}
                      {model.advice ? (
                        <Text className="text-gray-300 text-xs mt-1">{model.advice}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {model.comparison.length > 0 ? (
                    <View className="mt-4">
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-[10px] font-black" style={{ color: HOME_COLOR }}>{currentMatch.home.short}</Text>
                        <Text className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Comparison</Text>
                        <Text className="text-[10px] font-black" style={{ color: AWAY_COLOR }}>{currentMatch.away.short}</Text>
                      </View>
                      {model.comparison.map((row) => (
                        <View key={row.key} className="mb-2.5">
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-white text-[11px] font-bold">{Math.round(row.home)}%</Text>
                            <Text className="text-gray-400 text-[11px] font-bold">{row.label}</Text>
                            <Text className="text-white text-[11px] font-bold">{Math.round(row.away)}%</Text>
                          </View>
                          <View className="h-1.5 flex-row rounded-full overflow-hidden bg-white/5">
                            <View style={{ flex: Math.max(row.home, 0.1), backgroundColor: HOME_COLOR }} />
                            <View style={{ flex: Math.max(row.away, 0.1), backgroundColor: AWAY_COLOR }} />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text className="text-gray-600 text-[10px] font-bold mt-2">
                    Statistical model based on form, goals and head-to-head record.
                  </Text>
                </View>
              )
            ) : !h2h ? (
              <Text className="text-gray-400 text-xs font-bold text-center py-6">
                These teams have no head-to-head record yet.
              </Text>
            ) : (
              <View>
                <Text className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest text-center mb-3">
                  Last {h2h.totalMatches} meetings
                </Text>
                <SplitBar
                  labels={[
                    `${currentMatch.home.short} ${h2h.homeWins}`,
                    `Draws ${h2h.draws}`,
                    `${currentMatch.away.short} ${h2h.awayWins}`,
                  ]}
                  values={[h2h.homeWins, h2h.draws, h2h.awayWins]}
                />

                {h2h.avgGoals != null ? (
                  <View className="flex-row justify-between py-2.5 border-b border-white/5 mt-4">
                    <Text className="text-gray-400 text-xs font-bold">Average goals per match</Text>
                    <Text className="text-white font-extrabold text-xs">{h2h.avgGoals}</Text>
                  </View>
                ) : null}
                {h2h.cleanSheets?.home != null ? (
                  <View className="flex-row justify-between py-2.5 border-b border-white/5">
                    <Text className="text-gray-400 text-xs font-bold">Clean sheets</Text>
                    <Text className="text-white font-extrabold text-xs">
                      {currentMatch.home.short} {h2h.cleanSheets.home}% · {h2h.cleanSheets.away}% {currentMatch.away.short}
                    </Text>
                  </View>
                ) : null}

                {(h2h.matches || []).map((m: any, idx: number) => (
                  <View key={m.id || idx} className="flex-row items-center py-2.5 border-b border-white/5">
                    <Text className="text-gray-500 text-[10px] font-bold w-[72px]" numberOfLines={1}>
                      {m.date}
                    </Text>
                    <Text className="text-white text-xs font-bold flex-1 text-right" numberOfLines={1}>
                      {m.home?.name}
                    </Text>
                    <Text className="text-white text-xs font-black mx-2">
                      {m.home?.score ?? 0} - {m.away?.score ?? 0}
                    </Text>
                    <Text className="text-white text-xs font-bold flex-1" numberOfLines={1}>
                      {m.away?.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

export default React.memo(PredictionView);
