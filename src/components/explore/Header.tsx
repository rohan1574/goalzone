import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { router } from "expo-router";
import {
  Menu,
  Search,
  Bell,
  RotateCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react-native";
import Svg, { Polygon, Path } from "react-native-svg";

interface HeaderProps {
  selectedDate: Date;
  onPrevDate: () => void;
  onNextDate: () => void;
  onRefresh: () => void;
  showDateSelector: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export default function Header({
  selectedDate,
  onPrevDate,
  onNextDate,
  onRefresh,
  showDateSelector,
  searchQuery,
  onSearchQueryChange,
}: HeaderProps) {
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

  const formatDateString = (date: Date) => {
    const day = date.getDate();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const [isSearching, setIsSearching] = useState(false);

  const today = new Date();
  const isToday =
    selectedDate.getDate() === today.getDate() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getFullYear() === today.getFullYear();

  return (
    <View>
      {/* Main Header Bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#ffffff05] bg-[#0D0E0F] h-[58px]">
        {isSearching ? (
          <View className="flex-row items-center flex-1 h-full">
            <TextInput
              placeholder="Search teams or leagues..."
              placeholderTextColor="#9BA1A6"
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              className="flex-1 bg-[#131415] text-white px-4 py-2 rounded-2xl border border-white/5 text-xs h-9 mr-2"
              autoFocus
            />
            <TouchableOpacity 
              onPress={() => {
                setIsSearching(false);
                onSearchQueryChange("");
              }}
              className="p-2 bg-white/5 rounded-full"
            >
              <X size={16} color="#ECEDEE" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Menu drawer button */}
            <TouchableOpacity onPress={() => router.push("/settings")} className="p-1">
              <Menu size={24} color="#ECEDEE" />
            </TouchableOpacity>

            {/* Brand title */}
            <Text className="text-xl font-black text-white tracking-widest uppercase">
              LIVE <Text className="text-[#02DB54]">SCORES</Text>
            </Text>

            {/* Action icons stack on right */}
            <View className="flex-row items-center gap-3">
              <TouchableOpacity 
                onPress={() => setIsSearching(true)}
                className="p-1 bg-white/5 rounded-full"
              >
                <Search size={18} color="#ECEDEE" />
              </TouchableOpacity>
              <TouchableOpacity className="p-1 bg-white/5 rounded-full relative">
                <Bell size={18} color="#ECEDEE" />
                <View className="absolute top-1 right-1 w-2 h-2 bg-[#02DB54] rounded-full" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onRefresh} className="p-1 bg-white/5 rounded-full">
                <RotateCw size={18} color="#ECEDEE" />
              </TouchableOpacity>

              {/* Premium hexagon badge */}
              <TouchableOpacity>
                <PremiumHexagonBadge />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Date Navigation Bar Component */}
      {showDateSelector && (
        <View className="px-4 py-3 bg-[#0D0E0F]">
          <View className="bg-[#131415] rounded-3xl p-3 flex-row justify-between items-center border border-[#ffffff08]">
            <View className="flex-row items-center gap-2.5 pl-1.5">
              <Calendar size={18} color="#02DB54" />
              <View>
                <Text className="text-white font-extrabold text-sm">
                  {isToday ? "Today" : "Date Selected"}
                </Text>
                <Text className="text-gray-400 text-xs font-bold mt-0.5">
                  {formatDateString(selectedDate)}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2 pr-1">
              <TouchableOpacity
                onPress={onPrevDate}
                className="bg-white/5 p-2.5 rounded-full border border-white/5 active:bg-white/10"
              >
                <ChevronLeft size={16} color="#ECEDEE" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onNextDate}
                className="bg-white/5 p-2.5 rounded-full border border-white/5 active:bg-white/10"
              >
                <ChevronRight size={16} color="#ECEDEE" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
