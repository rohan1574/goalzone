import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  SectionList,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Search, Star, ChevronDown, ChevronUp, X } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LeagueDetailsModal, { League } from "./LeagueDetailsModal";
import RemoteLogo from "../common/RemoteLogo";

const STORAGE_KEY = "@goalzone_favorite_leagues";

const getCategoryForLeague = (name: string, country?: string) => {
  const lower = (name || "").toLowerCase();
  const cLower = (country || "").toLowerCase();

  // England competitions
  if (
    cLower === "england" ||
    lower.includes("premier league") ||
    lower.includes("fa cup") ||
    lower.includes("league cup") ||
    lower.includes("efl") ||
    lower.includes("carabao") ||
    lower.includes("community shield") ||
    lower.includes("championship")
  ) {
    return "England";
  }

  // Spain competitions
  if (
    cLower === "spain" ||
    lower.includes("la liga") ||
    lower.includes("copa del rey") ||
    lower.includes("supercopa de españa") ||
    lower.includes("segunda división") ||
    lower.includes("segunda division")
  ) {
    return "Spain";
  }

  // Italy competitions
  if (
    cLower === "italy" ||
    lower.includes("serie a") ||
    lower.includes("coppa italia") ||
    lower.includes("supercoppa italiana") ||
    lower.includes("serie b")
  ) {
    return "Italy";
  }

  // Germany competitions
  if (
    cLower === "germany" ||
    lower.includes("bundesliga") ||
    lower.includes("dfb pokal") ||
    lower.includes("dfl-supercup") ||
    lower.includes("dfl supercup")
  ) {
    return "Germany";
  }

  // France competitions
  if (
    cLower === "france" ||
    lower.includes("ligue 1") ||
    lower.includes("coupe de france") ||
    lower.includes("trophée des champions") ||
    lower.includes("trophee des champions") ||
    lower.includes("ligue 2")
  ) {
    return "France";
  }

  // Brazil competitions
  if (
    cLower === "brazil" ||
    lower.includes("brasileirão") ||
    lower.includes("brasileirao") ||
    lower.includes("copa do brasil") ||
    lower.includes("supercopa do brasil")
  ) {
    return "Brazil";
  }

  // USA competitions
  if (
    cLower === "usa" ||
    cLower === "united states" ||
    lower.includes("mls") ||
    lower.includes("major league soccer") ||
    lower.includes("us open cup") ||
    lower.includes("leagues cup")
  ) {
    return "USA";
  }

  // Saudi Arabia competitions
  if (
    cLower === "saudi arabia" ||
    cLower === "saudi-arabia" ||
    lower.includes("saudi") ||
    lower.includes("pro league") ||
    lower.includes("king's cup") ||
    lower.includes("king cup") ||
    lower.includes("crown prince")
  ) {
    return "Saudi Arabia";
  }

  // AFC / Asian continental competitions
  if (lower.includes("afc") || lower.includes("asian") || cLower === "asia") {
    return "AFC / Asia";
  }

  // UEFA / European competitions (exclude AFC/CAF/CONCACAF)
  if (
    (lower.includes("champions league") ||
      lower.includes("europa league") ||
      lower.includes("conference league") ||
      lower.includes("nations league")) &&
    !lower.includes("afc") &&
    !lower.includes("caf") &&
    !lower.includes("concacaf")
  ) {
    return "UEFA";
  }

  if (lower.includes("copa libertadores") || lower.includes("copa sudamericana") || cLower === "south america") {
    return "South America";
  }

  if (
    lower.includes("world cup") ||
    lower.includes("olympic") ||
    lower.includes("club world cup") ||
    cLower === "world" ||
    cLower === "international"
  ) {
    return "International";
  }

  if (country && country !== "Unknown" && country !== "International" && country !== "World") return country;
  return country || "International";
};

