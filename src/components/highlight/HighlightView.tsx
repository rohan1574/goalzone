import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Newspaper, Play, RotateCw } from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { fetchFootballNews, fetchVideoHighlights, VideoHighlight } from "../../services/footballApi";

interface NewsItem {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  link: string;
  published?: string;
  date?: string;
}

interface HighlightViewProps {
  isActive?: boolean;
}

// Order of the competition filter chips (only competitions with videos are shown)
const COMPETITION_ORDER = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "UEFA", "Sky Sports"];
const FEATURED_COUNT = 3;
const CAROUSEL_INTERVAL_MS = 5000;

// "Just now", "25m ago", "3h ago", "2d ago", then a short date
const timeAgo = (value?: string) => {
  const ms = Date.parse(value || "");
  if (isNaN(ms)) return "";
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString([], { day: "numeric", month: "short" });
};

// Sky Sports photos are 1920x1080 (8 MB each once decoded); about 20 of them exhaust Android's
// image memory and the rest fail to load. Their CDN also serves 768x432 and 384x216.
const skyImage = (uri: string | undefined, size: "768x432" | "384x216") =>
  uri?.includes("365dm.com") ? uri.replace(/\/\d{3,4}x\d{3,4}\//, `/${size}/`) : uri;

const openLink = (url?: string) => {
  if (url) Linking.openURL(url).catch((err) => console.warn("Couldn't open link", err));
};

const Thumbnail = ({ uri, style }: { uri?: string; style: any }) => {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={style} className="bg-[#1E2022] items-center justify-center">
        <Newspaper size={20} color="#4B5563" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      // Decode at display size instead of full resolution
      resizeMethod="resize"
      onError={() => setFailed(true)}
    />
  );
};

