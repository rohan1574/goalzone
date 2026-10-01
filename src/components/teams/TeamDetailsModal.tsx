import { ArrowLeft, Bell } from "lucide-react-native";
import { useEffect, useState } from "react";
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
} from "../../services/footballApi";

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
}

export default function TeamDetailsModal({
  visible,
  team,
  onClose,
}: TeamDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"fixtures" | "squad">("fixtures");
  const [activeNotifications, setActiveNotifications] = useState<{
    [key: string]: boolean;
  }>({});
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [squad, setSquad] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && team) {
      loadData();
    }
  }, [visible, team]);

  const loadData = async () => {
    if (!team) return;
    setLoading(true);
    try {
      let teamId = team.id;

      // If teamId is a country name (not a numeric ID), find the actual team ID
      if (isNaN(Number(teamId))) {
        const teamInfo = await fetchTeamByCountry(team.name);
        if (teamInfo && teamInfo.id) {
          teamId = teamInfo.id;
        } else {
          console.warn(`Could not find national team ID for ${team.name}`);
          setFixtures([]);
          setSquad([]);
          setLoading(false);
          return;
        }
      }

      const [fixturesData, squadData] = await Promise.all([
        fetchTeamFixtures(teamId),
        fetchTeamSquad(teamId),
      ]);
      setFixtures(fixturesData || []);
      setSquad(squadData || []);
    } catch (err) {
      console.error("Error loading team details:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!team) return null;

  const toggleNotification = (matchId: string) => {
    setActiveNotifications((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
        {/* Header section */}
        <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-[#ffffff05]">
          <TouchableOpacity onPress={onClose} className="p-1">
            <ArrowLeft size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black text-center flex-1">
            {team.name}
          </Text>
          <View className="w-10" />
        </View>

        {/* Tab Selection */}
        <View className="flex-row bg-[#131415] rounded-3xl mx-4 my-4 p-1 border border-white/5">
          <TouchableOpacity
            onPress={() => setActiveTab("fixtures")}
            className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${
              activeTab === "fixtures"
                ? "bg-[#02DB54]/10 border border-[#02DB54]"
                : ""
            }`}
          >
            <Text
              className={`text-sm font-black ${
                activeTab === "fixtures" ? "text-white" : "text-[#9BA1A6]"
              }`}
            >
              Fixtures
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("squad")}
            className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${
              activeTab === "squad"
                ? "bg-[#02DB54]/10 border border-[#02DB54]"
                : ""
            }`}
          >
            <Text
              className={`text-sm font-black ${
                activeTab === "squad" ? "text-white" : "text-[#9BA1A6]"
              }`}
            >
              Squad
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View className="flex-1 items-center justify-center py-10">
              <ActivityIndicator size="large" color="#02DB54" />
              <Text className="text-gray-400 text-xs font-bold mt-3">
                Loading details...
              </Text>
            </View>
          ) : activeTab === "fixtures" ? (
            <View className="gap-3">
              {fixtures.length > 0 ? (
                fixtures.map((match) => {
                  const isNotified = activeNotifications[match.id];
                  return (
                    <View
                      key={match.id}
                      className="relative bg-[#131415] rounded-3xl px-4 py-4.5 border border-white/5 overflow-hidden flex-row items-center justify-between"
                    >
                      {/* Left glow line */}
                      <View className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#02DB54] rounded-l-3xl" />

                      {/* Time/Date Info */}
                      <View className="w-[18%] items-start justify-center">
                        <Text className="text-[#9BA1A6] text-[11px] font-bold tracking-wider mb-0.5">
                          {match.status}
                        </Text>
                        <Text className="text-white text-sm font-black mb-0.5">
                          {match.time}
                        </Text>
                        <Text className="text-[#9BA1A6] text-[9px] font-semibold">
                          {match.date}
                        </Text>
                      </View>

                      {/* Divider Line */}
                      <View className="w-[1px] h-10 bg-white/10 mx-1" />

                      {/* Match Opponent Detail */}
                      <View className="flex-1 px-3 justify-center gap-2">
                        <View className="flex-row items-center gap-2.5">
                          <Image
                            source={{
                              uri: match.isHome
                                ? team.logo
                                : match.opponentLogo,
                            }}
                            className="w-6 h-6"
                            resizeMode="contain"
                          />
                          <Text
                            className="text-white text-sm font-extrabold"
                            numberOfLines={1}
                          >
                            {match.isHome ? team.name : match.opponent}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2.5">
                          <Image
                            source={{
                              uri: match.isHome
                                ? match.opponentLogo
                                : team.logo,
                            }}
                            className="w-6 h-6"
                            resizeMode="contain"
                          />
                          <Text
                            className="text-gray-300 text-sm font-extrabold"
                            numberOfLines={1}
                          >
                            {match.isHome ? match.opponent : team.name}
                          </Text>
                        </View>
                      </View>

                      {/* Notification Bell Button */}
                      <TouchableOpacity
                        onPress={() => toggleNotification(match.id)}
                        className={`p-2.5 rounded-full ${
                          isNotified ? "bg-[#02DB54]/15" : "bg-white/5"
                        }`}
                      >
                        <Bell
                          size={18}
                          color={isNotified ? "#02DB54" : "#ECEDEE"}
                          fill={isNotified ? "#02DB54" : "none"}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <Text className="text-gray-400 text-xs font-bold text-center py-10">
                  No fixtures found.
                </Text>
              )}
            </View>
          ) : (
            <View className="bg-[#131415] rounded-3xl p-4 border border-white/5 gap-4">
              {squad.length > 0 ? (
                squad.map((section, idx) => (
                  <View
                    key={idx}
                    className="border-b border-white/5 pb-3 last:border-b-0"
                  >
                    <Text className="text-[#02DB54] font-black text-sm mb-2">
                      {section.position}
                    </Text>
                    <View className="gap-1.5 pl-2">
                      {section.players.map((p: string, pIdx: number) => (
                        <Text key={pIdx} className="text-white text-xs">
                          • {p}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-gray-400 text-xs font-bold text-center py-10">
                  No squad data found.
                </Text>
              )}
            </View>
          )}
          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
