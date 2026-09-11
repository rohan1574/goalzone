import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

// Replace with your real Ad Unit IDs from Google AdMob console when publishing
const adUnitId = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      android: "ca-app-pub-3940256099942544/6300978111", // Real Android Banner Ad Unit ID goes here
      ios: "ca-app-pub-3940256099942544/2934735716",     // Real iOS Banner Ad Unit ID goes here
      default: TestIds.BANNER,
    });

interface BannerAdComponentProps {
  size?: BannerAdSize;
}

export default function BannerAdComponent({ size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }: BannerAdComponentProps) {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.log("Banner Ad failed to load: ", error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "#0D0E0F",
    paddingVertical: 4,
  },
});
