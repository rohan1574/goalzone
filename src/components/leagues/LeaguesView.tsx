import React, { useState, useEffect, useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Search, Star, ChevronDown, ChevronUp, X } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LeagueDetailsModal, { League } from "./LeagueDetailsModal";

const STORAGE_KEY = "@goalzone_favorite_leagues";

const getCategoryForLeague = (name: string, country?: string) => {
  if (country && country !== "Unknown" && country !== "International") return country;
  const lower = name.toLowerCase();
  if (lower.includes("champions league") || lower.includes("europa league") || lower.includes("conference league")) return "UEFA";
  if (lower.includes("world cup") || lower.includes("nations league") || lower.includes("olympic")) return "International";
  return country || "International";
};

interface LeaguesViewProps {
  apiLeagues?: any[];
}

export default function LeaguesView({ apiLeagues }: LeaguesViewProps) {
  const [favorites, setFavorites] = useState<string[]>(["39", "140"]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Expandable state managers
  const [favSectionExpanded, setFavSectionExpanded] = useState(true);
  const [allSectionExpanded, setAllSectionExpanded] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});

  // Modal detail display managers
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Parse leagues from API data — no hardcoded fallback
  const leaguesList = useMemo(() => {
    if (!apiLeagues || apiLeagues.length === 0) return [];
    return apiLeagues.map((item: any) => {
      const id = String(item.id || item.leagueId || item.league_id || "");
      const name = item.name || item.leagueName || item.league_name || "League";
      const logo = item.logo || item.leagueLogo || item.logoUrl || `https://media.api-sports.io/football/leagues/${id}.png`;
      const country = getCategoryForLeague(name, item.country || item.countryName || item.region);
      return { id, name, logo, category: country };
    });
  }, [apiLeagues]);

  // Filtered list based on search
  const filteredLeagues = useMemo(() => {
    if (!searchQuery.trim()) return leaguesList;
    const q = searchQuery.toLowerCase();
    return leaguesList.filter(
      (l) => l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q)
    );
  }, [leaguesList, searchQuery]);



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

  // Group filtered leagues by category
  const categories = Array.from(new Set(filteredLeagues.map((l) => l.category))).sort();
  const favoriteLeaguesList = filteredLeagues.filter((l) => favorites.includes(l.id));

  // Show spinner while waiting for API leagues to load
  if (loading || ((!apiLeagues || apiLeagues.length === 0) && leaguesList.length === 0)) {
    return (
      <View className="flex-1 bg-[#0D0E0F] items-center justify-center">
        <ActivityIndicator size="large" color="#02DB54" />
        <Text className="text-gray-400 text-xs mt-3">Loading leagues...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0D0E0F]">
      {/* Header */}
      <View className="px-4 py-3 border-b border-[#ffffff05]">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white text-[18px] font-black tracking-[1.5px]">LEAGUES</Text>
          <Text className="text-[#02DB54] text-xs font-bold">{leaguesList.length} leagues</Text>
        </View>
        {/* Search Bar */}
        <View className="flex-row items-center bg-[#131415] rounded-2xl px-3 border border-white/5 h-9">
          <Search size={14} color="#9BA1A6" />
          <TextInput
            placeholder="Search leagues or country..."
            placeholderTextColor="#9BA1A6"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-white text-xs ml-2"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={14} color="#9BA1A6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        {/* No results state */}
        {searchQuery.length > 0 && filteredLeagues.length === 0 && (
          <View className="items-center py-10">
            <Text className="text-gray-400 text-sm font-bold">No leagues found for "{searchQuery}"</Text>
          </View>
        )}

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
