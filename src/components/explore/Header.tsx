import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Keyboard } from "react-native";
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

interface HeaderProps {
  selectedDate: Date;
  onPrevDate: () => void;
  onNextDate: () => void;
  onRefresh: () => void;
  showDateSelector: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

function Header({
  selectedDate,
  onPrevDate,
  onNextDate,
  onRefresh,
  showDateSelector,
  searchQuery,
  onSearchQueryChange,
}: HeaderProps) {
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
  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    if (isSearching) {
      const timer = setTimeout(() => {
        try {
          inputRef.current?.focus();
        } catch (e) { }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearching]);

  const handleOpenSearch = React.useCallback(() => {
    setIsSearching(true);
  }, []);

  const handleCloseSearch = React.useCallback(() => {
    try {
      Keyboard.dismiss();
    } catch (e) { }
    setIsSearching(false);
    onSearchQueryChange("");
  }, [onSearchQueryChange]);

  const today = new Date();
  const isToday =
    selectedDate.getDate() === today.getDate() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getFullYear() === today.getFullYear();

  return (
    <View>
      {/* Main Header Bar */}

      <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#ffffff05] bg-[#0D0E0F] h-[58px]">
        {/* Menu drawer button */}
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          className="p-1"
        >
          <Menu size={24} color="#ECEDEE" />
        </TouchableOpacity>

        {/* Brand title */}
        <Text className="text-xl font-black text-white tracking-widest uppercase">
          LIVE <Text className="text-[#02DB54]">SCORES</Text>
        </Text>

        {/* Refresh button */}
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={onRefresh}
            className="p-1 bg-white/5 rounded-full"
          >
            <RotateCw size={18} color="#ECEDEE" />
          </TouchableOpacity>
        </View>
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

export default React.memo(Header);
