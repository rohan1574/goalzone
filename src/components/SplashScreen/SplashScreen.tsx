import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image as ExpoImage } from "expo-image";
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

// Set once the user finishes or skips onboarding, so it only shows on first launch
const ONBOARDING_SEEN_KEY = "hasSeenOnboarding";
const SPLASH_DURATION = 2500;

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const hasSeenOnboarding = useRef<Promise<boolean> | null>(null);

  // Splash animations
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(0.6)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textOffset = useRef(new Animated.Value(16)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(0)).current;

  // Dynamic responsive calculations
  const isSmallDevice = height < 700 || width < 360;
  const iconSize = Math.min(Math.max(width * 0.35, 110), 160);
  const titleFontSize = isSmallDevice ? 28 : Math.min(width * 0.09, 36);
  const progressWidth = Math.min(width * 0.5, 220);

  useEffect(() => {
    if (currentStep !== 0) return;
    let cancelled = false;
    hasSeenOnboarding.current ??= AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
      .then((value) => value === "true")
      .catch(() => false);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textOffset, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    Animated.timing(progress, {
      toValue: 1,
      duration: SPLASH_DURATION,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(async () => {
      const seen = await hasSeenOnboarding.current;
      if (cancelled) return;
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (cancelled) return;
        if (seen) {
          onComplete();
        } else {
          setCurrentStep(1);
        }
      });
    }, SPLASH_DURATION);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      pulse.stop();
      progress.stopAnimation();
      glowPulse.stopAnimation();
      iconScale.stopAnimation();
      iconOpacity.stopAnimation();
      textOpacity.stopAnimation();
      textOffset.stopAnimation();
      splashOpacity.stopAnimation();
    };
  }, [currentStep]);

  // Fade each onboarding page in
  useEffect(() => {
    if (currentStep === 0) return;
    stepOpacity.setValue(0);
    const anim = Animated.timing(stepOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
      stepOpacity.stopAnimation();
    };
  }, [currentStep]);

  const finishOnboarding = () => {
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "true").catch(() => {});
    onComplete();
  };

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      finishOnboarding();
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });
  const progressTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-progressWidth, 0],
  });

  const stepData = ONBOARDING_DATA[currentStep];

  // ─── STEP 0: Splash Screen ───────────────────────────────────────────────
  if (currentStep === 0) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar style="light" />
        <Animated.View style={{ flex: 1, opacity: splashOpacity }}>
          {/* Dark sleek background with subtle overlay */}
          <View
            className="absolute inset-0"
            style={{ backgroundColor: "#060708" }}
          />

          {/* Center Content */}
          <View className="flex-1 items-center justify-center px-4" style={{ paddingTop: insets.top }}>
            <View
              className="items-center justify-center mb-8"
              style={{ width: iconSize * 1.6, height: iconSize * 1.6 }}
            >
              {/* Pulsing glow behind the icon (hardware accelerated without isolated layer) */}
              <Animated.View
                style={{
                  position: "absolute",
                  width: iconSize * 1.35,
                  height: iconSize * 1.35,
                  borderRadius: iconSize,
                  backgroundColor: "rgba(2,219,84,0.12)",
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                }}
              />
              <Animated.View
                style={{
                  position: "absolute",
                  width: iconSize * 1.25,
                  height: iconSize * 1.25,
                  borderRadius: iconSize,
                  borderWidth: 1.5,
                  borderColor: "rgba(2,219,84,0.45)",
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                }}
              />

              {/* App Icon */}
              <Animated.View
                className="rounded-3xl overflow-hidden"
                style={{
                  width: iconSize,
                  height: iconSize,
                  opacity: iconOpacity,
                  transform: [{ scale: iconScale }],
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                <ExpoImage
                  source={require("../../../assets/images/icon.png")}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </Animated.View>
            </View>

            {/* LIVE SCORES title */}
            <Animated.View
              className="items-center"
              style={{ opacity: textOpacity, transform: [{ translateY: textOffset }] }}
            >
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

              <View className="flex-row items-center mt-3">
                <View style={{ width: 24, height: 1, backgroundColor: "rgba(2,219,84,0.6)" }} />
                <Text className="text-xs text-gray-300 mx-3 tracking-[3px] uppercase text-center">
                  Football • Live • Free
                </Text>
                <View style={{ width: 24, height: 1, backgroundColor: "rgba(2,219,84,0.6)" }} />
              </View>
            </Animated.View>
          </View>

          {/* Footer */}
          <View className="items-center" style={{ paddingBottom: Math.max(insets.bottom, 4) }}>
            {/* Progress bar */}
            <View
              className="overflow-hidden rounded-full mb-4"
              style={{ width: progressWidth, height: 4, backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <Animated.View
                className="rounded-full"
                style={{
                  width: progressWidth,
                  height: 4,
                  backgroundColor: "#02DB54",
                  transform: [{ translateX: progressTranslate }],
                }}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ─── STEP 1 & 2: Onboarding Screens ──────────────────────────────────────
  return (
    <Animated.View className="flex-1 bg-[#0D0E0F]" style={{ opacity: stepOpacity }}>
      <StatusBar style="light" />

      {/* Full-screen Image */}
      <ExpoImage
        source={stepData.image}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
        contentFit="cover"
      />

      {/* Top Dark Overlay for Status bar & Skip button readability */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 96,
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      />

      {/* Bottom dark overlay so text is readable */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "45%",
          backgroundColor: "rgba(13,14,15,0.72)",
        }}
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

      {/* Bottom Content Overlay */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom + 8, 16),
          paddingTop: 16,
        }}
      >
        {/* Onboarding Title */}
        <Text
          className="text-white font-bold text-center leading-7 px-2"
          style={{ fontSize: isSmallDevice ? 17 : 20, marginBottom: 8 }}
        >
          {stepData.title}
        </Text>

        {/* AdMob Banner */}
        <View className="w-full items-center my-3">
          <BannerAdComponent />
        </View>

        {/* Footer Action Bar */}
        <View className="flex-row items-center justify-between py-4">
          {/* Pagination Dots */}
          <View className="flex-row items-center">
            {[1, 2].map((stepNum) => {
              const isActive = currentStep === stepNum;
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
      </View>
    </Animated.View>
  );
}
