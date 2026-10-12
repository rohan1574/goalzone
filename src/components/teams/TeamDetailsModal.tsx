import { ArrowLeft, Clock } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchTeamByCountry,
  fetchTeamFixtures,
  fetchTeamSquad,
  formatKickoffLabel,
  getMatchKickoffMs,
} from "../../services/footballApi";
import RemoteLogo from "../common/RemoteLogo";

export interface Team {
  id: string;
  name: string;
  logo: string;
  category: string;
  country: string;
}

interface TeamDetailsModalProps {
  visible: boolean;
  team: Team | null;
  onClose: () => void;
  onPressDetails?: (match: any) => void;
}

interface SquadPlayer {
  id?: number;
  name: string;
  number: number | null;
  age: number | null;
  photo: string | null;
}

const NOT_STARTED = new Set(["NS", "TBD"]);
const FINISHED = new Set(["FT", "AET", "PEN"]);
const RESULT_COLORS: Record<string, string> = { W: "#02DB54", D: "#9CA3AF", L: "#EF4444" };

// Older backends return squad players as plain names
const toPlayer = (p: any): SquadPlayer =>
  typeof p === "string"
    ? { name: p, number: null, age: null, photo: null }
    : { id: p.id, name: p.name, number: p.number ?? null, age: p.age ?? null, photo: p.photo ?? null };

const PlayerPhoto = ({ player }: { player: SquadPlayer }) => {
  const [failed, setFailed] = useState(false);
  if (!player.photo || failed) {
    return (
      <View className="w-9 h-9 rounded-full bg-white/10 items-center justify-center">
        <Text className="text-white font-black text-[10px]">{player.number ?? "–"}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: player.photo }}
      className="w-9 h-9 rounded-full bg-[#1E293B]"
      onError={() => setFailed(true)}
    />
  );
};

