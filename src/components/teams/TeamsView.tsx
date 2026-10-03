import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronDown, ChevronUp, Star } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { fetchCountries } from "../../services/footballApi";
import LeagueDetailsModal, { League } from "../leagues/LeagueDetailsModal";
import TeamDetailsModal, { Team } from "./TeamDetailsModal";

const STORAGE_KEY = "@goalzone_favorite_internationals";

const getCategoryForLeague = (name: string, country?: string) => {
  if (country && country !== "Unknown") return country;
  const lower = name.toLowerCase();
  if (
    lower.includes("premier") ||
    lower.includes("fa cup") ||
    lower.includes("efl") ||
    lower.includes("championship")
  )
    return "England";
  if (
    lower.includes("la liga") ||
    lower.includes("copa del rey") ||
    lower.includes("santander")
  )
    return "Spain";
  if (lower.includes("serie a") || lower.includes("coppa italia"))
    return "Italy";
  if (lower.includes("bundesliga") || lower.includes("dfb")) return "Germany";
  if (lower.includes("ligue 1") || lower.includes("coupe de france"))
    return "France";
  if (lower.includes("mls") || lower.includes("major league")) return "USA";
  if (lower.includes("saudi") || lower.includes("pro league"))
    return "Saudi Arabia";
  return "International Tournaments";
};

type InternationalItem =
  | (Team & { type: "team" })
  | (League & { type: "league" });

interface TeamsViewProps {
  apiTeams?: any[];
  apiLeagues?: any[];
}

