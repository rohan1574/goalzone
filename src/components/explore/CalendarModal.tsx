import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { startOfDay } from "./DateStrip";

interface CalendarModalProps {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Month grid (Monday first) padded with nulls before the 1st and after the last day
const buildMonth = (year: number, month: number): (Date | null)[] => {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export default function CalendarModal({ visible, selectedDate, onSelectDate, onClose }: CalendarModalProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  // Open on the month of the currently selected date
  useEffect(() => {
    if (visible) setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [visible]);

  const todayKey = startOfDay(new Date()).getTime();
  const selectedKey = startOfDay(selectedDate).getTime();
  const cells = buildMonth(viewMonth.getFullYear(), viewMonth.getMonth());
  const shiftMonth = (delta: number) =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const pick = (date: Date) => {
    onSelectDate(date);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/70 items-center justify-center px-5" onPress={onClose}>
        {/* Inner Pressable swallows taps so they don't close the modal */}
        <Pressable className="w-full bg-[#131415] rounded-3xl border border-white/10 p-4" onPress={() => {}}>
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              className="bg-white/5 p-2.5 rounded-full border border-white/5"
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={16} color="#ECEDEE" />
            </TouchableOpacity>
            <Text className="text-white font-black text-base">
              {viewMonth.toLocaleDateString([], { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              className="bg-white/5 p-2.5 rounded-full border border-white/5"
              accessibilityLabel="Next month"
            >
              <ChevronRight size={16} color="#ECEDEE" />
            </TouchableOpacity>
          </View>

          <View className="flex-row mb-1">
            {WEEKDAYS.map((d) => (
              <Text key={d} className="flex-1 text-center text-gray-500 text-[10px] font-black uppercase">
                {d}
              </Text>
            ))}
          </View>

          {/* One row per week with flex:1 cells: percentage widths round past 100% and wrap early */}
          {Array.from({ length: cells.length / 7 }, (_, week) => (
            <View key={week} className="flex-row">
              {cells.slice(week * 7, week * 7 + 7).map((date, i) => {
                if (!date) return <View key={`empty-${week}-${i}`} className="flex-1 h-11" />;
                const key = date.getTime();
                const isSelected = key === selectedKey;
                const isToday = key === todayKey;
                return (
                  <View key={key} className="flex-1 h-11 items-center justify-center">
                    <TouchableOpacity
                      onPress={() => pick(date)}
                      accessibilityLabel={date.toDateString()}
                      accessibilityState={{ selected: isSelected }}
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        isSelected ? "bg-[#02DB54]" : isToday ? "border border-[#02DB54]" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          isSelected ? "text-black font-black" : isToday ? "text-[#02DB54]" : "text-white"
                        }`}
                      >
                        {date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}

          <View className="flex-row gap-2 mt-4">
            <TouchableOpacity
              onPress={() => pick(new Date())}
              className="flex-1 py-3 rounded-2xl bg-[#02DB54]/10 border border-[#02DB54]/40 items-center"
            >
              <Text className="text-[#02DB54] font-black text-xs" numberOfLines={1}>
                Jump to today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="py-3 px-4 rounded-2xl bg-white/5 border border-white/5 items-center"
              accessibilityLabel="Close calendar"
            >
              <X size={16} color="#ECEDEE" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
