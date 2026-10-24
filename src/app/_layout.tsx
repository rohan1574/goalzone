import "../global.css";
import React, { useEffect } from "react";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LogBox, Text, TouchableOpacity, View } from "react-native";
import mobileAds from "react-native-google-mobile-ads";

LogBox.ignoreLogs([
  "Invalid `href` prop for `Use` element",
]);

// A render error in any screen lands here instead of crashing the app (JavascriptException)
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("Screen render error:", error);
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0D0E0F", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <StatusBar style="light" />
      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 6 }}>
        Something went wrong
      </Text>
      <Text style={{ color: "#9BA1A6", fontSize: 13, textAlign: "center", marginBottom: 20 }}>
        The screen hit an unexpected error. Tap below to reload it.
      </Text>
      <TouchableOpacity
        onPress={retry}
        activeOpacity={0.8}
        style={{ backgroundColor: "#02DB54", paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999 }}
      >
        <Text style={{ color: "#000000", fontSize: 14, fontWeight: "800" }}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Defer AdMob SDK initialization so it doesn't block critical app startup or FCM broadcast receivers
    const timer = setTimeout(() => {
      mobileAds()
        .initialize()
        .then((adapterStatuses) => {
          console.log("AdMob SDK Initialized Successfully:", adapterStatuses);
        })
        .catch((err) => {
          console.error("AdMob SDK Initialization Error:", err);
        });
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
            animationDuration: 0,
            contentStyle: { backgroundColor: "#0D0E0F" },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="PrivacyScreen" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
