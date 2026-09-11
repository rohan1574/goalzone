import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
} from "react-native";
import BannerAdComponent from "../ads/BannerAdComponent";

const { width, height } = Dimensions.get("window");

interface OnboardingStep {
  id: number;
  image: any;
  title?: string;
  isSplash?: boolean;
}

const ONBOARDING_DATA: OnboardingStep[] = [
  {
    id: 1,
    image: require("../../../assets/images/neymar.png"),
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
  const [currentStep, setCurrentStep] = useState(0);
  const rotateValue = useRef(new Animated.Value(0)).current;

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
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Background Image */}
        <Image
          source={stepData.image}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Dark Overlay */}
        <View
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        />

        {/* Center Content */}
        <View className="flex-1 items-center justify-center">
          {/* App Icon */}
          <View
            className="rounded-3xl overflow-hidden mb-6"
            style={{
              width: width * 0.38,
              height: width * 0.38,
              shadowColor: "#02DB54",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <Image
              source={require("../../../assets/images/neymar.png")}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>

          {/* LIVE SCORES title */}
          <View className="flex-row items-center">
            <Text
              className="text-4xl font-black tracking-widest"
              style={{ color: "#02DB54" }}
            >
              LIVE{" "}
            </Text>
            <Text className="text-4xl font-black tracking-widest text-white">
              SCORES
            </Text>
          </View>

          <Text className="text-sm text-gray-400 mt-2 tracking-wider uppercase">
            Football • Live • Free
          </Text>
        </View>

        {/* Footer */}
        <View className="items-center pb-0">
          <Animated.View style={{ transform: [{ rotate: spinRotation }] }}>
            <Text style={{ fontSize: 36 }}>⚽</Text>
          </Animated.View>

          <Text className="text-xs text-gray-500 mt-3 mb-4 tracking-wide">
            This action may contain advertising
          </Text>

          <BannerAdComponent />

          <View className="w-full bg-[#202124] py-4 items-center justify-center">
            <Text className="text-white text-sm font-semibold">Loading...</Text>
          </View>
        </View>
      </View>
    );
  }

  // ─── STEP 1 & 2: Onboarding Screens ──────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-[#0D0E0F]">
      <StatusBar barStyle="light-content" backgroundColor="#0D0E0F" />

      {/* Top Image */}
      <View style={{ height: height * 0.5, width: "100%", overflow: "hidden" }}>
        <Image
          source={stepData.image}
          className="w-full h-full"
          resizeMode="cover"
        />

      </View>

      {/* Content */}
      <View className="flex-1 px-6 pt-6 relative">
        {/* Skip */}
        <TouchableOpacity
          className="absolute top-0 right-6 z-10 py-2 px-3"
          onPress={handleSkip}
        >
          <Text className="text-gray-400 text-sm font-semibold">Skip</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text className="text-white text-xl font-bold text-center leading-8 mt-3 px-3 mb-5">
          {stepData.title}
        </Text>

        {/* AdMob Banner */}
        <View className="w-full items-center my-2">
          <BannerAdComponent />
        </View>
      </View>

      {/* Footer Action Bar */}
      <View className="flex-row items-center justify-between px-6 pb-6 bg-[#0D0E0F]">
        {/* Pagination Dots */}
        <View className="flex-row items-center gap-1.5">
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
                  marginRight: 4,
                }}
              />
            );
          })}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          className="border border-[#02DB54] rounded-full px-6 py-2"
          onPress={handleNext}
          activeOpacity={0.7}
        >
          <Text className="text-white text-sm font-bold">
            {currentStep === 2 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