export default function TeamDetailsModal({
  visible,
  team,
  onClose,
  onPressDetails,
}: TeamDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"fixtures" | "squad">("fixtures");
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [squad, setSquad] = useState<{ position: string; players: SquadPlayer[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [teamId, setTeamId] = useState<string | number | null>(null);

  // Drop responses for a team the user has already left
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!visible || !team) return;
    const key = team.id;
    loadedFor.current = key;
    setActiveTab("fixtures");
    setFixtures([]);
    setSquad([]);
    setNotFound(false);
    setTeamId(null);
    setLoading(true);

    (async () => {
      try {
        let resolvedId: string | number = team.id;
        // National teams are listed by country name; look up the actual team id
        if (isNaN(Number(resolvedId))) {
          const teamInfo = await fetchTeamByCountry(team.country || team.id);
          if (!teamInfo?.id) {
            if (loadedFor.current === key) setNotFound(true);
            return;
          }
          resolvedId = teamInfo.id;
        }
        const [fixturesData, squadData] = await Promise.all([
          fetchTeamFixtures(resolvedId),
          fetchTeamSquad(resolvedId),
        ]);
        if (loadedFor.current !== key) return;
        setTeamId(resolvedId);
        setFixtures(fixturesData || []);
        setSquad(
          (squadData || [])
            .map((section: any) => ({
              position: section.position,
              players: (section.players || []).map(toPlayer),
            }))
            .filter((section: any) => section.players.length > 0),
        );
      } catch (err) {
        console.error("Error loading team details:", err);
      } finally {
        if (loadedFor.current === key) setLoading(false);
      }
    })();
  }, [visible, team?.id]);

  if (!team) return null;

  // Team fixtures from older backends only carry the opponent; rebuild both sides
  const sidesOf = (match: any) => {
    const self = { id: teamId ?? undefined, name: team.name, logo: team.logo };
    const opponent = { name: match.opponent || "TBD", logo: match.opponentLogo || "" };
    const home = match.home?.name ? match.home : match.isHome ? self : opponent;
    const away = match.away?.name ? match.away : match.isHome ? opponent : self;
    return { home, away };
  };

  const openMatch = (match: any) => {
    if (!onPressDetails) return;
    const { home, away } = sidesOf(match);
    const short = (name: string) => name.substring(0, 3).toUpperCase();
    onPressDetails({
      id: String(match.id),
      league: match.league || "",
      leagueId: match.leagueId,
      leagueLogo: match.leagueLogo,
      home: { ...home, short: short(home.name) },
      away: { ...away, short: short(away.name) },
      score: FINISHED.has(String(match.status).toUpperCase()) ? match.score : "VS",
      minute: match.status || "NS",
      status: match.status || "NS",
      timestamp: match.timestamp,
    });
  };

  const playerCount = squad.reduce((n, s) => n + s.players.length, 0);

  // W / D / L from this team's point of view
  const resultFor = (match: any) => {
    const [h, a] = String(match.score || "").split("-").map((x) => parseInt(x.trim(), 10));
    if (isNaN(h) || isNaN(a)) return null;
    const { home } = sidesOf(match);
    const isHomeSide = match.isHome ?? home.name === team.name;
    const diff = isHomeSide ? h - a : a - h;
    return diff > 0 ? "W" : diff < 0 ? "L" : "D";
  };

  const renderFixture = (match: any) => {
    const { home, away } = sidesOf(match);
    const kickoff = getMatchKickoffMs(match);
    const status = String(match.status || "NS").toUpperCase();
    const finished = FINISHED.has(status);
    const result = finished ? resultFor(match) : null;
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
          <Text className="text-[#9BA1A6] text-[10px] font-black uppercase mb-1" numberOfLines={1}>
            {match.league || (NOT_STARTED.has(status) ? "Upcoming" : status)}
          </Text>
          {finished ? (
            <View className="flex-row items-center gap-2">
              <Text className="text-white text-base font-black">{match.score}</Text>
              {result ? (
                <View className="w-5 h-5 rounded items-center justify-center" style={{ backgroundColor: RESULT_COLORS[result] }}>
                  <Text className="text-black text-[10px] font-black">{result}</Text>
                </View>
              ) : null}
            </View>
          ) : kickoff ? (
            <View className="flex-row items-center gap-1">
              <Clock size={10} color="#9BA1A6" />
              <Text className="text-white text-[11px] font-bold flex-shrink" numberOfLines={2}>
                {formatKickoffLabel(kickoff)}
              </Text>
            </View>
          ) : (
            <Text className="text-white text-xs font-bold">TBD</Text>
          )}
          {finished && kickoff ? (
            <Text className="text-gray-500 text-[10px] font-bold mt-1">
              {new Date(kickoff).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          ) : null}
        </View>

        <View className="w-[1px] h-10 bg-white/10" />

        <View className="flex-1 pl-3 gap-2">
          {[home, away].map((side: any, i) => (
            <View key={i} className="flex-row items-center gap-2.5">
              <RemoteLogo uri={side.logo} label={side.name} size={24} />
              <Text
                className={`text-sm font-extrabold flex-1 ${side.name === team.name ? "text-white" : "text-gray-300"}`}
                numberOfLines={1}
              >
                {side.name}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3.5 border-b border-[#ffffff05]">
          <TouchableOpacity onPress={onClose} className="p-1">
            <ArrowLeft size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <View className="flex-1 flex-row items-center justify-center gap-2.5 px-2">
            <RemoteLogo uri={team.logo} label={team.name} size={28} />
            <View className="flex-shrink">
              <Text className="text-white text-lg font-black" numberOfLines={1}>{team.name}</Text>
              <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">National team</Text>
            </View>
          </View>
          <View className="w-8" />
        </View>

        {/* Tabs */}
        <View className="flex-row bg-[#131415] rounded-3xl mx-4 my-4 p-1 border border-white/5">
          {(["fixtures", "squad"] as const).map((tab) => {
            const selected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${selected ? "bg-[#02DB54]/10 border border-[#02DB54]" : ""}`}
              >
                <Text className={`text-sm font-black ${selected ? "text-white" : "text-[#9BA1A6]"}`}>
                  {tab === "fixtures" ? "Fixtures" : playerCount ? `Squad (${playerCount})` : "Squad"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {loading ? (
            <View className="items-center justify-center py-10">
              <ActivityIndicator size="large" color="#02DB54" />
              <Text className="text-gray-400 text-xs font-bold mt-3">Loading details...</Text>
            </View>
          ) : notFound ? (
            <View className="py-12 px-4 items-center bg-[#131415] rounded-3xl border border-white/5">
              <Text className="text-[#02DB54] font-black text-sm mb-1">Team Not Found</Text>
              <Text className="text-gray-400 font-bold text-xs text-center">
                We couldn't find national team data for {team.name}.
              </Text>
            </View>
          ) : activeTab === "fixtures" ? (
            fixtures.length === 0 ? (
              <View className="py-12 px-4 items-center bg-[#131415] rounded-3xl border border-white/5">
                <Text className="text-[#02DB54] font-black text-sm mb-1">No Fixtures</Text>
                <Text className="text-gray-400 font-bold text-xs text-center">
                  There are no recent or scheduled matches for {team.name}.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {[
                  { title: "Upcoming", list: fixtures.filter((m) => !FINISHED.has(String(m.status).toUpperCase())) },
                  { title: "Recent results", list: fixtures.filter((m) => FINISHED.has(String(m.status).toUpperCase())) },
                ]
                  .filter((group) => group.list.length > 0)
                  .map((group) => (
                    <View key={group.title} className="gap-3">
                      <Text className="text-white text-sm font-black mt-1">{group.title}</Text>
                      {group.list.map((match) => renderFixture(match))}
                    </View>
                  ))}
              </View>
            )
          ) : squad.length === 0 ? (
            <View className="py-12 px-4 items-center bg-[#131415] rounded-3xl border border-white/5">
              <Text className="text-[#02DB54] font-black text-sm mb-1">No Squad Data</Text>
              <Text className="text-gray-400 font-bold text-xs text-center">
                The current squad for {team.name} isn't available.
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {squad.map((section) => (
                <View key={section.position} className="bg-[#131415] rounded-3xl p-4 border border-white/5">
                  <Text className="text-[#02DB54] font-black text-xs uppercase tracking-wider mb-3">
                    {section.position} · {section.players.length}
                  </Text>
                  <View className="gap-3">
                    {section.players.map((p, idx) => (
                      <View key={p.id || `${p.name}-${idx}`} className="flex-row items-center gap-3">
                        <PlayerPhoto player={p} />
                        <Text className="text-white text-sm font-bold flex-1" numberOfLines={1}>
                          {p.name}
                        </Text>
                        {p.age ? <Text className="text-gray-500 text-xs font-bold">{p.age} yrs</Text> : null}
                        <View className="w-8 items-end">
                          {p.number != null ? (
                            <Text className="text-[#02DB54] text-sm font-black">{p.number}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
