import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Keyboard } from "react-native";
import { router } from "expo-router";
import { Menu, Search, RotateCw, CalendarDays, X } from "lucide-react-native";
import DateStrip from "./DateStrip";
import CalendarModal from "./CalendarModal";

interface HeaderProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onRefresh: () => void;
  showDateSelector: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

function Header({
  selectedDate,
  onSelectDate,
  onRefresh,
  showDateSelector,
  searchQuery,
  onSearchQueryChange,
}: HeaderProps) {
  const [calendarVisible, setCalendarVisible] = useState(false);

  const clearSearch = React.useCallback(() => {
    onSearchQueryChange("");
    try {
      Keyboard.dismiss();
    } catch (e) {}
  }, [onSearchQueryChange]);

  return (
    <View className="bg-[#0D0E0F] border-b border-[#ffffff05]">
      {/* Main Header Bar */}
      <View className="flex-row items-center justify-between px-4 py-3 h-[58px]">
        <TouchableOpacity onPress={() => router.push("/settings")} className="p-1" accessibilityLabel="Settings">
          <Menu size={24} color="#ECEDEE" />
        </TouchableOpacity>

        <Text className="text-xl font-black text-white tracking-widest uppercase">
          LIVE <Text className="text-[#02DB54]">SCORES</Text>
        </Text>

        <TouchableOpacity onPress={onRefresh} className="p-1.5 bg-white/5 rounded-full" accessibilityLabel="Refresh">
          <RotateCw size={18} color="#ECEDEE" />
        </TouchableOpacity>
      </View>

      {showDateSelector && (
        <>
          {/* Search + calendar */}
          <View className="flex-row items-center gap-2 px-4 pb-3">
            <View className="flex-1 flex-row items-center bg-[#131415] rounded-2xl px-3 border border-white/5 h-11">
              <Search size={16} color="#9BA1A6" />
              <TextInput
                placeholder="Search teams or leagues..."
                placeholderTextColor="#9BA1A6"
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                returnKeyType="search"
                autoCorrect={false}
                className="flex-1 text-white ml-2"
                // A fixed line height + Android's default padding clip the text inside the bar
                style={{ height: 44, fontSize: 13, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Clear search">
                  <X size={16} color="#9BA1A6" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setCalendarVisible(true)}
              className="w-11 h-11 rounded-2xl bg-[#131415] border border-white/5 items-center justify-center"
              accessibilityLabel="Pick a date"
            >
              <CalendarDays size={18} color="#02DB54" />
            </TouchableOpacity>
          </View>

          {/* Scrollable day picker */}
          <View className="pb-3">
            <DateStrip selectedDate={selectedDate} onSelectDate={onSelectDate} />
          </View>

          <CalendarModal
            visible={calendarVisible}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            onClose={() => setCalendarVisible(false)}
          />
        </>
      )}
    </View>
  );
}

export default React.memo(Header);
