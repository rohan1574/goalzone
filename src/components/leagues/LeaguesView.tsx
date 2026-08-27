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
import LeagueDetailsModal, { League } from "./LeagueDetailsModal";

const STORAGE_KEY = "@goalzone_favorite_leagues";

const ALL_LEAGUES: League[] = [
  { id: "world-cup", name: "World Cup", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/world_cup.png", category: "International Tournaments" },
  { id: "ucl", name: "Champions League", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/42.png", category: "International Tournaments" },
  { id: "uel", name: "Europa League", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/82.png", category: "International Tournaments" },
  { id: "copa-lib", name: "Copa Libertadores", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/44.png", category: "International Tournaments" },
  { id: "afc-elite", name: "AFC Champions League Elite", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/248.png", category: "International Tournaments" },
  { id: "afc-two", name: "AFC Champions League Two", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/249.png", category: "International Tournaments" },
  { id: "laliga", name: "La Liga", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/87.png", category: "Spain" },
  { id: "copa-del-rey", name: "Copa del Rey", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/319.png", category: "Spain" },
  { id: "epl", name: "Premier League", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png", category: "England" },
  { id: "fa-cup", name: "FA Cup", logo: "https://images.fotmob.com/image_resources/logo/leaguelogo/315.png", category: "England" },
];

interface LeaguesViewProps {
  apiLeagues?: any[];
}

export default function LeaguesView({ apiLeagues }: LeaguesViewProps) {
  const [favorites, setFavorites] = useState<string[]>(["world-cup"]); // Default World Cup as favorite to match mock screenshot
  const [loading, setLoading] = useState(true);

  // Expandable state managers
  const [favSectionExpanded, setFavSectionExpanded] = useState(true);
  const [allSectionExpanded, setAllSectionExpanded] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    "International Tournaments": true,
    "Spain": false,
    "England": false,
  });

  // Modal detail display managers
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Parse leagues dynamically from API data if available
  const leaguesList = React.useMemo(() => {
    if (apiLeagues && apiLeagues.length > 0) {
      return apiLeagues.map((item: any) => {
        const id = String(item.id || item.leagueId || item.league_id || Math.random().toString());
        const name = item.name || item.leagueName || item.league_name || "League";
        const logo = item.logo || item.leagueLogo || item.logoUrl || `https://images.fotmob.com/image_resources/logo/leaguelogo/${id}.png`;
        const country = item.country || item.countryName || item.region || "International Tournaments";
        return {
          id,
          name,
          logo,
          category: country,
        };
      });
    }
    return ALL_LEAGUES;
  }, [apiLeagues]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load favorite leagues", e);
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
      console.warn("Failed to save favorite leagues", e);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Group all leagues by category
  const categories = Array.from(new Set(leaguesList.map((l) => l.category)));
  const favoriteLeaguesList = leaguesList.filter((l) => favorites.includes(l.id));

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
        <Text className="text-white text-22 font-black tracking-[1.5px]">LEAGUES</Text>
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
              source={{ uri: "https://images.fotmob.com/image_resources/logo/leaguelogo/world_cup.png" }}
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

        {/* SECTION 1: Favorite Leagues */}
        <View className="mb-5">
          <TouchableOpacity
            className="flex-row justify-between items-center py-2 mb-3"
            onPress={() => setFavSectionExpanded(!favSectionExpanded)}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-black">Favorite Leagues</Text>
            {favSectionExpanded ? (
              <ChevronDown size={18} color="#9BA1A6" />
            ) : (
              <ChevronUp size={18} color="#9BA1A6" />
            )}
          </TouchableOpacity>

          {favSectionExpanded && (
            <View className="gap-3">
              {favoriteLeaguesList.length > 0 ? (
                favoriteLeaguesList.map((league) => (
                  <TouchableOpacity
                    key={league.id}
                    className="relative bg-[#131415] rounded-2xl px-4 py-3.5 border border-white/5 flex-row items-center overflow-hidden"
                    onPress={() => {
                      setSelectedLeague(league);
                      setDetailsVisible(true);
                    }}
                  >
                    <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54] rounded-l-2xl" />
                    <Image source={{ uri: league.logo }} className="w-6 h-6 rounded-full" />
                    <Text className="text-white text-sm font-extrabold ml-3 flex-1">{league.name}</Text>
                    <TouchableOpacity
                      onPress={() => toggleFavorite(league.id)}
                      className="p-1.5"
                    >
                      <Star size={18} color="#FFC800" fill="#FFC800" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-gray-400 text-xs font-bold text-center py-3">No favorite leagues added yet.</Text>
              )}
            </View>
          )}
        </View>

        {/* SECTION 2: All Leagues */}
        <View className="mb-5">
          <TouchableOpacity
            className="flex-row justify-between items-center py-2 mb-3"
            onPress={() => setAllSectionExpanded(!allSectionExpanded)}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-black">All leagues</Text>
            {allSectionExpanded ? (
              <ChevronDown size={18} color="#9BA1A6" />
            ) : (
              <ChevronUp size={18} color="#9BA1A6" />
            )}
          </TouchableOpacity>

          {allSectionExpanded && (
            <View className="bg-[#131415] rounded-3xl border border-white/5 p-1">
              {categories.map((category) => {
                const categoryLeagues = leaguesList.filter((l) => l.category === category);
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
                        {categoryLeagues.map((league) => {
                          const isFav = favorites.includes(league.id);
                          return (
                            <TouchableOpacity
                              key={league.id}
                              className="relative bg-[#131415] rounded-2xl px-4 py-3.5 border border-white/5 flex-row items-center overflow-hidden"
                              onPress={() => {
                                setSelectedLeague(league);
                                setDetailsVisible(true);
                              }}
                            >
                              <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54] rounded-l-2xl" />
                              <Image source={{ uri: league.logo }} className="w-6 h-6 rounded-full" />
                              <Text className="text-white text-sm font-extrabold ml-3 flex-1">{league.name}</Text>
                              <TouchableOpacity
                                onPress={() => toggleFavorite(league.id)}
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
      <LeagueDetailsModal
        visible={detailsVisible}
        league={selectedLeague}
        onClose={() => setDetailsVisible(false)}
      />
    </View>
  );
}
