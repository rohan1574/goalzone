import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { ArrowLeft, Clock } from "lucide-react-native";
import {
  fetchLeagueStandings,
  fetchLeagueFixtures,
  getMatchKickoffMs,
  formatKickoffLabel,
} from "../../services/footballApi";
import RemoteLogo from "../common/RemoteLogo";

export interface League {
  id: string;
  name: string;
  logo: string;
  category: string;
}

interface LeagueDetailsModalProps {
  visible: boolean;
  league: League | null;
  onClose: () => void;
  onPressDetails?: (match: any) => void;
}

interface FixtureRow {
  id: string;
  status: string;
  score: string;
  kickoff: number | null;
  home: { id?: string | number; name: string; logo: string; short: string };
  away: { id?: string | number; name: string; logo: string; short: string };
}

interface TableRow {
  pos: number;
  name: string;
  logo: string;
  pl: number;
  w: number | null;
  d: number | null;
  l: number | null;
  gd: string;
  pts: number;
  form: string;
  zone: string;
  group?: string;
}

const FINISHED = new Set(["FT", "AET", "PEN"]);
const NOT_STARTED = new Set(["NS", "TBD"]);
const POSTPONED = new Set(["PST", "CANC", "ABD", "SUSP"]);

// Colour for a standings zone, from API-Football's "description" text
const zoneColor = (zone: string) => {
  const z = zone.toLowerCase();
  if (!z) return null;
  if (z.includes("relegation")) return "#EF4444";
  if (z.includes("champions league") || z.includes("libertadores")) return "#02DB54";
  if (z.includes("europa league") || z.includes("sudamericana")) return "#60A5FA";
  if (z.includes("conference") || z.includes("ecl")) return "#2DD4BF";
  if (z.includes("promotion") || z.includes("play")) return "#EAB308";
  return "#9CA3AF";
};

const FORM_COLORS: Record<string, string> = { W: "#02DB54", D: "#9CA3AF", L: "#EF4444" };

const toTeam = (obj: any) => {
  const name = obj?.name || obj?.teamName || "TBD";
  const id = obj?.id || obj?.teamId;
  return {
    id,
    name,
    logo: obj?.logo || obj?.teamLogo || obj?.logoUrl || (id ? `https://media.api-sports.io/football/teams/${id}.png` : ""),
    short: name.substring(0, 3).toUpperCase(),
  };
};

const mapFixtures = (raw: any[]): FixtureRow[] =>
  raw.map((m: any, idx: number) => ({
    id: String(m.id || m.fixture?.id || `fix-${idx}`),
    status: String(m.status || m.fixture?.status?.short || "NS").toUpperCase(),
    score: m.score || (m.goals ? `${m.goals.home ?? 0} - ${m.goals.away ?? 0}` : "VS"),
    kickoff: getMatchKickoffMs(m),
    home: toTeam(m.home || m.teams?.home || m.homeTeam),
    away: toTeam(m.away || m.teams?.away || m.awayTeam),
  }));

const mapTable = (raw: any[]): TableRow[] =>
  raw.map((item: any, idx: number) => {
    const teamObj = item.team || item;
    return {
      pos: item.pos || item.position || item.rank || idx + 1,
      name: teamObj.name || teamObj.teamName || "Team",
      logo: teamObj.logo || teamObj.teamLogo || teamObj.logoUrl || "",
      pl: item.pl ?? item.played ?? item.all?.played ?? 0,
      w: item.win ?? item.all?.win ?? null,
      d: item.draw ?? item.all?.draw ?? null,
      l: item.lose ?? item.all?.lose ?? null,
      gd: String(item.gd ?? item.goalsDiff ?? item.goalDiff ?? item.all?.goalsDiff ?? 0),
      pts: item.pts ?? item.points ?? 0,
      form: String(item.form || "").slice(-5),
      zone: item.description || "",
      group: item.group || "",
    };
  });

