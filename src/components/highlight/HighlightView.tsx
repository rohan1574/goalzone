import { Newspaper, Play } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { fetchFootballNews, fetchHighlights } from "../../services/footballApi";

const { width } = Dimensions.get("window");

export default function HighlightView() {
  const [activeIndex, setActiveIndex] = useState(0);
  const directionRef = useRef(1); // 1 = forward (left-to-right), -1 = backward (right-to-left)
  const scrollViewRef = useRef<ScrollView>(null);
  const itemWidth = width - 32;

  // Tab State
  const [subTab, setSubTab] = useState<"videos" | "news">("videos");

  // Data states
  const [news, setNews] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [newsData, highlightsData] = await Promise.all([
        fetchFootballNews(),
        fetchHighlights(),
      ]);
      setNews(newsData);
      setHighlights(highlightsData);
    } catch (e) {
      console.warn("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  // Mock data as fallback if API has no news
  const fallbackFeatured = [
    {
      id: "feat-recap-1",
      title: "Champions League Semifinal Recap: Real Madrid vs Man City",
      thumbnail:
        "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500",
      description: "A thriller at the Bernabeu as City fights back.",
      date: "August 2026",
      link: "https://www.skysports.com/football",
    },
    {
      id: "feat-recap-2",
      title: "La Liga: Barcelona secures vital three points in El Clasico",
      thumbnail:
        "https://images.unsplash.com/photo-1540747737956-37872f747d7d?w=500",
      description: "A late goal by Lewandowski seals the match.",
      date: "August 2026",
      link: "https://www.skysports.com/football",
    },
  ];

  const featuredList = news.length > 0 ? news.slice(0, 3) : fallbackFeatured;
  const trendingList = news.length > 3 ? news.slice(3, 7) : news;
  const latestList = news.length > 7 ? news.slice(7) : news;

  // Video highlights list (use API data or mock fallback)
  const videoHighlights =
    highlights.length > 0
      ? highlights
      : [
          {
            id: "vid-1",
            title: "Real Madrid 3 - 2 Barcelona | El Clasico Highlights",
            league: "La Liga",
            leagueLogo:
              "https://images.fotmob.com/image_resources/logo/leaguelogo/87.png",
            thumbnail:
              "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600",
            duration: "10:15",
            date: "Yesterday",
            videoUrl: "https://www.youtube.com/watch?v=M5FwM-f8d2M",
          },
          {
            id: "vid-2",
            title: "Manchester City 2 - 2 Liverpool | Goals & Recap",
            league: "Premier League",
            leagueLogo:
              "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png",
            thumbnail:
              "https://images.unsplash.com/photo-1540747737956-37872f747d7d?w=600",
            duration: "08:40",
            date: "2 days ago",
            videoUrl: "https://www.youtube.com/watch?v=w7wK4m6wF5g",
          },
        ];

  // Auto scroll effect for Featured news banner
  useEffect(() => {
    if (featuredList.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => {
        let nextIndex = prevIndex + directionRef.current;

        if (nextIndex >= featuredList.length) {
          nextIndex = featuredList.length - 2;
          directionRef.current = -1;
        } else if (nextIndex < 0) {
          nextIndex = 1;
          directionRef.current = 1;
        }

        scrollViewRef.current?.scrollTo({
          x: nextIndex * itemWidth,
          animated: true,
        });

        return nextIndex;
      });
    }, 4000); // Scroll every 4 seconds

    return () => clearInterval(interval);
  }, [itemWidth, featuredList.length]);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / itemWidth);
    if (index !== activeIndex && index >= 0 && index < featuredList.length) {
      setActiveIndex(index);
      if (index === featuredList.length - 1) {
        directionRef.current = -1;
      } else if (index === 0) {
        directionRef.current = 1;
      }
    }
  };

  const handleOpenLink = (url: string) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        console.error("Couldn't load page", err),
      );
    }
  };

  return (
    <View className="flex-1 bg-[#0D0E0F]">
      {/* Header section matching screenshot */}
      <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-[#ffffff05]">
        <Text className="text-white text-22 font-black tracking-[1.5px] uppercase">
          HIGHLIGHTS & NEWS
        </Text>
        {/* <TouchableOpacity className="p-2 rounded-full bg-white/5 relative">
          <Bell size={18} color="#ECEDEE" />
          <View className="absolute top-2 right-2 w-2 h-2 bg-[#02DB54] rounded-full" />
        </TouchableOpacity> */}
      </View>

      {/* Sub-tab Selection */}
      <View className="flex-row bg-[#131415] rounded-3xl mx-4 my-3.5 p-1 border border-white/5">
        <TouchableOpacity
          onPress={() => setSubTab("videos")}
          className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${
            subTab === "videos" ? "bg-[#02DB54]/10 border border-[#02DB54]" : ""
          }`}
        >
          <Text
            className={`text-sm font-black ${
              subTab === "videos" ? "text-white" : "text-[#9BA1A6]"
            }`}
          >
            Video Highlights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSubTab("news")}
          className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${
            subTab === "news" ? "bg-[#02DB54]/10 border border-[#02DB54]" : ""
          }`}
        >
          <Text
            className={`text-sm font-black ${
              subTab === "news" ? "text-white" : "text-[#9BA1A6]"
            }`}
          >
            Latest News
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#02DB54" />
        </View>
      ) : subTab === "videos" ? (
        /* Video Highlights Screen */
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
        >
          {videoHighlights.map((item) => (
            <TouchableOpacity
              key={item.id}
              className="bg-[#131415] rounded-3xl border border-white/5 overflow-hidden mb-5"
              activeOpacity={0.9}
              onPress={() => handleOpenLink(item.videoUrl)}
            >
              {/* Video Thumbnail Container */}
              <View className="h-48 w-full relative justify-center items-center">
                <Image
                  source={{ uri: item.thumbnail }}
                  className="absolute inset-0 w-full h-full"
                  resizeMode="cover"
                />
                <View className="absolute inset-0 bg-black/40" />

                {/* Play Button Overlay */}
                <View className="bg-white/90 w-14 h-14 rounded-full items-center justify-center shadow-lg shadow-black/50">
                  <Play
                    size={24}
                    color="#0D0E0F"
                    fill="#0D0E0F"
                    style={{ marginLeft: 3 }}
                  />
                </View>

                {/* Duration Badge */}
                <View className="absolute bottom-3 right-3 bg-black/75 px-2.5 py-1 rounded-lg">
                  <Text className="text-white text-[10px] font-black">
                    {item.duration}
                  </Text>
                </View>

                {/* League Badge */}
                <View className="absolute top-3 left-3 bg-[#0D0E0F]/80 border border-white/10 px-2.5 py-1 rounded-lg flex-row items-center gap-1.5">
                  <Image
                    source={{ uri: item.leagueLogo }}
                    className="w-3.5 h-3.5"
                    resizeMode="contain"
                  />
                  <Text className="text-white text-[9px] font-black">
                    {item.league}
                  </Text>
                </View>
              </View>

              {/* Match Details Area */}
              <View className="p-4 gap-3">
                {/* Title & Date */}
                <View className="flex-row justify-between items-start">
                  <Text
                    className="text-white text-sm font-black flex-1 mr-2"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text className="text-gray-500 text-[10px] font-bold mt-1">
                    {item.date}
                  </Text>
                </View>

                {/* Score Info Badge (Simple) */}
                <View className="flex-row items-center gap-2">
                  <View className="bg-[#02DB54]/10 border border-[#02DB54]/30 px-2.5 py-0.5 rounded-lg">
                    <Text className="text-[#02DB54] text-[10px] font-black">
                      Full Highlights
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View className="h-28" />
        </ScrollView>
      ) : (
        /* Latest News Screen (Original RSS View) */
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO: Auto-scrolling Featured News Card */}
          <View className="mx-4 mt-4">
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
              decelerationRate="fast"
              snapToInterval={itemWidth}
              snapToAlignment="center"
              style={{ width: itemWidth }}
            >
              {featuredList.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={{ width: itemWidth }}
                  className="bg-[#131415] rounded-3xl border border-white/5 overflow-hidden relative h-56 justify-end p-4"
                  activeOpacity={0.9}
                  onPress={() => handleOpenLink(item.link)}
                >
                  {/* Background Thumbnail Image with Dark Overlay */}
                  <Image
                    source={{ uri: item.thumbnail }}
                    className="absolute inset-0 w-full h-full opacity-40"
                    resizeMode="cover"
                  />
                  <View className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  {/* News metadata overlay */}
                  <View className="z-10 gap-1.5">
                    <View className="flex-row items-center gap-1.5 self-start bg-[#02DB54]/10 border border-[#02DB54]/30 px-2.5 py-0.5 rounded-full mb-1">
                      <Newspaper size={10} color="#02DB54" />
                      <Text className="text-[#02DB54] text-[9px] font-black uppercase tracking-wider">
                        SKY NEWS
                      </Text>
                    </View>
                    <Text
                      className="text-white text-base font-black leading-tight"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text
                      className="text-gray-400 text-[10px] font-bold"
                      numberOfLines={1}
                    >
                      {item.description || "Read full article on Sky Sports..."}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Carousel dots indicators mapping index */}
            <View className="flex-row justify-center items-center gap-1.5 mt-3">
              {featuredList.map((_, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <View
                    key={idx}
                    className={`h-1.5 rounded-full ${
                      isActive ? "w-4 bg-[#02DB54]" : "w-1.5 bg-gray-600"
                    }`}
                  />
                );
              })}
            </View>
          </View>

          {/* SECTION 1: Trending News */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between px-4 mb-3.5">
              <Text className="text-white text-base font-extrabold">
                🔥 Trending News
              </Text>
              <TouchableOpacity>
                <Text className="text-[#02DB54] text-sm font-black">
                  View all
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
            >
              {trendingList.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  className="bg-[#131415] rounded-3xl border border-white/5 overflow-hidden w-[280px]"
                  activeOpacity={0.8}
                  onPress={() => handleOpenLink(item.link)}
                >
                  <View className="h-38 w-full relative">
                    <Image
                      source={{ uri: item.thumbnail }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <View className="absolute inset-0 bg-black/30" />
                  </View>

                  <View className="p-3.5">
                    <Text
                      className="text-white font-extrabold text-sm leading-tight mb-1"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text
                      className="text-gray-400 text-xs font-semibold"
                      numberOfLines={1}
                    >
                      {item.description || "Click to read details."}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* SECTION 2: More News */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between px-4 mb-3.5">
              <Text className="text-white text-base font-extrabold">
                Latest Stories
              </Text>
              <TouchableOpacity>
                <Text className="text-[#02DB54] text-sm font-black">
                  View all
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
            >
              {latestList.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  className="bg-[#131415] rounded-3xl border border-white/5 overflow-hidden w-[280px]"
                  activeOpacity={0.8}
                  onPress={() => handleOpenLink(item.link)}
                >
                  <View className="h-38 w-full relative">
                    <Image
                      source={{ uri: item.thumbnail }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <View className="absolute inset-0 bg-black/30" />
                  </View>

                  <View className="p-3.5">
                    <Text
                      className="text-white font-extrabold text-sm leading-tight mb-1"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text
                      className="text-gray-400 text-xs font-semibold"
                      numberOfLines={1}
                    >
                      {item.description || "Click to read details."}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View className="h-28" />
        </ScrollView>
      )}
    </View>
  );
}
