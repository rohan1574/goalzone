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
import Svg, { Polygon, Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TeamDetailsModal, { Team } from "./TeamDetailsModal";
import { fetchCountries } from "../../services/footballApi";

const STORAGE_KEY = "@goalzone_favorite_teams";

const ALL_TEAMS: Team[] = [
  { id: "argentina", name: "Argentina", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8066.png", category: "International Teams", country: "Argentina" },
  { id: "brazil", name: "Brazil", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8550.png", category: "International Teams", country: "Brazil" },
  { id: "france", name: "France", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8490.png", category: "International Teams", country: "France" },
  { id: "england", name: "England", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8489.png", category: "International Teams", country: "England" },
  { id: "portugal", name: "Portugal", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8205.png", category: "International Teams", country: "Portugal" },
  { id: "spain", name: "Spain", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8322.png", category: "International Teams", country: "Spain" },
  { id: "germany", name: "Germany", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8141.png", category: "International Teams", country: "Germany" },
  { id: "italy", name: "Italy", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8142.png", category: "International Teams", country: "Italy" },
  { id: "netherlands", name: "Netherlands", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8145.png", category: "International Teams", country: "Netherlands" },
  { id: "belgium", name: "Belgium", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8256.png", category: "International Teams", country: "Belgium" },
  { id: "croatia", name: "Croatia", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8514.png", category: "International Teams", country: "Croatia" },
  { id: "uruguay", name: "Uruguay", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8492.png", category: "International Teams", country: "Uruguay" },
  { id: "morocco", name: "Morocco", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8093.png", category: "International Teams", country: "Morocco" },
  { id: "senegal", name: "Senegal", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8348.png", category: "International Teams", country: "Senegal" },
  { id: "japan", name: "Japan", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8143.png", category: "International Teams", country: "Japan" },
  { id: "southkorea", name: "South Korea", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8243.png", category: "International Teams", country: "South Korea" },
  { id: "usa", name: "USA", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8244.png", category: "International Teams", country: "USA" },
  { id: "mexico", name: "Mexico", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8092.png", category: "International Teams", country: "Mexico" },
  { id: "colombia", name: "Colombia", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8204.png", category: "International Teams", country: "Colombia" },
  { id: "switzerland", name: "Switzerland", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/9820.png", category: "International Teams", country: "Switzerland" },
  { id: "realmadrid", name: "Real Madrid", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png", category: "Club Teams", country: "Spain" },
  { id: "barcelona", name: "FC Barcelona", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8634.png", category: "Club Teams", country: "Spain" },
  { id: "mancity", name: "Manchester City", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8457.png", category: "Club Teams", country: "England" },
  { id: "chelsea", name: "Chelsea", logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png", category: "Club Teams", country: "England" },
];

export default function TeamsView() {
  const [favorites, setFavorites] = useState<string[]>(["argentina"]); // Default Argentina as favorite
  const [loading, setLoading] = useState(true);
  const [apiCountries, setApiCountries] = useState<Team[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  // Expandable sections
  const [favSectionExpanded, setFavSectionExpanded] = useState(true);
  const [allSectionExpanded, setAllSectionExpanded] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    "International Teams": true,
    "Club Teams": false,
  });

  // Modal display managers
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    loadFavorites();
    loadApiCountries();
  }, []);

  const loadApiCountries = async () => {
    setLoadingCountries(true);
    try {
      const data = await fetchCountries();
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => {
          const name = item.name || item.countryName || item.title || "Country";
          const id = String(item.id || item.countryCode || name.toLowerCase().replace(/\s+/g, ""));
          const logo = item.flag || item.countryFlag || item.flagUrl || `https://images.fotmob.com/image_resources/logo/teamlogo/${id.substring(0, 3)}.png`;
          return {
            id,
            name,
            logo,
            category: "International Teams",
            country: name
          };
        });
        setApiCountries(mapped);
      }
    } catch (err) {
      console.warn("Failed to load countries from API:", err);
    } finally {
      setLoadingCountries(false);
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

  // Merge dynamic countries with club teams
  const teamsList = React.useMemo(() => {
    const clubTeams = ALL_TEAMS.filter((t) => t.category === "Club Teams");
    if (apiCountries.length > 0) {
      return [...apiCountries, ...clubTeams];
    }
    return ALL_TEAMS;
  }, [apiCountries]);

  const categories = Array.from(new Set(teamsList.map((t) => t.category)));
  const favoriteTeamsList = teamsList.filter((t) => favorites.includes(t.id));

  // Premium Golden Hexagon Crown Badge
  const PremiumHexagonBadge = () => (
    <View className="items-center justify-center">
      <Svg height="30" width="30" viewBox="0 0 100 100">
        <Polygon points="50,0 93,25 93,75 50,100 7,75 7,25" fill="#FFC800" />
        <Polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="#0D0E0F" />
        <Path d="M30,68 L70,68 L75,38 L60,48 L50,28 L40,48 L25,38 Z" fill="#FFC800" />
      </Svg>
    </View>
  );

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
          <TouchableOpacity className="p-2 rounded-full bg-white/5">
            <Search size={18} color="#ECEDEE" />
          </TouchableOpacity>
          <TouchableOpacity>
            <PremiumHexagonBadge />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Meta Sponsor Promo Banner */}
        <TouchableOpacity className="bg-[#131415] rounded-3xl p-3 border border-white/5 mb-6 relative overflow-hidden" activeOpacity={0.9}>
          <View className="absolute left-3 top-3 bg-[#02DB54] px-1.5 py-0.5 rounded z-10">
            <Text className="text-black text-[8px] font-black uppercase">Ad</Text>
          </View>
          
          <View className="flex-row items-center mt-3 mb-2">
            <Image
              source={{ uri: "https://images.fotmob.com/image_resources/logo/teamlogo/8066.png" }}
              className="w-12 h-12 rounded-xl"
            />
            <View className="flex-1 ml-3 mr-2">
              <Text className="text-white text-sm font-black mb-1" numberOfLines={1}>
                বন্ধ রবি সিম খুলুন এবার
              </Text>
              <Text className="text-gray-400 text-[10px] font-bold" numberOfLines={1}>
                বন্ধ সিম চালু করলেই পাচ্ছেন মিনিট ও ডাটার অফার...
              </Text>
            </View>
            <View className="bg-[#7CFC00] rounded-2xl px-3 py-2 justify-center items-center">
              <Text className="text-black text-[10px] font-black text-center">অ্যাপ ব্যবহার করুন</Text>
            </View>
          </View>
          <Text className="text-[#545A60] text-[8px] font-bold text-right mt-1">Ads served by Meta</Text>
        </TouchableOpacity>

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
                const isCatExpanded = expandedCategories[category];

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
