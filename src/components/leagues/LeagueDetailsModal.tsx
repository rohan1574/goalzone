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
import { ArrowLeft, Bell } from "lucide-react-native";
import { fetchLeagueStandings } from "../../services/footballApi";

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
}

export default function LeagueDetailsModal({
  visible,
  league,
  onClose,
}: LeagueDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"fixtures" | "table">("fixtures");
  const [activeNotifications, setActiveNotifications] = useState<{ [key: string]: boolean }>({});


  const toggleNotification = (matchId: string) => {
    setActiveNotifications((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };

  // Mock data database for fixtures and standings by league ID
  const mockLeagueData: {
    [key: string]: {
      fixtures: Array<{
        id: string;
        time: string;
        date: string;
        home: { name: string; logo: string };
        away: { name: string; logo: string };
      }>;
      table: Array<{
        pos: number;
        name: string;
        logo: string;
        pl: number;
        gd: string;
        pts: number;
      }>;
    };
  } = {
    "world-cup": {
      fixtures: [
        {
          id: "wc-1",
          time: "00:00",
          date: "14/06",
          home: { name: "Argentina", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8066.png" },
          away: { name: "France", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8490.png" },
        },
        {
          id: "wc-2",
          time: "18:00",
          date: "15/06",
          home: { name: "Brazil", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8550.png" },
          away: { name: "England", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8489.png" },
        },
      ],
      table: [
        { pos: 1, name: "Argentina", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8066.png", pl: 3, gd: "+5", pts: 9 },
        { pos: 2, name: "France", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8490.png", pl: 3, gd: "+3", pts: 6 },
        { pos: 3, name: "Brazil", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8550.png", pl: 3, gd: "+1", pts: 3 },
        { pos: 4, name: "England", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8489.png", pl: 3, gd: "-9", pts: 0 },
      ],
    },
    "laliga": {
      fixtures: [
        {
          id: "ll-1",
          time: "01:00",
          date: "26/08",
          home: { name: "Valencia", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10205.png" },
          away: { name: "Real Betis", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8639.png" },
        },
        {
          id: "ll-2",
          time: "01:00",
          date: "27/08",
          home: { name: "Real Sociedad", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8560.png" },
          away: { name: "Real Madrid", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png" },
        },
        {
          id: "ll-3",
          time: "00:30",
          date: "28/08",
          home: { name: "Celta de Vigo", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9910.png" },
          away: { name: "Osasuna", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8371.png" },
        },
        {
          id: "ll-4",
          time: "01:00",
          date: "28/08",
          home: { name: "FC Barcelona", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8634.png" },
          away: { name: "Athletic Club", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8315.png" },
        },
        {
          id: "ll-5",
          time: "23:00",
          date: "28/08",
          home: { name: "Racing Santander", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8696.png" },
          away: { name: "Elche", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10268.png" },
        },
        {
          id: "ll-6",
          time: "01:30",
          date: "29/08",
          home: { name: "Deportivo Alaves", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8586.png" },
          away: { name: "Sevilla", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8302.png" },
        },
      ],
      table: [
        { pos: 1, name: "FC Barcelona", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8634.png", pl: 2, gd: "+5", pts: 6 },
        { pos: 2, name: "Real Madrid", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png", pl: 2, gd: "+3", pts: 6 },
        { pos: 3, name: "Atletico Madrid", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9906.png", pl: 2, gd: "+2", pts: 4 },
        { pos: 4, name: "Girona", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/7765.png", pl: 2, gd: "+2", pts: 4 },
        { pos: 5, name: "Athletic Club", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8315.png", pl: 2, gd: "+1", pts: 4 },
        { pos: 6, name: "Real Sociedad", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8560.png", pl: 2, gd: "0", pts: 3 },
        { pos: 7, name: "Real Betis", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8639.png", pl: 2, gd: "0", pts: 2 },
        { pos: 8, name: "Villarreal", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10205.png", pl: 2, gd: "0", pts: 2 },
        { pos: 9, name: "Valencia", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10205.png", pl: 2, gd: "0", pts: 2 },
        { pos: 10, name: "Deportivo Alaves", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8586.png", pl: 2, gd: "0", pts: 1 },
        { pos: 11, name: "Osasuna", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8371.png", pl: 2, gd: "-1", pts: 1 },
        { pos: 12, name: "Getafe", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8278.png", pl: 2, gd: "-1", pts: 1 },
        { pos: 13, name: "Celta de Vigo", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9910.png", pl: 2, gd: "-1", pts: 1 },
        { pos: 14, name: "Sevilla", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8302.png", pl: 2, gd: "-1", pts: 1 },
        { pos: 15, name: "Mallorca", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8661.png", pl: 2, gd: "-2", pts: 1 },
        { pos: 16, name: "Las Palmas", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8370.png", pl: 2, gd: "-2", pts: 1 },
        { pos: 17, name: "Rayo Vallecano", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8372.png", pl: 2, gd: "-2", pts: 1 },
        { pos: 18, name: "Leganes", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9866.png", pl: 2, gd: "-3", pts: 0 },
        { pos: 19, name: "Real Valladolid", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10281.png", pl: 2, gd: "-3", pts: 0 },
        { pos: 20, name: "Espanyol", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8558.png", pl: 2, gd: "-4", pts: 0 },
      ],
    },
    "epl": {
      fixtures: [
        {
          id: "ep-1",
          time: "19:00",
          date: "23/08",
          home: { name: "Manchester City", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8457.png" },
          away: { name: "AFC Bournemouth", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8086.png" },
        },
        {
          id: "ep-2",
          time: "19:00",
          date: "23/08",
          home: { name: "Brighton & Hove Albion", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10204.png" },
          away: { name: "Chelsea", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png" },
        },
      ],
      table: [
        { pos: 1, name: "Manchester City", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8457.png", pl: 1, gd: "+2", pts: 3 },
        { pos: 2, name: "Chelsea", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png", pl: 1, gd: "+1", pts: 3 },
        { pos: 3, name: "Brighton", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/10204.png", pl: 1, gd: "-1", pts: 0 },
        { pos: 4, name: "AFC Bournemouth", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8086.png", pl: 1, gd: "-2", pts: 0 },
      ],
    },
  };

  const [apiTable, setApiTable] = useState<any[]>([]);
  const [loadingTable, setLoadingTable] = useState(false);

  useEffect(() => {
    if (visible && league) {
      loadStandings();
    }
  }, [visible, league]);

  const loadStandings = async () => {
    if (!league) return;
    setLoadingTable(true);
    try {
      const rawData = await fetchLeagueStandings(league.id);
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

          return { pos, name, logo, pl, gd, pts };
        });
        setApiTable(mapped);
      } else {
        setApiTable([]);
      }
    } catch (e) {
      console.warn("Failed to load standings, fallback to mock:", e);
      setApiTable([]);
    } finally {
      setLoadingTable(false);
    }
  };

  const activeData = mockLeagueData[league?.id || "laliga"] || mockLeagueData["laliga"];
  const tableData = apiTable.length > 0 ? apiTable : activeData.table;

  if (!league) return null;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
        {/* Header Section */}
        <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-[#ffffff05]">
          <TouchableOpacity onPress={onClose} className="p-1">
            <ArrowLeft size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black text-center flex-1">{league.name}</Text>
          <View className="w-10" />
        </View>

        {/* Tab Selection */}
        <View className="flex-row bg-[#131415] rounded-3xl mx-4 my-4 p-1 border border-white/5">
          <TouchableOpacity
            onPress={() => setActiveTab("fixtures")}
            className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${
              activeTab === "fixtures" ? "bg-[#02DB54]/10 border border-[#02DB54]" : ""
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
            onPress={() => setActiveTab("table")}
            className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${
              activeTab === "table" ? "bg-[#02DB54]/10 border border-[#02DB54]" : ""
            }`}
          >
            <Text
              className={`text-sm font-black ${
                activeTab === "table" ? "text-white" : "text-[#9BA1A6]"
              }`}
            >
              Table
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "fixtures" ? (
            <View className="gap-3">
              {activeData.fixtures.map((match) => {
                const isNotified = activeNotifications[match.id];
                return (
                  <View key={match.id} className="relative bg-[#131415] rounded-3xl px-4 py-4.5 border border-white/5 overflow-hidden flex-row items-center justify-between">
                    {/* Left glow accent indicator */}
                    <View className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#02DB54] rounded-l-3xl" />

                    {/* Time & Date Column */}
                    <View className="w-[18%] items-start justify-center">
                      <Text className="text-[#9BA1A6] text-[11px] font-bold tracking-wider mb-0.5">TBD</Text>
                      <Text className="text-white text-sm font-black mb-0.5">{match.time}</Text>
                      <Text className="text-[#9BA1A6] text-[9px] font-semibold">{match.date}</Text>
                    </View>

                    {/* Divider Line */}
                    <View className="w-[1px] h-10 bg-white/10 mx-1" />

                    {/* Match details (Teams) */}
                    <View className="flex-1 px-3 justify-center gap-2">
                      <View className="flex-row items-center gap-2.5">
                        <Image
                          source={{ uri: match.home.logo }}
                          className="w-6 h-6"
                          resizeMode="contain"
                        />
                        <Text className="text-white text-sm font-extrabold" numberOfLines={1}>
                          {match.home.name}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2.5">
                        <Image
                          source={{ uri: match.away.logo }}
                          className="w-6 h-6"
                          resizeMode="contain"
                        />
                        <Text className="text-white text-sm font-extrabold" numberOfLines={1}>
                          {match.away.name}
                        </Text>
                      </View>
                    </View>

                    {/* Bell Notification Button */}
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
              })}
            </View>
          ) : (
            <View className="bg-[#131415] rounded-3xl p-4 border border-white/5">
              <View className="flex-row border-b border-white/10 pb-2 mb-2 items-center">
                <Text className="text-[#9BA1A6] font-bold text-xs text-center w-[10%]">Pos</Text>
                <Text className="text-[#9BA1A6] font-bold text-xs text-left flex-1">Team</Text>
                <Text className="text-[#9BA1A6] font-bold text-xs text-center w-[12%]">PL</Text>
                <Text className="text-[#9BA1A6] font-bold text-xs text-center w-[15%]">GD</Text>
                <Text className="text-[#9BA1A6] font-bold text-xs text-center w-[15%]">PTS</Text>
              </View>
              
              {loadingTable ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator size="small" color="#02DB54" />
                </View>
              ) : (
                tableData.map((row, idx) => (
                  <View key={row.id || row.pos || idx} className="flex-row py-2.5 border-b border-white/5 items-center">
                    <Text className="text-[#02DB54] font-black text-xs text-center w-[10%]">{row.pos}</Text>
                    <View className="flex-row items-center gap-2.5 flex-1">
                      <Image source={{ uri: row.logo }} className="w-5 h-5" resizeMode="contain" />
                      <Text className="text-white text-xs font-extrabold" numberOfLines={1}>
                        {row.name}
                      </Text>
                    </View>
                    <Text className="text-gray-300 text-xs font-bold text-center w-[12%]">{row.pl}</Text>
                    <Text className="text-gray-300 text-xs font-bold text-center w-[15%]">{row.gd}</Text>
                    <Text className="text-white text-xs font-black text-center w-[15%]">{row.pts}</Text>
                  </View>
                ))
              )}
            </View>
          )}
          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