export default function LeagueDetailsModal({
  visible,
  league,
  onClose,
  onPressDetails,
}: LeagueDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"fixtures" | "table">("fixtures");
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [table, setTable] = useState<TableRow[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);

  // Drop responses for a league the user has already closed / switched away from
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!visible || !league) return;
    const leagueId = league.id;
    loadedFor.current = leagueId;
    setActiveTab("fixtures");
    setFixtures([]);
    setTable([]);
    setLoadingFixtures(true);
    setLoadingTable(true);

    fetchLeagueFixtures(leagueId)
      .then((raw) => {
        if (loadedFor.current === leagueId) setFixtures(mapFixtures(raw || []));
      })
      .catch(() => {})
      .finally(() => {
        if (loadedFor.current === leagueId) setLoadingFixtures(false);
      });

    fetchLeagueStandings(leagueId)
      .then((raw) => {
        if (loadedFor.current === leagueId) setTable(mapTable(raw || []));
      })
      .catch(() => {})
      .finally(() => {
        if (loadedFor.current === leagueId) setLoadingTable(false);
      });
  }, [visible, league?.id]);

  if (!league) return null;

  const openMatch = (match: FixtureRow) => {
    if (!onPressDetails) return;
    onPressDetails({
      id: match.id,
      league: league.name,
      leagueId: league.id,
      leagueLogo: league.logo,
      home: match.home,
      away: match.away,
      score: NOT_STARTED.has(match.status) ? "VS" : match.score,
      minute: match.status,
      status: match.status,
      timestamp: match.kickoff ? Math.floor(match.kickoff / 1000) : undefined,
    });
  };

  const zones = Array.from(new Set(table.map((r) => r.zone).filter(Boolean)));
  const hasWdl = table.some((r) => r.w !== null);

  const groupedTable = useMemo(() => {
    const groups: { [key: string]: TableRow[] } = {};
    const hasDistinctGroups = new Set(table.map((r) => r.group).filter(Boolean)).size > 1;

    if (!hasDistinctGroups) {
      return [{ title: "", rows: table }];
    }

    table.forEach((row) => {
      const g = row.group || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(row);
    });

    return Object.entries(groups).map(([title, rows]) => ({ title, rows }));
  }, [table]);

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3.5 border-b border-[#ffffff05]">
          <TouchableOpacity onPress={onClose} className="p-1">
            <ArrowLeft size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <View className="flex-1 flex-row items-center justify-center gap-2.5 px-2">
            <RemoteLogo uri={league.logo} label={league.name} size={30} plate />
            <View className="flex-shrink">
              <Text className="text-white text-lg font-black" numberOfLines={1}>{league.name}</Text>
              {league.category ? (
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider" numberOfLines={1}>
                  {league.category}
                </Text>
              ) : null}
            </View>
          </View>
          <View className="w-8" />
        </View>

        {/* Tabs */}
        <View className="flex-row bg-[#131415] rounded-3xl mx-4 my-4 p-1 border border-white/5">
          {(["fixtures", "table"] as const).map((tab) => {
            const selected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${selected ? "bg-[#02DB54]/10 border border-[#02DB54]" : ""}`}
              >
                <Text className={`text-sm font-black ${selected ? "text-white" : "text-[#9BA1A6]"}`}>
                  {tab === "fixtures" ? "Fixtures" : "Table"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {activeTab === "fixtures" ? (
            loadingFixtures ? (
              <ActivityIndicator size="small" color="#02DB54" className="py-10" />
            ) : fixtures.length === 0 ? (
              <View className="py-12 px-4 items-center bg-[#131415] rounded-3xl border border-white/5">
                <Text className="text-[#02DB54] font-black text-sm mb-1">No Upcoming Fixtures</Text>
                <Text className="text-gray-400 font-bold text-xs text-center">
                  This competition has no scheduled matches right now.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {fixtures.map((match) => {
                  const finished = FINISHED.has(match.status);
                  const live = !finished && !NOT_STARTED.has(match.status) && !POSTPONED.has(match.status);
                  const statusLabel = finished
                    ? match.status
                    : POSTPONED.has(match.status)
                    ? "Postponed"
                    : live
                    ? "Live"
                    : "Upcoming";
                  return (
                    <TouchableOpacity
                      key={match.id}
                      activeOpacity={0.7}
                      onPress={() => openMatch(match)}
                      disabled={!onPressDetails}
                      className="relative bg-[#131415] rounded-3xl px-4 py-4 border border-white/5 overflow-hidden flex-row items-center"
                    >
                      <View className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#02DB54] rounded-l-3xl" />

                      <View className="w-[30%] pr-2">
                        <Text
                          className={`text-[10px] font-black uppercase tracking-wider mb-1 ${live ? "text-red-400" : "text-[#9BA1A6]"}`}
                        >
                          {statusLabel}
                        </Text>
                        {finished || live ? (
                          <Text className="text-white text-base font-black">{match.score}</Text>
                        ) : match.kickoff ? (
                          <View className="flex-row items-center gap-1">
                            <Clock size={10} color="#9BA1A6" />
                            <Text className="text-white text-[11px] font-bold flex-shrink" numberOfLines={2}>
                              {formatKickoffLabel(match.kickoff)}
                            </Text>
                          </View>
                        ) : (
                          <Text className="text-white text-xs font-bold">TBD</Text>
                        )}
                      </View>

                      <View className="w-[1px] h-10 bg-white/10" />

                      <View className="flex-1 pl-3 gap-2">
                        {[match.home, match.away].map((team, i) => (
                          <View key={i} className="flex-row items-center gap-2.5">
                            {team.logo ? (
                              <Image source={{ uri: team.logo }} className="w-6 h-6" resizeMode="contain" />
                            ) : (
                              <View className="w-6 h-6 rounded-full bg-white/10" />
                            )}
                            <Text className="text-white text-sm font-extrabold flex-1" numberOfLines={1}>
                              {team.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          ) : loadingTable ? (
            <ActivityIndicator size="small" color="#02DB54" className="py-10" />
          ) : table.length === 0 ? (
            <View className="py-12 px-4 items-center bg-[#131415] rounded-3xl border border-white/5">
              <Text className="text-[#02DB54] font-black text-sm mb-1">No Table Available</Text>
              <Text className="text-gray-400 font-bold text-xs text-center">
                Standings aren't available for this competition.
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {groupedTable.map((group, gIdx) => (
                <View key={group.title || `group-${gIdx}`} className="bg-[#131415] rounded-3xl p-3 border border-white/5">
                  {group.title ? (
                    <View className="flex-row items-center gap-2 pb-2 mb-1.5 border-b border-white/10">
                      <View className="w-2 h-2 rounded-full bg-[#02DB54]" />
                      <Text className="text-[#02DB54] font-black text-xs uppercase tracking-wider">
                        {group.title}
                      </Text>
                    </View>
                  ) : null}

                  <View className="flex-row border-b border-white/10 pb-2 mb-1 items-center">
                    <Text className="text-[#9BA1A6] font-bold text-[11px] text-center w-7">#</Text>
                    <Text className="text-[#9BA1A6] font-bold text-[11px] flex-1 ml-1">Team</Text>
                    {(hasWdl ? ["P", "W", "D", "L", "GD"] : ["P", "GD"]).map((h) => (
                      <Text key={h} className="text-[#9BA1A6] font-bold text-[11px] text-center w-7">{h}</Text>
                    ))}
                    <Text className="text-[#9BA1A6] font-bold text-[11px] text-center w-9">PTS</Text>
                  </View>

                  {group.rows.map((row, idx) => {
                    const color = zoneColor(row.zone);
                    return (
                      <View key={`${row.pos}-${row.name}-${idx}`} className="py-2 border-b border-white/5">
                        <View className="flex-row items-center">
                          <View className="w-7 items-center">
                            <Text
                              className="font-black text-xs"
                              style={{ color: color || "#FFFFFF" }}
                            >
                              {row.pos}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2 flex-1 ml-1">
                            {row.logo ? <Image source={{ uri: row.logo }} className="w-5 h-5" resizeMode="contain" /> : null}
                            <Text className="text-white text-xs font-extrabold flex-1" numberOfLines={1}>{row.name}</Text>
                          </View>
                          {(hasWdl ? [row.pl, row.w, row.d, row.l, row.gd] : [row.pl, row.gd]).map((v, i) => (
                            <Text key={i} className="text-gray-300 text-xs font-bold text-center w-7">{v ?? "-"}</Text>
                          ))}
                          <Text className="text-white text-xs font-black text-center w-9">{row.pts}</Text>
                        </View>
                        {row.form ? (
                          <View className="flex-row gap-1 mt-1.5 ml-[34px]">
                            {row.form.split("").map((r, i) => (
                              <View
                                key={i}
                                className="w-4 h-4 rounded items-center justify-center"
                                style={{ backgroundColor: FORM_COLORS[r] || "#374151" }}
                              >
                                <Text className="text-black text-[8px] font-black">{r}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}

              {zones.length > 0 ? (
                <View className="bg-[#131415] rounded-3xl p-3 border border-white/5 gap-1.5 px-3">
                  {zones.map((zone) => (
                    <View key={zone} className="flex-row items-center gap-2">
                      <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zoneColor(zone) || "#9CA3AF" }} />
                      <Text className="text-gray-400 text-[10px] font-bold flex-1">{zone}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