export default function TeamsView({ apiTeams, apiLeagues }: TeamsViewProps) {
  const [favorites, setFavorites] = useState<string[]>(["8066"]);
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<any[]>([]);

  const [favSectionExpanded, setFavSectionExpanded] = useState(true);
  const [allSectionExpanded, setAllSectionExpanded] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<{
    [key: string]: boolean;
  }>({});

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [teamDetailsVisible, setTeamDetailsVisible] = useState(false);
  const [leagueDetailsVisible, setLeagueDetailsVisible] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // Only show full loading if we have no teams from props
    if (!apiTeams || apiTeams.length === 0) {
      setLoading(true);
    }
    try {
      const [favs, countriesList] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        fetchCountries(),
      ]);

      if (favs !== null) {
        setFavorites(JSON.parse(favs));
      }

      setCountries(countriesList || []);
    } catch (e) {
      console.warn("Failed to load initial data", e);
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
      console.warn("Failed to save favorite internationals", e);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // International teams (Countries) from API or apiTeams fallback
  const internationalTeamsList: Team[] = React.useMemo(() => {
    if (countries && countries.length > 0) {
      return countries.map((item: any) => ({
        id: item.name, // Use country name as ID to resolve in Modal
        name: item.name,
        logo:
          item.flag ||
          `https://media.api-sports.io/flags/${item.code?.toLowerCase()}.svg`,
        category: "Countries",
        country: item.name,
      }));
    }
    if (apiTeams && apiTeams.length > 0) {
      return apiTeams.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        logo: item.logo || `https://images.fotmob.com/image_resources/logo/teamlogo/${item.id}.png`,
        category: item.category || "Popular Teams",
        country: item.country || item.name,
      }));
    }
    return [];
  }, [countries, apiTeams]);

  // International tournaments (only) from API leagues
  const internationalLeaguesList: League[] = React.useMemo(() => {
    if (apiLeagues && apiLeagues.length > 0) {
      return apiLeagues
        .map((item: any) => {
          const id = String(
            item.id ||
              item.leagueId ||
              item.league_id ||
              Math.random().toString(),
          );
          const name =
            item.name || item.leagueName || item.league_name || "League";
          const logo =
            item.logo ||
            item.leagueLogo ||
            item.logoUrl ||
            `https://images.fotmob.com/image_resources/logo/leaguelogo/${id}.png`;
          const country = getCategoryForLeague(
            name,
            item.country || item.countryName || item.region,
          );
          return { id, name, logo, category: country };
        })
        .filter(
          (item: League) => item.category === "International Tournaments",
        );
    }
    return [];
  }, [apiLeagues]);

  // Combined list with a discriminator
  const itemsList: InternationalItem[] = React.useMemo(() => {
    const teams: InternationalItem[] = internationalTeamsList.map((t) => ({
      ...t,
      type: "team",
    }));
    const leagues: InternationalItem[] = internationalLeaguesList.map((l) => ({
      ...l,
      type: "league",
    }));
    return [...teams, ...leagues];
  }, [internationalTeamsList, internationalLeaguesList]);

  const categories = Array.from(new Set(itemsList.map((t) => t.category)));
  const favoriteItemsList = itemsList.filter((t) => favorites.includes(t.id));

  if (loading) {
    return (
      <View className="flex-1 bg-[#0D0E0F] items-center justify-center">
        <ActivityIndicator size="large" color="#02DB54" />
      </View>
    );
  }

  if (itemsList.length === 0) {
    return (
      <View className="flex-1 bg-[#0D0E0F]">
        <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-[#ffffff05]">
          <Text className="text-white text-22 font-black tracking-[1.5px]">
            TEAMS
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#02DB54" />
          <Text className="text-gray-400 text-xs font-bold mt-3 text-center">
            Loading international teams & tournaments...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0D0E0F]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-[#ffffff05]">
        <Text className="text-white text-22 font-black tracking-[1.5px]">
          INTERNATIONAL
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: Favorites */}
        <View className="mb-5">
          <TouchableOpacity
            className="flex-row justify-between items-center py-2 mb-3"
            onPress={() => setFavSectionExpanded(!favSectionExpanded)}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-black">Favorites</Text>
            {favSectionExpanded ? (
              <ChevronDown size={18} color="#9BA1A6" />
            ) : (
              <ChevronUp size={18} color="#9BA1A6" />
            )}
          </TouchableOpacity>

          {favSectionExpanded && (
            <View className="gap-3">
              {favoriteItemsList.length > 0 ? (
                favoriteItemsList.map((item) => {
                  const isTeam = item.type === "team";
                  const isFav = favorites.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={`${item.type}-${item.id}`}
                      className="relative bg-[#131415] rounded-2xl px-4 py-3.5 border border-white/5 flex-row items-center overflow-hidden"
                      onPress={() => {
                        if (isTeam) {
                          setSelectedTeam(item as Team);
                          setTeamDetailsVisible(true);
                        } else {
                          setSelectedLeague(item as League);
                          setLeagueDetailsVisible(true);
                        }
                      }}
                    >
                      <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54] rounded-l-2xl" />
                      <Image
                        source={{ uri: item.logo }}
                        className={
                          isTeam ? "w-8 h-8 rounded-xl" : "w-8 h-8 rounded-full"
                        }
                      />
                      <View className="flex-1 ml-3">
                        <Text
                          className="text-white text-sm font-extrabold"
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text className="text-gray-500 text-[10px] font-bold mt-0.5">
                          {isTeam
                            ? `National Team • ${(item as Team).country}`
                            : "International Tournament"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(item.id)}
                        className="p-1.5"
                      >
                        <Star size={18} color="#FFC800" fill="#FFC800" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text className="text-gray-400 text-xs font-bold text-center py-3">
                  No favorites added yet.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* SECTION 2: All international items */}
        <View className="mb-5">
          <TouchableOpacity
            className="flex-row justify-between items-center py-2 mb-3"
            onPress={() => setAllSectionExpanded(!allSectionExpanded)}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-black">
              All international
            </Text>
            {allSectionExpanded ? (
              <ChevronDown size={18} color="#9BA1A6" />
            ) : (
              <ChevronUp size={18} color="#9BA1A6" />
            )}
          </TouchableOpacity>

          {allSectionExpanded && (
            <View className="bg-[#131415] rounded-3xl border border-white/5 p-1">
              {categories.map((category) => {
                const categoryItems = itemsList.filter(
                  (t) => t.category === category,
                );
                const isCatExpanded = expandedCategories[category] !== false;

                return (
                  <View key={category} className="border-b border-white/3">
                    <TouchableOpacity
                      className="flex-row justify-between items-center px-3 py-3.5"
                      onPress={() => toggleCategory(category)}
                      activeOpacity={0.8}
                    >
                      <View className="flex-row items-center gap-2.5">
                        <Svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <Path
                            d="M12 2L2 7l10 5 10-5-10-5z"
                            stroke="#9BA1A6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <Path
                            d="M2 17l10 5 10-5"
                            stroke="#9BA1A6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <Path
                            d="M2 12l10 5 10-5"
                            stroke="#9BA1A6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                        <Text className="text-white text-sm font-black">
                          {category}
                        </Text>
                      </View>
                      {isCatExpanded ? (
                        <ChevronUp size={16} color="#9BA1A6" />
                      ) : (
                        <ChevronDown size={16} color="#9BA1A6" />
                      )}
                    </TouchableOpacity>

                    {isCatExpanded && (
                      <View className="px-2 pb-3 gap-2">
                        {categoryItems.map((item) => {
                          const isTeam = item.type === "team";
                          const isFav = favorites.includes(item.id);
                          return (
                            <TouchableOpacity
                              key={`${item.type}-${item.id}`}
                              className="relative bg-[#131415] rounded-2xl px-4 py-3.5 border border-white/5 flex-row items-center overflow-hidden"
                              onPress={() => {
                                if (isTeam) {
                                  setSelectedTeam(item as Team);
                                  setTeamDetailsVisible(true);
                                } else {
                                  setSelectedLeague(item as League);
                                  setLeagueDetailsVisible(true);
                                }
                              }}
                            >
                              <View className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#02DB54] rounded-l-2xl" />
                              <Image
                                source={{ uri: item.logo }}
                                className={
                                  isTeam
                                    ? "w-8 h-8 rounded-xl"
                                    : "w-8 h-8 rounded-full"
                                }
                              />
                              <View className="flex-1 ml-3">
                                <Text
                                  className="text-white text-sm font-extrabold"
                                  numberOfLines={1}
                                >
                                  {item.name}
                                </Text>
                                <Text className="text-gray-500 text-[10px] font-bold mt-0.5">
                                  {isTeam
                                    ? `National Team • ${(item as Team).country}`
                                    : "International Tournament"}
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => toggleFavorite(item.id)}
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

      {/* Modals */}
      <TeamDetailsModal
        visible={teamDetailsVisible}
        team={selectedTeam}
        onClose={() => setTeamDetailsVisible(false)}
      />
      <LeagueDetailsModal
        visible={leagueDetailsVisible}
        league={selectedLeague}
        onClose={() => setLeagueDetailsVisible(false)}
      />
    </View>
  );
}
