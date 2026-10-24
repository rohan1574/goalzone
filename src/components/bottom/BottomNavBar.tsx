import {
  Compass,
  PlaySquare,
  Shield,
  Sparkles,
  Trophy,
} from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type TabType =
  | "explore"
  | "leagues"
  | "highlight"
  | "teams"
  | "prediction";

interface BottomNavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

function BottomNavBar({ activeTab, setActiveTab }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();

  const tabs = [
    { id: "explore" as TabType, label: "Explore", Icon: Compass },
    { id: "leagues" as TabType, label: "Leagues", Icon: Trophy },
    { id: "highlight" as TabType, label: "Highlight", Icon: PlaySquare },
    { id: "teams" as TabType, label: "Teams", Icon: Shield },
    { id: "prediction" as TabType, label: "Prediction", Icon: Sparkles },
  ];

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveTab(id)}
            style={[styles.tabButton, isActive && styles.activeTabButton]}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            <Icon size={22} color={isActive ? "#02DB54" : "#9BA1A6"} />
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default React.memo(BottomNavBar);

const TAB_HEIGHT = 56;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0D0E0F",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    // Fixed height with a radius of exactly half: Android renders an oversized radius
    // (e.g. 999) inconsistently and the capsule sometimes comes out barely rounded
    height: TAB_HEIGHT,
    borderRadius: TAB_HEIGHT / 3,
    // Equal share of the bar so the capsule fits the longest label on narrow phones too
    flex: 1,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: "transparent",
  },
  activeTabButton: {
    backgroundColor: "rgba(2, 219, 84, 0.14)",
    borderColor: "rgba(2, 219, 84, 0.35)",
  },
  tabLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  activeTabLabel: {
    color: "#02DB54",
  },
  inactiveTabLabel: {
    color: "#9BA1A6",
  },
});
