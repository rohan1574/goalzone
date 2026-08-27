import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import {
  Compass,
  Trophy,
  PlaySquare,
  Shield,
  Sparkles,
} from "lucide-react-native";

export type TabType = "explore" | "leagues" | "highlight" | "teams" | "prediction";

interface BottomNavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function BottomNavBar({
  activeTab,
  setActiveTab,
}: BottomNavigationProps) {
  const tabs = [
    { id: "explore" as TabType, label: "Explore", Icon: Compass },
    { id: "leagues" as TabType, label: "Leagues", Icon: Trophy },
    { id: "highlight" as TabType, label: "Highlight", Icon: PlaySquare },
    { id: "teams" as TabType, label: "Teams", Icon: Shield },
    { id: "prediction" as TabType, label: "Prediction", Icon: Sparkles },
  ];

  return (
    <View style={styles.container}>
      {tabs.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveTab(id)}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                isActive && styles.activeIconContainer,
              ]}
            >
              <Icon size={22} color={isActive ? "#02DB54" : "#9BA1A6"} />
            </View>
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0D0E0F",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: "100%",
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    width: 64,
  },
  iconContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconContainer: {
    backgroundColor: "rgba(2, 219, 84, 0.1)",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  activeTabLabel: {
    color: "#FFFFFF",
  },
  inactiveTabLabel: {
    color: "#9BA1A6",
  },
});
