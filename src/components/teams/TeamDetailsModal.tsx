import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Bell } from "lucide-react-native";

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
  const [activeNotifications, setActiveNotifications] = useState<{ [key: string]: boolean }>({});

  if (!team) return null;

  const toggleNotification = (matchId: string) => {
    setActiveNotifications((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };

  // Mock data for fixtures and squads grouped by Team ID
  const mockTeamData: {
    [key: string]: {
      fixtures: Array<{
        id: string;
        time: string;
        date: string;
        opponent: string;
        opponentLogo: string;
        isHome: boolean;
      }>;
      squad: Array<{
        position: string;
        players: string[];
      }>;
    };
  } = {
    "argentina": {
      fixtures: [
        { id: "arg-1", time: "19:00", date: "12/09", opponent: "Brazil", opponentLogo: "https://images.fotmob.com/image_resources/logo/teamlogo/8550.png", isHome: true },
        { id: "arg-2", time: "22:30", date: "16/09", opponent: "Uruguay", opponentLogo: "https://images.fotmob.com/image_resources/logo/teamlogo/8494.png", isHome: false },
      ],
      squad: [
        { position: "Goalkeepers", players: ["Emi Martinez", "Geronimo Rulli", "Walter Benitez"] },
        { position: "Defenders", players: ["Cristian Romero", "Lisandro Martinez", "Nicolas Otamendi", "Nahuel Molina", "Nicolas Tagliafico"] },
        { position: "Midfielders", players: ["Rodrigo De Paul", "Alexis Mac Allister", "Enzo Fernandez", "Leandro Paredes"] },
        { position: "Forwards", players: ["Lionel Messi (C)", "Lautaro Martinez", "Julian Alvarez", "Alejandro Garnacho"] },
      ],
    },
    "brazil": {
      fixtures: [
        { id: "bra-1", time: "19:00", date: "12/09", opponent: "Argentina", opponentLogo: "https://images.fotmob.com/image_resources/logo/teamlogo/8066.png", isHome: false },
        { id: "bra-2", time: "21:00", date: "15/09", opponent: "Colombia", opponentLogo: "https://images.fotmob.com/image_resources/logo/teamlogo/8526.png", isHome: true },
      ],
      squad: [
        { position: "Goalkeepers", players: ["Alisson Becker", "Ederson Moraes"] },
        { position: "Defenders", players: ["Marquinhos", "Gabriel Magalhaes", "Eder Militao", "Danilo"] },
        { position: "Midfielders", players: ["Bruno Guimaraes", "Lucas Paqueta", "Joao Gomes", "Andreas Pereira"] },
        { position: "Forwards", players: ["Vinicius Junior", "Rodrygo Goes", "Raphinha", "Endrick"] },
      ],
    },
    "realmadrid": {
      fixtures: [
        { id: "rm-1", time: "01:00", date: "27/08", opponent: "Real Sociedad", opponentLogo: "https://images.fotmob.com/image_resources/logo/teamlogo/8560.png", isHome: false },
        { id: "rm-2", time: "19:00", date: "31/08", opponent: "Real Betis", opponentLogo: "https://images.fotmob.com/image_resources/logo/teamlogo/8639.png", isHome: true },
      ],
      squad: [
        { position: "Goalkeepers", players: ["Thibaut Courtois", "Andriy Lunin"] },
        { position: "Defenders", players: ["Antonio Rudiger", "Eder Militao", "Dani Carvajal", "Ferland Mendy"] },
        { position: "Midfielders", players: ["Jude Bellingham", "Federico Valverde", "Aurelien Tchouameni", "Eduardo Camavinga", "Luka Modric"] },
        { position: "Forwards", players: ["Kylian Mbappe", "Vinicius Junior", "Rodrygo Goes", "Brahim Diaz"] },
      ],
    },
  };

  const activeData = mockTeamData[team.id] || mockTeamData["argentina"];

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
          <Text className="text-white text-xl font-black text-center flex-1">{team.name}</Text>
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
            onPress={() => setActiveTab("squad")}
            className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${
              activeTab === "squad" ? "bg-[#02DB54]/10 border border-[#02DB54]" : ""
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
          {activeTab === "fixtures" ? (
            <View className="gap-3">
              {activeData.fixtures.map((match) => {
                const isNotified = activeNotifications[match.id];
                return (
                  <View key={match.id} className="relative bg-[#131415] rounded-3xl px-4 py-4.5 border border-white/5 overflow-hidden flex-row items-center justify-between">
                    {/* Left glow line */}
                    <View className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#02DB54] rounded-l-3xl" />

                    {/* Time/Date Info */}
                    <View className="w-[18%] items-start justify-center">
                      <Text className="text-[#9BA1A6] text-[11px] font-bold tracking-wider mb-0.5">TBD</Text>
                      <Text className="text-white text-sm font-black mb-0.5">{match.time}</Text>
                      <Text className="text-[#9BA1A6] text-[9px] font-semibold">{match.date}</Text>
                    </View>

                    {/* Divider Line */}
                    <View className="w-[1px] h-10 bg-white/10 mx-1" />

                    {/* Match Opponent Detail */}
                    <View className="flex-1 px-3 justify-center gap-2">
                      <View className="flex-row items-center gap-2.5">
                        <Image
                          source={{ uri: team.logo }}
                          className="w-6 h-6"
                          resizeMode="contain"
                        />
                        <Text className="text-white text-sm font-extrabold" numberOfLines={1}>
                          {team.name}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2.5">
                        <Image
                          source={{ uri: match.opponentLogo }}
                          className="w-6 h-6"
                          resizeMode="contain"
                        />
                        <Text className="text-gray-300 text-sm font-extrabold" numberOfLines={1}>
                          {match.opponent}
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
              })}
            </View>
          ) : (
            <View className="bg-[#131415] rounded-3xl p-4 border border-white/5 gap-4">
              {activeData.squad.map((section, idx) => (
                <View key={idx} className="border-b border-white/5 pb-3 last:border-b-0">
                  <Text className="text-[#02DB54] font-black text-sm mb-2">{section.position}</Text>
                  <View className="gap-1.5 pl-2">
                    {section.players.map((p, pIdx) => (
                      <Text key={pIdx} className="text-white text-xs">• {p}</Text>
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
