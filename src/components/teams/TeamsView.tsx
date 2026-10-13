import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronDown, ChevronUp, Search, Star, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fetchCountries } from "../../services/footballApi";
import RemoteLogo from "../common/RemoteLogo";
import LeagueDetailsModal, { League } from "../leagues/LeagueDetailsModal";
import TeamDetailsModal, { Team } from "./TeamDetailsModal";

const STORAGE_KEY = "@goalzone_favorite_internationals";
const TOURNAMENTS = "International Tournaments";
const NATIONAL_TEAMS = "National Teams";

// Continental / worldwide "countries" the API uses for international competitions
const INTERNATIONAL_REGIONS = new Set([
  "world", "international", "uefa", "europe", "south america", "conmebol",
  "north america", "concacaf", "asia", "afc", "africa", "caf", "oceania", "ofc",
]);

// Club competitions that belong to a country; everything else in the league list is international
const getCategoryForLeague = (name: string, country?: string) => {
  if (country && INTERNATIONAL_REGIONS.has(country.toLowerCase())) return TOURNAMENTS;
  if (country && country !== "Unknown") return country;
  const lower = name.toLowerCase();
  if (lower.includes("premier") || lower.includes("fa cup") || lower.includes("efl") || lower.includes("league cup") || lower.includes("community shield") || lower.includes("championship"))
    return "England";
  if (lower.includes("la liga") || lower.includes("copa del rey") || lower.includes("supercopa") || lower.includes("segunda")) return "Spain";
  if (lower.includes("serie a") || lower.includes("coppa italia") || lower.includes("supercoppa") || lower.includes("serie b")) return "Italy";
  if (lower.includes("bundesliga") || lower.includes("dfb") || lower.includes("dfl")) return "Germany";
  if (lower.includes("ligue 1") || lower.includes("coupe de france") || lower.includes("trophée") || lower.includes("trophee") || lower.includes("ligue 2")) return "France";
  if (lower.includes("brasileir") || lower.includes("copa do brasil") || lower.includes("supercopa do brasil")) return "Brazil";
  if (lower.includes("mls") || lower.includes("major league") || lower.includes("us open") || lower.includes("leagues cup")) return "USA";
  if (lower.includes("saudi") || lower.includes("pro league") || lower.includes("king's cup") || lower.includes("king cup") || lower.includes("super cup")) return "Saudi Arabia";
  return TOURNAMENTS;
};

type Item = (Team & { type: "team" }) | (League & { type: "league" });
interface Section {
  title: string;
  isFav?: boolean;
  data: Item[];
}

interface TeamsViewProps {
  apiTeams?: any[];
  apiLeagues?: any[];
  onPressDetails?: (match: any) => void;
}

