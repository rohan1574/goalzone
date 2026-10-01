import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Search, Star, ChevronDown, ChevronUp } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TeamDetailsModal, { Team } from "./TeamDetailsModal";
import { fetchPopularTeams } from "../../services/footballApi";

const STORAGE_KEY = "@goalzone_favorite_teams";

const ALL_TEAMS: Team[] = [
  { id: "8066", name: "Argentina", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8066.png", category: "International Teams", country: "Argentina" },
  { id: "8550", name: "Brazil", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8550.png", category: "International Teams", country: "Brazil" },
  { id: "8490", name: "France", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8490.png", category: "International Teams", country: "France" },
  { id: "8489", name: "England", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8489.png", category: "International Teams", country: "England" },
  { id: "8205", name: "Portugal", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8205.png", category: "International Teams", country: "Portugal" },
  { id: "8322", name: "Spain", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8322.png", category: "International Teams", country: "Spain" },
  { id: "8141", name: "Germany", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8141.png", category: "International Teams", country: "Germany" },
  { id: "8142", name: "Italy", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8142.png", category: "International Teams", country: "Italy" },
  { id: "8145", name: "Netherlands", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8145.png", category: "International Teams", country: "Netherlands" },
  { id: "8256", name: "Belgium", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8256.png", category: "International Teams", country: "Belgium" },
  { id: "8514", name: "Croatia", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8514.png", category: "International Teams", country: "Croatia" },
  { id: "8492", name: "Uruguay", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8492.png", category: "International Teams", country: "Uruguay" },
  { id: "8093", name: "Morocco", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8093.png", category: "International Teams", country: "Morocco" },
  { id: "8143", name: "Japan", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8143.png", category: "International Teams", country: "Japan" },
  { id: "8633", name: "Real Madrid", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png", category: "Club Teams", country: "Spain" },
  { id: "8634", name: "FC Barcelona", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8634.png", category: "Club Teams", country: "Spain" },
  { id: "8457", name: "Manchester City", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8457.png", category: "Club Teams", country: "England" },
  { id: "8455", name: "Chelsea", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png", category: "Club Teams", country: "England" },
];

export default function TeamsView() {
  const [favorites, setFavorites] = useState<string[]>(["8066"]); // Default Argentina as favorite
  const [loading, setLoading] = useState(true);
  const [apiTeams, setApiTeams] = useState<Team[]>([]);
  const [loadingApiTeams, setLoadingApiTeams] = useState(false);

  // Expandable sections
  const [favSectionExpanded, setFavSectionExpanded] = useState(true);
  const [allSectionExpanded, setAllSectionExpanded] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});

  // Modal display managers
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    loadFavorites();
    loadApiTeams();
  }, []);

  const loadApiTeams = async () => {
    setLoadingApiTeams(true);
    try {
      const data = await fetchPopularTeams();
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => ({
          id: String(item.id || item.teamId || Math.random().toString()),
          name: item.name || item.teamName || "Team",
          logo: item.logo || item.logoUrl || `https://images.fotmob.com/image_resources/logo/teamlogo/${item.id}.png`,
          category: item.category || "International Teams",
          country: item.country || "International"
        }));
        setApiTeams(mapped);
      }
    } catch (err) {
      console.warn("Failed to load popular teams from API:", err);
    } finally {
      setLoadingApiTeams(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load favorite teams", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (id: string) => {
    let updated = [...favorites];
    if (updated.includes(id)) {
      updated = updated.filter((favId) => favId !== id);
    } else {
      updated.push(id);
    }
    setFavorites(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save favorite teams", e);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Use API teams if available, fallback to ALL_TEAMS
  const teamsList = React.useMemo(() => {
    if (apiTeams && apiTeams.length > 0) {
      return apiTeams;
    }
    return ALL_TEAMS;
  }, [apiTeams]);

  const categories = Array.from(new Set(teamsList.map((t) => t.category)));
  const favoriteTeamsList = teamsList.filter((t) => favorites.includes(t.id));

  if (loading) {
    return (
      <View className="flex-1 bg-[#0D0E0F] items-center justify-center">
        <ActivityIndicator size="large" color="#02DB54" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0D0E0F]">
      {/* Search Header */}
      <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-[#ffffff05]">
        <Text className="text-white text-22 font-black tracking-[1.5px]">TEAMS</Text>
        <View className="flex-row items-center gap-3">
          {/* <TouchableOpacity className="p-2 rounded-full bg-white/5">
            <Search size={18} color="#ECEDEE" />
          </TouchableOpacity> */}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
       

        {/* SECTION 1: Favorite Teams */}
        <View className="mb-5">
          <TouchableOpacity
            className="flex-row justify-between items-center py-2 mb-3"
            onPress={() => setFavSectionExpanded(!favSectionExpanded)}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-black">Favorite Teams</Text>
            {favSectionExpanded ? (
              <ChevronDown size={18} color="#9BA1A6" />
            ) : (
              <ChevronUp size={18} color="#9BA1A6" />
            )}
          </TouchableOpacity>

          {favSectionExpanded && (
            <View className="gap-3">
              {favoriteTeamsList.length > 0 ? (
                favoriteTeamsList.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    className="relative bg-[#131415] rounded-2xl px-4 py-3.5 border border-white/5 flex-row items-center overflow-hidden"
                    onPress={() => {
                      setSelectedTeam(team);
                      setDetailsVisible(true);
                    }}
                  >
                    <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54] rounded-l-2xl" />
                    <Image source={{ uri: team.logo }} className="w-8 h-8 rounded-xl" />
                    <Text className="text-white text-sm font-extrabold ml-3 flex-1">{team.name}</Text>
                    <TouchableOpacity
                      onPress={() => toggleFavorite(team.id)}
                      className="p-1.5"
                    >
                      <Star size={18} color="#FFC800" fill="#FFC800" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-gray-400 text-xs font-bold text-center py-3">No favorite teams added yet.</Text>
              )}
            </View>
          )}
        </View>

        {/* SECTION 2: All Teams */}
        <View className="mb-5">
          <TouchableOpacity
            className="flex-row justify-between items-center py-2 mb-3"
            onPress={() => setAllSectionExpanded(!allSectionExpanded)}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-black">All teams</Text>
            {allSectionExpanded ? (
              <ChevronDown size={18} color="#9BA1A6" />
            ) : (
              <ChevronUp size={18} color="#9BA1A6" />
            )}
          </TouchableOpacity>

          {allSectionExpanded && (
            <View className="bg-[#131415] rounded-3xl border border-white/5 p-1">
              {categories.map((category) => {
                const categoryTeams = teamsList.filter((t) => t.category === category);
                const isCatExpanded = expandedCategories[category] !== false;

                return (
                  <View key={category} className="border-b border-white/3">
                    <TouchableOpacity
                      className="flex-row justify-between items-center px-3 py-3.5"
                      onPress={() => toggleCategory(category)}
                      activeOpacity={0.8}
                    >
                      <View className="flex-row items-center gap-2.5">
                        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <Path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#9BA1A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <Path d="M2 17l10 5 10-5" stroke="#9BA1A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <Path d="M2 12l10 5 10-5" stroke="#9BA1A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text className="text-white text-sm font-black">{category}</Text>
                      </View>
                      {isCatExpanded ? (
                        <ChevronUp size={16} color="#9BA1A6" />
                      ) : (
                        <ChevronDown size={16} color="#9BA1A6" />
                      )}
                    </TouchableOpacity>

                    {isCatExpanded && (
                      <View className="px-2 pb-3 gap-2">
                        {categoryTeams.map((team) => {
                          const isFav = favorites.includes(team.id);
                          return (
                            <TouchableOpacity
                              key={team.id}
                              className="relative bg-[#131415] rounded-2xl px-4 py-3.5 border border-white/5 flex-row items-center overflow-hidden"
                              onPress={() => {
                                setSelectedTeam(team);
                                setDetailsVisible(true);
                              }}
                            >
                              <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54] rounded-l-2xl" />
                              <Image source={{ uri: team.logo }} className="w-8 h-8 rounded-xl" />
                              <Text className="text-white text-sm font-extrabold ml-3 flex-1">{team.name}</Text>
                              <TouchableOpacity
                                onPress={() => toggleFavorite(team.id)}
                                className="p-1.5"
                              >
                                <Star
                                  size={18}
                                  color={isFav ? "#FFC800" : "#9BA1A6"}
                                  fill={isFav ? "#FFC800" : "none"}
                                />
                              </TouchableOpacity>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <View className="h-[100px]" />
      </ScrollView>

      {/* Modal Detail Screen */}
      <TeamDetailsModal
        visible={detailsVisible}
        team={selectedTeam}
        onClose={() => setDetailsVisible(false)}
      />
    </View>
  );
}
