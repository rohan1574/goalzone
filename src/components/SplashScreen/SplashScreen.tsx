import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BannerAdComponent from "../ads/BannerAdComponent";

interface OnboardingStep {
  id: number;
  image: any;
  title?: string;
  isSplash?: boolean;
}

const ONBOARDING_DATA: OnboardingStep[] = [
  {
    id: 1,
    image: require("../../../assets/images/icon.png"),
    isSplash: true,
  },
  {
    id: 2,
    image: require("../../../assets/images/onboarding_1.jpg"),
    title: "Live scores, video highlights, and breaking news.",
    isSplash: false,
  },
  {
    id: 3,
    image: require("../../../assets/images/onboarding_2.jpg"),
    title: "Get live alerts for goals, cards, and kick-offs",
    isSplash: false,
  },
];

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const rotateValue = useRef(new Animated.Value(0)).current;

  // Dynamic responsive calculations
  const isSmallDevice = height < 700 || width < 360;
  const iconSize = Math.min(Math.max(width * 0.35, 110), 160);
  const titleFontSize = isSmallDevice ? 28 : Math.min(width * 0.09, 36);
  const imageHeight = isSmallDevice ? height * 0.42 : height * 0.48;

  useEffect(() => {
    if (currentStep === 0) {
      const startSpinning = () => {
        rotateValue.setValue(0);
        Animated.loop(
          Animated.timing(rotateValue, {
            toValue: 1,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ).start();
      };
      startSpinning();

      const timer = setTimeout(() => {
        setCurrentStep(1);
      }, 3000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [currentStep, rotateValue]);

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const spinRotation = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const stepData = ONBOARDING_DATA[currentStep];

  // ─── STEP 0: Splash Screen ───────────────────────────────────────────────
  if (currentStep === 0) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

        {/* Background Image with Blur */}
        <Image
          source={stepData.image}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          blurRadius={25}
        />

        {/* Dark Overlay */}
        <View
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
        />

        {/* Center Content */}
        <View className="flex-1 items-center justify-center px-4" style={{ paddingTop: insets.top }}>
          {/* App Icon */}
          <View
            className="rounded-3xl overflow-hidden mb-6"
            style={{
              width: iconSize,
              height: iconSize,
              shadowColor: "#02DB54",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 14,
            }}
          >
            <Image
              source={require("../../../assets/images/icon.png")}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>

          {/* LIVE SCORES title */}
          <View className="flex-row items-center flex-wrap justify-center">
            <Text
              className="font-black tracking-widest"
              style={{ color: "#02DB54", fontSize: titleFontSize }}
            >
              LIVE{" "}
            </Text>
            <Text
              className="font-black tracking-widest text-white"
              style={{ fontSize: titleFontSize }}
            >
              SCORES
            </Text>
          </View>

          <Text className="text-xs text-gray-400 mt-2 tracking-wider uppercase text-center">
            Football • Live • Free
          </Text>
        </View>

        {/* Footer */}
        <View className="items-center" style={{ paddingBottom: Math.max(insets.bottom, 4) }}>
          <Animated.View style={{ transform: [{ rotate: spinRotation }] }}>
            <Text style={{ fontSize: isSmallDevice ? 28 : 34 }}>⚽</Text>
          </Animated.View>

          <Text className="text-xs text-gray-400 mt-2 mb-3 tracking-wide text-center px-4">
            This action may contain advertising
          </Text>

          <View className="w-full items-center">
            <BannerAdComponent />
          </View>

          <View className="w-full bg-[#202124] py-3.5 items-center justify-center mt-1">
            <Text className="text-white text-xs sm:text-sm font-semibold">Loading...</Text>
          </View>
        </View>
      </View>
    );
  }

  // ─── STEP 1 & 2: Onboarding Screens ──────────────────────────────────────
  return (
    <View className="flex-1 bg-[#0D0E0F]">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Top Image Container */}
      <View style={{ height: imageHeight, width: "100%", overflow: "hidden", position: "relative" }}>
        <Image
          source={stepData.image}
          className="w-full h-full"
          resizeMode="cover"
        />

        {/* Top Dark Overlay for Status bar & Skip button readability */}
        <View
          className="absolute top-0 left-0 right-0 h-24"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        />

        {/* Floating Skip Button */}
        <TouchableOpacity
          style={{
            position: "absolute",
            top: Math.max(insets.top + 8, 18),
            right: 20,
            zIndex: 20,
            backgroundColor: "rgba(0,0,0,0.55)",
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
          }}
          onPress={handleSkip}
          activeOpacity={0.8}
        >
          <Text className="text-white text-xs font-bold">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className="items-center">
          {/* Onboarding Title */}
          <Text
            className="text-white font-bold text-center leading-7 px-2"
            style={{ fontSize: isSmallDevice ? 17 : 20 }}
          >
            {stepData.title}
          </Text>

          {/* AdMob Banner */}
          <View className="w-full items-center my-3">
            <BannerAdComponent />
          </View>
        </View>

        {/* Footer Action Bar */}
        <View
          className="flex-row items-center justify-between py-4 bg-[#0D0E0F]"
          style={{ paddingBottom: Math.max(insets.bottom + 8, 16) }}
        >
          {/* Pagination Dots */}
          <View className="flex-row items-center">
            {[1, 2, 3].map((stepNum) => {
              const isActive = currentStep === stepNum - 1;
              return (
                <View
                  key={stepNum}
                  style={{
                    height: 8,
                    width: isActive ? 24 : 8,
                    borderRadius: 4,
                    backgroundColor: isActive ? "#02DB54" : "#333537",
                    marginRight: 6,
                  }}
                />
              );
            })}
          </View>

          {/* Next / Get Started Button */}
          <TouchableOpacity
            className="rounded-full px-6 py-2.5"
            style={{
              backgroundColor: currentStep === 2 ? "#02DB54" : "transparent",
              borderWidth: 1,
              borderColor: "#02DB54",
            }}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Text
              className="text-sm font-bold"
              style={{ color: currentStep === 2 ? "#000000" : "#FFFFFF" }}
            >
              {currentStep === 2 ? "Get Started" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

