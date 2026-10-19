import React, { useEffect, useMemo, useRef } from "react";
import { FlatList, Text, TouchableOpacity } from "react-native";

interface DateStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const DAYS_BEFORE = 7;
const DAYS_AFTER = 14;
const CHIP_WIDTH = 54;
const CHIP_GAP = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Whole-day difference that ignores DST shifts
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY);

// Three weeks of days around today; a date picked from the calendar outside that range re-centres the strip
function DateStrip({ selectedDate, onSelectDate }: DateStripProps) {
  const listRef = useRef<FlatList<Date>>(null);
  const today = startOfDay(new Date());
  const todayKey = today.getTime();

  const offsetFromToday = dayDiff(selectedDate, today);
  const inRange = offsetFromToday >= -DAYS_BEFORE && offsetFromToday <= DAYS_AFTER;
  const base = inRange ? today : startOfDay(selectedDate);
  const baseKey = base.getTime();

  const days = useMemo(
    () => Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, i) => addDays(new Date(baseKey), i - DAYS_BEFORE)),
    [baseKey],
  );
  const selectedIndex = dayDiff(selectedDate, base) + DAYS_BEFORE;

  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const id = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: selectedIndex, viewPosition: 0.5, animated: false });
      } catch (_) {}
    }, 50);
    return () => clearTimeout(id);
  }, [selectedIndex, baseKey]);

  return (
    <FlatList
      ref={listRef}
      data={days}
      horizontal
      showsHorizontalScrollIndicator={false}
      removeClippedSubviews={false}
      keyExtractor={(d) => String(d.getTime())}
      contentContainerStyle={{ paddingHorizontal: 16, gap: CHIP_GAP }}
      getItemLayout={(_, index) => ({
        length: CHIP_WIDTH + CHIP_GAP,
        offset: 16 + (CHIP_WIDTH + CHIP_GAP) * index,
        index,
      })}
      initialScrollIndex={Math.max(0, selectedIndex - 2)}
      onScrollToIndexFailed={(info) => {
        setTimeout(() => {
          try {
            listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: false });
          } catch (_) {}
        }, 80);
      }}
      renderItem={({ item, index }) => {
        const isSelected = index === selectedIndex;
        const isToday = item.getTime() === todayKey;
        return (
          <TouchableOpacity
            onPress={() => onSelectDate(item)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={item.toDateString()}
            style={{ width: CHIP_WIDTH }}
            className={`items-center py-2 rounded-2xl border ${
              isSelected ? "bg-[#02DB54] border-[#02DB54]" : "bg-[#131415] border-white/5"
            }`}
          >
            <Text
              className={`text-[10px] font-black uppercase ${
                isSelected ? "text-black" : isToday ? "text-[#02DB54]" : "text-gray-400"
              }`}
            >
              {isToday ? "Today" : item.toLocaleDateString([], { weekday: "short" })}
            </Text>
            <Text className={`text-lg font-black ${isSelected ? "text-black" : "text-white"}`}>
              {item.getDate()}
            </Text>
            <Text className={`text-[9px] font-bold uppercase ${isSelected ? "text-black/70" : "text-gray-500"}`}>
              {item.toLocaleDateString([], { month: "short" })}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

export default React.memo(DateStrip);