export const DEFAULT_POPULAR_LEAGUES: LeagueItem[] = [
  // ── England ──
  { id: "39",  name: "Premier League",      logo: "https://media.api-sports.io/football/leagues/39.png",  category: "England" },
  { id: "45",  name: "FA Cup",              logo: "https://media.api-sports.io/football/leagues/45.png",  category: "England" },
  { id: "48",  name: "League Cup",          logo: "https://media.api-sports.io/football/leagues/48.png",  category: "England" },
  { id: "528", name: "Community Shield",    logo: "https://media.api-sports.io/football/leagues/528.png", category: "England" },
  { id: "40",  name: "Championship",        logo: "https://media.api-sports.io/football/leagues/40.png",  category: "England" },

  // ── Spain ──
  { id: "140", name: "La Liga",              logo: "https://media.api-sports.io/football/leagues/140.png", category: "Spain" },
  { id: "143", name: "Copa del Rey",         logo: "https://media.api-sports.io/football/leagues/143.png", category: "Spain" },
  { id: "556", name: "Supercopa de España",  logo: "https://media.api-sports.io/football/leagues/556.png", category: "Spain" },
  { id: "141", name: "Segunda División",     logo: "https://media.api-sports.io/football/leagues/141.png", category: "Spain" },

  // ── Italy ──
  { id: "135", name: "Serie A",              logo: "https://media.api-sports.io/football/leagues/135.png", category: "Italy" },
  { id: "137", name: "Coppa Italia",         logo: "https://media.api-sports.io/football/leagues/137.png", category: "Italy" },
  { id: "547", name: "Supercoppa Italiana",  logo: "https://media.api-sports.io/football/leagues/547.png", category: "Italy" },
  { id: "136", name: "Serie B",              logo: "https://media.api-sports.io/football/leagues/136.png", category: "Italy" },

  // ── Germany ──
  { id: "78",  name: "Bundesliga",           logo: "https://media.api-sports.io/football/leagues/78.png",  category: "Germany" },
  { id: "81",  name: "DFB Pokal",            logo: "https://media.api-sports.io/football/leagues/81.png",  category: "Germany" },
  { id: "529", name: "DFL-Supercup",         logo: "https://media.api-sports.io/football/leagues/529.png", category: "Germany" },
  { id: "79",  name: "2. Bundesliga",        logo: "https://media.api-sports.io/football/leagues/79.png",  category: "Germany" },

  // ── France ──
  { id: "61",  name: "Ligue 1",              logo: "https://media.api-sports.io/football/leagues/61.png",  category: "France" },
  { id: "66",  name: "Coupe de France",      logo: "https://media.api-sports.io/football/leagues/66.png",  category: "France" },
  { id: "526", name: "Trophée des Champions",logo: "https://media.api-sports.io/football/leagues/526.png", category: "France" },
  { id: "62",  name: "Ligue 2",              logo: "https://media.api-sports.io/football/leagues/62.png",  category: "France" },

  // ── Brazil ──
  { id: "71",  name: "Brasileirão Série A",  logo: "https://media.api-sports.io/football/leagues/71.png",  category: "Brazil" },
  { id: "73",  name: "Copa do Brasil",       logo: "https://media.api-sports.io/football/leagues/73.png",  category: "Brazil" },
  { id: "632", name: "Supercopa do Brasil",  logo: "https://media.api-sports.io/football/leagues/632.png", category: "Brazil" },
  { id: "72",  name: "Brasileirão Série B",  logo: "https://media.api-sports.io/football/leagues/72.png",  category: "Brazil" },

  // ── USA ──
  { id: "253", name: "MLS",                  logo: "https://media.api-sports.io/football/leagues/253.png", category: "USA" },
  { id: "257", name: "US Open Cup",          logo: "https://media.api-sports.io/football/leagues/257.png", category: "USA" },
  { id: "772", name: "Leagues Cup",          logo: "https://media.api-sports.io/football/leagues/772.png", category: "USA" },

  // ── Saudi Arabia ──
  { id: "307", name: "Saudi Pro League",     logo: "https://media.api-sports.io/football/leagues/307.png", category: "Saudi Arabia" },
  { id: "504", name: "King Cup of Champions",logo: "https://media.api-sports.io/football/leagues/504.png", category: "Saudi Arabia" },
  { id: "826", name: "Saudi Super Cup",      logo: "https://media.api-sports.io/football/leagues/826.png", category: "Saudi Arabia" },

  // ── Asia ──
  { id: "17",  name: "AFC Champions League Elite", logo: "https://media.api-sports.io/football/leagues/17.png", category: "AFC / Asia" },
  { id: "18",  name: "AFC Champions League Two",   logo: "https://media.api-sports.io/football/leagues/18.png", category: "AFC / Asia" },

  // ── Europe & International ──
  { id: "2",   name: "UEFA Champions League",logo: "https://media.api-sports.io/football/leagues/2.png",   category: "UEFA" },
  { id: "3",   name: "UEFA Europa League",   logo: "https://media.api-sports.io/football/leagues/3.png",   category: "UEFA" },
  { id: "848", name: "UEFA Conference League",logo: "https://media.api-sports.io/football/leagues/848.png",category: "UEFA" },
  { id: "5",   name: "UEFA Nations League",  logo: "https://media.api-sports.io/football/leagues/5.png",   category: "UEFA" },
  { id: "13",  name: "Copa Libertadores",    logo: "https://media.api-sports.io/football/leagues/13.png",  category: "South America" },
  { id: "88",  name: "Eredivisie",           logo: "https://media.api-sports.io/football/leagues/88.png",  category: "Netherlands" },
  { id: "94",  name: "Primeira Liga",        logo: "https://media.api-sports.io/football/leagues/94.png",  category: "Portugal" },
  { id: "128", name: "Liga Profesional",     logo: "https://media.api-sports.io/football/leagues/128.png", category: "Argentina" },
];

