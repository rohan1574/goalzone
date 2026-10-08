import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  SectionList,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Search, Star, ChevronDown, ChevronUp, X } from "lucide-react-native";
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
  onPressDetails?: (match: any) => void;
}

interface LeagueItem { id: string; name: string; logo: string; category: string; }
interface Section { title: string; isFav?: boolean; data: LeagueItem[]; }

export default function LeaguesView({ apiLeagues, onPressDetails }: LeaguesViewProps) {
  const [favorites, setFavorites] = useState<string[]>(["39", "140"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
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
    AsyncStorage.getItem(STORAGE_KEY)
      .then((s) => { if (s) setFavorites(JSON.parse(s)); })
      .catch(() => {});
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleCat = useCallback((cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  // Build SectionList sections
  const sections = useMemo<Section[]>(() => {
    const favs = filteredLeagues.filter((l) => favorites.includes(l.id));
    const catMap = new Map<string, LeagueItem[]>();
    for (const l of filteredLeagues) {
      if (!catMap.has(l.category)) catMap.set(l.category, []);
      catMap.get(l.category)!.push(l);
    }
    const catSections: Section[] = Array.from(catMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data: collapsedCats.has(title) ? [] : data }));
    return favs.length > 0
      ? [{ title: "⭐ Favorites", isFav: true, data: favs }, ...catSections]
      : catSections;
  }, [filteredLeagues, favorites, collapsedCats]);

  const renderItem = useCallback(
    ({ item, section }: { item: LeagueItem; section: Section }) => {
      const isFav = favorites.includes(item.id);
      return (
        <TouchableOpacity
          className="relative bg-[#131415] mx-4 mb-2 rounded-2xl px-4 py-3 border border-white/5 flex-row items-center"
          onPress={() => { setSelectedLeague(item as League); setDetailsVisible(true); }}
          activeOpacity={0.75}
        >
          <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54] rounded-l-2xl" />
          <Image source={{ uri: item.logo }} className="w-6 h-6 rounded-full" resizeMode="contain" />
          <Text className="text-white text-sm font-extrabold ml-3 flex-1" numberOfLines={1}>{item.name}</Text>
          {!section.isFav && (
            <TouchableOpacity onPress={() => toggleFavorite(item.id)} hitSlop={{ top:8, bottom:8, left:8, right:8 }} className="p-1">
              <Star size={16} color={isFav ? "#FFC800" : "#9BA1A6"} fill={isFav ? "#FFC800" : "none"} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    },
    [favorites, toggleFavorite]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => {
      const isCollapsed = !section.isFav && collapsedCats.has(section.title);
      return (
        <TouchableOpacity
          className="flex-row justify-between items-center px-4 py-3 bg-[#0D0E0F]"
          onPress={() => !section.isFav && toggleCat(section.title)}
          activeOpacity={section.isFav ? 1 : 0.7}
        >
          <Text className="text-white text-sm font-black">{section.title}</Text>
          {!section.isFav && (isCollapsed ? <ChevronDown size={16} color="#9BA1A6" /> : <ChevronUp size={16} color="#9BA1A6" />)}
        </TouchableOpacity>
      );
    },
    [collapsedCats, toggleCat]
  );

  if (!apiLeagues || apiLeagues.length === 0) {
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

      {searchQuery.length > 0 && filteredLeagues.length === 0 ? (
        <View className="items-center py-16">
          <Text className="text-gray-400 text-sm font-bold">No leagues found for "{searchQuery}"</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) => `${item.id}-${idx}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingBottom: 140, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={15}
          windowSize={8}
          initialNumToRender={20}
          removeClippedSubviews={true}
        />
      )}

      {/* Modal Detail Screen */}
      <LeagueDetailsModal
        visible={detailsVisible}
        league={selectedLeague}
        onClose={() => setDetailsVisible(false)}
        onPressDetails={onPressDetails}
      />
    </View>
  );
}