const StateMessage = ({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) => (
  <View className="mx-4 mt-2 py-12 px-6 items-center bg-[#131415] rounded-3xl border border-white/5">
    <Text className="text-[#02DB54] font-black text-sm mb-1">{title}</Text>
    <Text className="text-gray-400 font-bold text-xs text-center">{body}</Text>
    {onRetry ? (
      <TouchableOpacity
        onPress={onRetry}
        className="mt-4 px-4 py-2 bg-[#02DB54]/10 border border-[#02DB54]/40 rounded-full flex-row items-center gap-1.5"
      >
        <RotateCw size={13} color="#02DB54" />
        <Text className="text-[#02DB54] text-xs font-bold">Try Again</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

function HighlightView({ isActive = true }: HighlightViewProps) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 32;
  const [subTab, setSubTab] = useState<"videos" | "news">("videos");

  // Videos
  const [videos, setVideos] = useState<VideoHighlight[]>([]);
  const [videosState, setVideosState] = useState<"loading" | "ready" | "error">("loading");
  const [competition, setCompetition] = useState<string>("All");

  // News
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsState, setNewsState] = useState<"loading" | "ready" | "error">("loading");
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  const [refreshing, setRefreshing] = useState(false);

  const loadVideos = useCallback(async (force = false) => {
    try {
      const data = await fetchVideoHighlights(force);
      setVideos(data);
      setVideosState("ready");
    } catch (err) {
      console.warn("Failed to load highlights:", err);
      // Keep showing what we already have; only show the error screen when there's nothing
      setVideosState((prev) => (prev === "ready" ? prev : "error"));
    }
  }, []);

  const loadNews = useCallback(async (force = false) => {
    const data = await fetchFootballNews(force);
    if (Array.isArray(data) && data.length > 0) {
      setNews(data);
      setNewsState("ready");
    } else {
      setNewsState((prev) => (prev === "ready" ? prev : "error"));
    }
  }, []);

  useEffect(() => {
    loadVideos();
    loadNews();
  }, [loadVideos, loadNews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await (subTab === "videos" ? loadVideos(true) : loadNews(true));
    setRefreshing(false);
  }, [subTab, loadVideos, loadNews]);

  const competitions = useMemo(() => {
    const present = new Set(videos.map((v) => v.competition));
    return ["All", ...COMPETITION_ORDER.filter((c) => present.has(c))];
  }, [videos]);
  const filteredVideos = useMemo(
    () => (competition === "All" ? videos : videos.filter((v) => v.competition === competition)),
    [videos, competition],
  );

  const featuredNews = news.slice(0, FEATURED_COUNT);
  const latestNews = news.slice(FEATURED_COUNT);

  // Featured news carousel: advances every few seconds while visible; a manual swipe restarts the timer
  useEffect(() => {
    if (!isActive || subTab !== "news" || featuredNews.length <= 1) return;
    const timer = setTimeout(() => {
      const next = (activeIndex + 1) % featuredNews.length;
      carouselRef.current?.scrollTo({ x: next * cardWidth, animated: true });
      setActiveIndex(next);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isActive, subTab, activeIndex, featuredNews.length, cardWidth]);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#02DB54" colors={["#02DB54"]} />
  );

  const renderVideos = () => {
    if (videosState === "loading") return <ActivityIndicator color="#02DB54" className="mt-16" />;
    if (videosState === "error" || videos.length === 0) {
      return (
        <StateMessage
          title="Highlights Unavailable"
          body="We couldn't load the latest highlights. Check your connection and try again."
          onRetry={() => {
            setVideosState("loading");
            loadVideos(true);
          }}
        />
      );
    }
    const [featured, ...rest] = filteredVideos;
    return (
      <>
        {/* Competition filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          className="mb-4 flex-grow-0"
        >
          {competitions.map((c) => {
            const selected = c === competition;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCompetition(c)}
                className={`px-4 py-2 rounded-full border ${selected ? "border-[#02DB54] bg-[#02DB54]/10" : "border-white/10 bg-[#131415]"}`}
              >
                <Text className={`text-xs font-black ${selected ? "text-[#02DB54]" : "text-gray-400"}`} numberOfLines={1}>
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {featured ? (
          <TouchableOpacity
            className="mx-4 bg-[#131415] rounded-3xl border border-white/5 overflow-hidden mb-4"
            activeOpacity={0.9}
            onPress={() => openLink(featured.url)}
            accessibilityRole="button"
            accessibilityLabel={`Play ${featured.title}`}
          >
            <View style={{ width: cardWidth, height: (cardWidth * 9) / 16 }} className="items-center justify-center">
              <Thumbnail uri={featured.thumbnail} style={{ position: "absolute", width: "100%", height: "100%" }} />
              <View className="absolute inset-0 bg-black/25" />
              <View className="bg-white/90 w-14 h-14 rounded-full items-center justify-center">
                <Play size={24} color="#0D0E0F" fill="#0D0E0F" style={{ marginLeft: 3 }} />
              </View>
              <View className="absolute top-3 left-3 bg-[#0D0E0F]/85 border border-white/10 px-2.5 py-1 rounded-lg">
                <Text className="text-white text-[10px] font-black">{featured.competition}</Text>
              </View>
            </View>
            <View className="p-4">
              <Text className="text-white text-sm font-extrabold leading-5" numberOfLines={2}>
                {featured.title}
              </Text>
              <Text className="text-gray-500 text-[11px] font-bold mt-1.5">
                {featured.channel} · {timeAgo(featured.published)}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <View className="mx-4 gap-3">
          {rest.map((video) => (
            <TouchableOpacity
              key={video.id}
              className="flex-row bg-[#131415] rounded-2xl border border-white/5 overflow-hidden"
              activeOpacity={0.85}
              onPress={() => openLink(video.url)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${video.title}`}
            >
              <View style={{ width: 136, height: 77 }} className="items-center justify-center">
                <Thumbnail uri={video.thumbnail} style={{ position: "absolute", width: 136, height: 77 }} />
                <View className="bg-black/60 w-8 h-8 rounded-full items-center justify-center">
                  <Play size={14} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
                </View>
              </View>
              <View className="flex-1 px-3 py-2 justify-between">
                <Text className="text-white text-xs font-extrabold leading-4" numberOfLines={2}>
                  {video.title}
                </Text>
                <Text className="text-gray-500 text-[10px] font-bold" numberOfLines={1}>
                  {video.competition} · {timeAgo(video.published)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-gray-600 text-[10px] font-bold text-center mt-5 px-8">
          Highlights from official league and Sky Sports channels · opens in YouTube
        </Text>
      </>
    );
  };

  const renderNews = () => {
    if (newsState === "loading") return <ActivityIndicator color="#02DB54" className="mt-16" />;
    if (newsState === "error" || news.length === 0) {
      return (
        <StateMessage
          title="News Unavailable"
          body="We couldn't load the latest football news. Check your connection and try again."
          onRetry={() => {
            setNewsState("loading");
            loadNews(true);
          }}
        />
      );
    }
    return (
      <>
        {/* Featured stories carousel */}
        <View className="mx-4">
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
              if (index >= 0 && index < featuredNews.length) setActiveIndex(index);
            }}
            style={{ width: cardWidth }}
          >
            {featuredNews.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={{ width: cardWidth, height: 224 }}
                className="rounded-3xl border border-white/5 overflow-hidden justify-end"
                activeOpacity={0.9}
                onPress={() => openLink(item.link)}
              >
                <Thumbnail uri={skyImage(item.thumbnail, "768x432")} style={{ position: "absolute", width: "100%", height: "100%" }} />
                {/* Darker towards the bottom so the headline stays readable on any photo */}
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)" }} />
                <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "62%", backgroundColor: "rgba(0,0,0,0.6)" }} />
                <View className="p-4 gap-1.5">
                  <View className="flex-row items-center gap-1.5 self-start bg-[#02DB54]/20 border border-[#02DB54]/40 px-2.5 py-0.5 rounded-full">
                    <Newspaper size={10} color="#02DB54" />
                    <Text className="text-[#02DB54] text-[9px] font-black uppercase tracking-wider">
                      Sky Sports{item.published ? ` · ${timeAgo(item.published)}` : ""}
                    </Text>
                  </View>
                  <Text className="text-white text-base font-black leading-tight" numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text className="text-gray-300 text-[11px] font-semibold" numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {featuredNews.length > 1 ? (
            <View className="flex-row justify-center items-center gap-1.5 mt-3">
              {featuredNews.map((_, idx) => (
                <View
                  key={idx}
                  className={`h-1.5 rounded-full ${idx === activeIndex ? "w-4 bg-[#02DB54]" : "w-1.5 bg-gray-600"}`}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* Remaining stories */}
        {latestNews.length > 0 ? (
          <View className="mt-6 mx-4">
            <Text className="text-white text-base font-extrabold mb-3">Latest Stories</Text>
            <View className="gap-3">
              {latestNews.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  className="flex-row bg-[#131415] rounded-2xl border border-white/5 overflow-hidden"
                  activeOpacity={0.85}
                  onPress={() => openLink(item.link)}
                >
                  <Thumbnail uri={skyImage(item.thumbnail, "384x216")} style={{ width: 112, height: 84 }} />
                  <View className="flex-1 px-3 py-2 justify-between">
                    <Text className="text-white text-xs font-extrabold leading-4" numberOfLines={3}>
                      {item.title}
                    </Text>
                    <Text className="text-gray-500 text-[10px] font-bold">
                      Sky Sports{item.published ? ` · ${timeAgo(item.published)}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </>
    );
  };

  return (
    <View className="flex-1 bg-[#0D0E0F]">
      <View className="px-4 py-3.5 border-b border-[#ffffff05]">
        <Text className="text-white text-[18px] font-black tracking-[1.5px] uppercase">Highlights & News</Text>
      </View>

      {/* Videos / News switch */}
      <View className="flex-row bg-[#131415] rounded-3xl mx-4 my-3.5 p-1 border border-white/5">
        {(
          [
            { id: "videos", label: "Video Highlights" },
            { id: "news", label: "Latest News" },
          ] as const
        ).map(({ id, label }) => {
          const selected = subTab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setSubTab(id)}
              className={`flex-1 py-2.5 rounded-2xl items-center justify-center ${selected ? "bg-[#02DB54]/10 border border-[#02DB54]" : ""}`}
            >
              <Text className={`text-sm font-black ${selected ? "text-white" : "text-[#9BA1A6]"}`}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        key={subTab}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {subTab === "videos" ? renderVideos() : renderNews()}
      </ScrollView>
    </View>
  );
}

export default React.memo(HighlightView);