interface LeaguesViewProps {
  apiLeagues?: any[];
  onPressDetails?: (match: any) => void;
}

interface LeagueItem { id: string; name: string; logo: string; category: string; }
interface Section { title: string; isFav?: boolean; data: LeagueItem[]; }

function LeaguesView({ apiLeagues, onPressDetails }: LeaguesViewProps) {
  const [favorites, setFavorites] = useState<string[]>(["39", "140"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Parse leagues from API data and merge with default popular leagues
  const leaguesList = useMemo(() => {
    const list: LeagueItem[] = [];
    const seen = new Set<string>();

    if (apiLeagues && apiLeagues.length > 0) {
      apiLeagues.forEach((item: any) => {
        const id = String(item.id || item.leagueId || item.league_id || "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        const name = item.name || item.leagueName || item.league_name || "League";
        const logo = item.logo || item.leagueLogo || item.logoUrl || `https://media.api-sports.io/football/leagues/${id}.png`;
        const country = getCategoryForLeague(name, item.country || item.countryName || item.region);
        list.push({ id, name, logo, category: country });
      });
    }

    // Merge in defaults if not present
    DEFAULT_POPULAR_LEAGUES.forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        list.push(d);
      }
    });

    return list;
  }, [apiLeagues]);

  const filteredLeagues = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return leaguesList;
    const q = searchQuery.toLowerCase().trim();
    return leaguesList.filter(
      (l) => (l.name ? l.name.toLowerCase().includes(q) : false) || (l.category ? l.category.toLowerCase().includes(q) : false)
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
    ({ item }: { item: LeagueItem }) => {
      const isFav = favorites.includes(item.id);
      return (
        <TouchableOpacity
          className="relative bg-[#131415] mx-4 mb-2 rounded-2xl px-4 py-3 border border-white/5 flex-row items-center"
          onPress={() => { setSelectedLeague(item as League); setDetailsVisible(true); }}
          activeOpacity={0.75}
        >
          <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54] rounded-l-2xl" />
          <RemoteLogo uri={item.logo} label={item.name} size={28} plate />
          <Text className="text-white text-sm font-extrabold ml-3 flex-1" numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity
            onPress={() => toggleFavorite(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="p-1"
            accessibilityLabel={isFav ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
          >
            <Star size={16} color={isFav ? "#FFC800" : "#9BA1A6"} fill={isFav ? "#FFC800" : "none"} />
          </TouchableOpacity>
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

  // undefined = dashboard still loading; [] = loaded but the backend had no leagues
  if (!apiLeagues || apiLeagues.length === 0) {
    return (
      <View className="flex-1 bg-[#0D0E0F] items-center justify-center px-8">
        {apiLeagues ? (
          <>
            <Text className="text-[#02DB54] font-black text-sm mb-1">Leagues Unavailable</Text>
            <Text className="text-gray-400 text-xs text-center">
              We couldn't load the league list. Pull to refresh on the Explore tab and try again.
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#02DB54" />
            <Text className="text-gray-400 text-xs mt-3">Loading leagues...</Text>
          </>
        )}
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
            className="flex-1 text-white ml-2"
            // A fixed line height + Android's default padding clip the text inside the 36px bar
            style={{ height: 36, fontSize: 12, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }}
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
          removeClippedSubviews={false}
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

export default React.memo(LeaguesView);