const TeamRowItem = React.memo(function TeamRowItem({
  item,
  isFav,
  onOpen,
  onToggleFav,
}: {
  item: Item;
  isFav: boolean;
  onOpen: (item: Item) => void;
  onToggleFav: (id: string) => void;
}) {
  const isTeam = item.type === "team";
  return (
    <TouchableOpacity
      className="relative bg-[#131415] mx-4 mb-2 rounded-2xl px-4 py-3 border border-white/5 flex-row items-center overflow-hidden"
      onPress={() => onOpen(item)}
      activeOpacity={0.75}
    >
      <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54]" />
      <RemoteLogo uri={item.logo} label={item.name} plate={!isTeam} />
      <View className="flex-1 ml-3">
        <Text className="text-white text-sm font-extrabold" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-gray-500 text-[10px] font-bold mt-0.5">
          {isTeam ? "National team" : "International tournament"}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onToggleFav(item.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="p-1.5"
        accessibilityLabel={isFav ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
      >
        <Star size={18} color={isFav ? "#FFC800" : "#9BA1A6"} fill={isFav ? "#FFC800" : "none"} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

function TeamsView({ apiLeagues, onPressDetails }: TeamsViewProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [countries, setCountries] = useState<any[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [teamDetailsVisible, setTeamDetailsVisible] = useState(false);
  const [leagueDetailsVisible, setLeagueDetailsVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((s) => {
        if (s) setFavorites(JSON.parse(s));
      })
      .catch(() => {});
    fetchCountries()
      .then((list) => setCountries(list || []))
      .catch(() => setCountries([]));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleSection = useCallback((title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  }, []);

  const items = useMemo<Item[]>(() => {
    const tournaments: Item[] = (apiLeagues || [])
      .map((item: any) => {
        const id = String(item.id || item.leagueId || item.league_id || "");
        const name = item.name || item.leagueName || item.league_name || "League";
        return {
          type: "league" as const,
          id,
          name,
          logo: item.logo || item.leagueLogo || item.logoUrl || (id ? `https://media.api-sports.io/football/leagues/${id}.png` : ""),
          category: getCategoryForLeague(name, item.country || item.countryName || item.region),
        };
      })
      .filter((l) => l.id && l.category === TOURNAMENTS);

    const teams: Item[] = (countries || [])
      // "World" is the API's bucket for international competitions, not a national team
      .filter((c: any) => c?.name && c.code)
      .map((c: any) => ({
        type: "team" as const,
        id: c.name, // country name: TeamDetailsModal resolves it to the national team id
        name: String(c.name).replace(/-/g, " "),
        logo: c.flag || `https://media.api-sports.io/flags/${String(c.code).toLowerCase()}.svg`,
        category: NATIONAL_TEAMS,
        country: c.name,
      }));

    return [...tournaments, ...teams];
  }, [apiLeagues, countries]);

  const sections = useMemo<Section[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const visible = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    const favs = visible.filter((i) => favorites.includes(i.id));
    const groups = [TOURNAMENTS, NATIONAL_TEAMS]
      .map((title) => {
        const data = visible.filter((i) => i.category === title);
        return { title, data: collapsed.has(title) && !q ? [] : data, total: data.length };
      })
      .filter((s) => s.total > 0)
      .map(({ title, data }) => ({ title, data }));
    return favs.length > 0 ? [{ title: "Favorites", isFav: true, data: favs }, ...groups] : groups;
  }, [items, favorites, collapsed, searchQuery]);

  const openItem = useCallback((item: Item) => {
    if (item.type === "team") {
      setSelectedTeam(item);
      setTeamDetailsVisible(true);
    } else {
      setSelectedLeague(item);
      setLeagueDetailsVisible(true);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => (
      <TeamRowItem
        item={item}
        isFav={favorites.includes(item.id)}
        onOpen={openItem}
        onToggleFav={toggleFavorite}
      />
    ),
    [favorites, toggleFavorite, openItem],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => {
      const isCollapsed = !section.isFav && collapsed.has(section.title) && !searchQuery.trim();
      return (
        <TouchableOpacity
          className="flex-row justify-between items-center px-4 py-3 bg-[#0D0E0F]"
          onPress={() => !section.isFav && toggleSection(section.title)}
          activeOpacity={section.isFav ? 1 : 0.7}
        >
          <Text className="text-white text-sm font-black">
            {section.isFav ? "⭐ Favorites" : section.title}
          </Text>
          {!section.isFav &&
            (isCollapsed ? <ChevronDown size={16} color="#9BA1A6" /> : <ChevronUp size={16} color="#9BA1A6" />)}
        </TouchableOpacity>
      );
    },
    [collapsed, toggleSection, searchQuery],
  );

  const stillLoading = countries === null && items.length === 0;

  return (
    <View className="flex-1 bg-[#0D0E0F]">
      {/* Header */}
      <View className="px-4 py-3 border-b border-[#ffffff05]">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white text-[18px] font-black tracking-[1.5px]">INTERNATIONAL</Text>
          {items.length > 0 ? (
            <Text className="text-[#02DB54] text-xs font-bold">
              {items.filter((i) => i.type === "team").length} teams
            </Text>
          ) : null}
        </View>
        <View className="flex-row items-center bg-[#131415] rounded-2xl px-3 border border-white/5 h-9">
          <Search size={14} color="#9BA1A6" />
          <TextInput
            placeholder="Search countries or tournaments..."
            placeholderTextColor="#9BA1A6"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-white ml-2"
            // A fixed line height + Android's default padding clip the text inside the 36px bar
            style={{ height: 36, fontSize: 12, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} accessibilityLabel="Clear search">
              <X size={14} color="#9BA1A6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {stillLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#02DB54" />
          <Text className="text-gray-400 text-xs font-bold mt-3">Loading teams...</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="items-center py-16 px-8">
          <Text className="text-[#02DB54] font-black text-sm mb-1">Teams Unavailable</Text>
          <Text className="text-gray-400 text-xs text-center">
            We couldn't load national teams right now. Please try again later.
          </Text>
        </View>
      ) : sections.length === 0 ? (
        <View className="items-center py-16">
          <Text className="text-gray-400 text-sm font-bold">No results for "{searchQuery}"</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) => `${item.type}-${item.id}-${idx}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingBottom: 150, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          removeClippedSubviews={true}
          stickySectionHeadersEnabled={false}
        />
      )}

      <TeamDetailsModal
        visible={teamDetailsVisible}
        team={selectedTeam}
        onClose={() => setTeamDetailsVisible(false)}
        onPressDetails={onPressDetails}
      />
      <LeagueDetailsModal
        visible={leagueDetailsVisible}
        league={selectedLeague}
        onClose={() => setLeagueDetailsVisible(false)}
        onPressDetails={onPressDetails}
      />
    </View>
  );
}

export default React.memo(TeamsView);
