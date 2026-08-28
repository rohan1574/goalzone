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

const { width, height } = Dimensions.get("window");

interface OnboardingStep {
  id: number;
  image: any;
  title?: string;
  isSplash?: boolean;
}

// Configurable onboarding and splash steps
const ONBOARDING_DATA: OnboardingStep[] = [
  {
    id: 1,
    image: require("../../../assets/images/splash_bg.jpg"),
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
  const [currentStep, setCurrentStep] = useState(0); // 0 = Splash, 1 = Onboarding 1, 2 = Onboarding 2
  const rotateValue = useRef(new Animated.Value(0)).current;

  // Spinning soccer ball animation for Splash Screen (Step 0)
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

      // Automatically transition to step 1 after 3 seconds
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

  // Interpolation for spinning soccer ball rotation
  const spinRotation = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const stepData = ONBOARDING_DATA[currentStep];

  // STEP 0: Splash Screen
  if (currentStep === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        
        {/* Background Image */}
        <Image
          source={stepData.image}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Dark overlay with circular radial gradient feel */}
        <View style={styles.darkOverlay} />

        <View style={styles.splashContent}>
          {/* App Icon in center */}
          <View style={styles.appIconContainer}>
            <Image
              source={require("../../../assets/images/icon.png")}
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>

          {/* Title Text */}
          <View style={styles.titleRow}>
            <Text style={styles.greenText}>LIVE </Text>
            <Text style={styles.whiteText}>SCORES</Text>
          </View>
        </View>

        {/* Footer Area for Loading */}
        <View style={styles.splashFooter}>
          {/* Animated Spinning Soccer Ball */}
          <Animated.View style={{ transform: [{ rotate: spinRotation }] }}>
            <Text style={styles.spinningBall}>⚽</Text>
          </Animated.View>

          <Text style={styles.adsDisclaimer}>This action may contain advertising</Text>

          <View style={styles.loadingBarContainer}>
            <Text style={styles.loadingBarText}>Loading...</Text>
          </View>
        </View>
      </View>
    );
  }

  // STEP 1 & 2: Interactive Onboarding Screens
  return (
    <SafeAreaView style={styles.onboardingContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0E0F" />
      
      {/* Top Half Illustration */}
      <View style={styles.imageWrapper}>
        <Image source={stepData.image} style={styles.onboardingImage} resizeMode="cover" />
      </View>

      {/* Content Area */}
      <View style={styles.onboardingContent}>
        {/* Skip button at top right of content */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Main Title Text */}
        <Text style={styles.onboardingTitle}>{stepData.title}</Text>

        {/* Mock Advertisement Card (Match screenshots style exactly) */}
        {currentStep === 1 ? (
          /* Netcup Ad style */
          <View style={styles.adCardNetcup}>
            <View style={styles.adHeaderRow}>
              <View style={styles.adBadgeContainer}>
                <Text style={styles.adBadgeText}>Ad</Text>
              </View>
              <Text style={styles.adBrandName}>netcup</Text>
            </View>
            <View style={styles.adMainRow}>
              <View style={styles.adTextInfo}>
                <Text style={styles.adTitleNetcup}>Award-winning</Text>
                <Text style={styles.adSubNetcup}>multiple times</Text>
                <View style={styles.netcupBadgesRow}>
                  <Text style={styles.netcupBadgeIcon}>🏅</Text>
                  <Text style={styles.netcupBadgeIcon}>🏅</Text>
                  <Text style={styles.netcupBadgeIcon}>🏅</Text>
                </View>
                <Text style={styles.adDescriptionText}>Your idea deserves the best spot on the web.</Text>
              </View>
              <TouchableOpacity style={styles.adInstallBtnGreen} activeOpacity={0.8}>
                <Text style={styles.adInstallBtnText}>INSTALL</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Google Play Style Ad */
          <View style={styles.adCardPlay}>
            <View style={styles.adHeaderRow}>
              <View style={styles.adBadgeContainer}>
                <Text style={styles.adBadgeText}>Ad</Text>
              </View>
              <Text style={styles.adBrandNamePlay}>Google Play ad</Text>
            </View>
            <View style={styles.adMainRow}>
              <View style={styles.adPlayIconContainer}>
                <View style={styles.blueFolderIcon}>
                  <Text style={styles.folderEmoji}>📁</Text>
                  <View style={styles.downloadIndicatorBadge}>
                    <Text style={styles.arrowDownEmoji}>⬇️</Text>
                  </View>
                </View>
              </View>
              <View style={styles.adPlayTextInfo}>
                <Text style={styles.adPlayTitle}>আপনার কনটেন্ট পেতে</Text>
                <Text style={styles.adPlaySubTitle}>চালিয়ে যান</Text>
              </View>
              <TouchableOpacity style={styles.adInstallBtnGreen} activeOpacity={0.8}>
                <Text style={styles.adInstallBtnText}>INSTALL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Onboarding Bottom Action Bar */}
      <View style={styles.footerActionBar}>
        {/* Pagination Dots (green pill and small circles) */}
        <View style={styles.dotsContainer}>
          {[1, 2, 3].map((stepNum) => {
            const isActive = currentStep === stepNum - 1;
            return (
              <View
                key={stepNum}
                style={[
                  styles.dot,
                  isActive ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            );
          })}
        </View>

        {/* Next Button with green border */}
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.7}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  darkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  splashContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: height * 0.1,
  },
  appIconContainer: {
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: 24,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#02DB54",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 24,
  },
  appIcon: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  greenText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#02DB54",
    letterSpacing: 1,
  },
  whiteText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  splashFooter: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 0,
  },
  spinningBall: {
    fontSize: 36,
    marginBottom: 24,
  },
  adsDisclaimer: {
    color: "#9BA1A6",
    fontSize: 12,
    marginBottom: 20,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  loadingBarContainer: {
    width: "100%",
    backgroundColor: "#202124",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  // Onboarding styles
  onboardingContainer: {
    flex: 1,
    backgroundColor: "#0D0E0F",
  },
  imageWrapper: {
    height: height * 0.5,
    width: "100%",
    overflow: "hidden",
  },
  onboardingImage: {
    width: "100%",
    height: "100%",
  },
  onboardingContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    position: "relative",
  },
  skipButton: {
    position: "absolute",
    top: 0,
    right: 24,
    padding: 8,
    zIndex: 10,
  },
  skipText: {
    color: "#9BA1A6",
    fontSize: 14,
    fontWeight: "600",
  },
  onboardingTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 28,
    marginTop: 10,
    paddingHorizontal: 12,
  },
  
  // Netcup Ad styling
  adCardNetcup: {
    backgroundColor: "#003A40",
    borderRadius: 8,
    padding: 12,
    width: "100%",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
  },
  adHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  adBadgeContainer: {
    backgroundColor: "#02DB54",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
  },
  adBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "bold",
  },
  adBrandName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  adBrandNamePlay: {
    color: "#A0A0A0",
    fontSize: 12,
    fontWeight: "600",
  },
  adMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adTextInfo: {
    flex: 1,
    marginRight: 12,
  },
  adTitleNetcup: {
    color: "#02DB54",
    fontSize: 15,
    fontWeight: "bold",
  },
  adSubNetcup: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  netcupBadgesRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  netcupBadgeIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  adDescriptionText: {
    color: "#A9AEB1",
    fontSize: 10,
    marginTop: 4,
  },
  adInstallBtnGreen: {
    backgroundColor: "#7BEA54",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 100,
  },
  adInstallBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  // Play Store Ad styling
  adCardPlay: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 12,
    width: "100%",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
  },
  adPlayIconContainer: {
    width: 48,
    height: 48,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  blueFolderIcon: {
    width: 40,
    height: 40,
    backgroundColor: "#1e88e5",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  folderEmoji: {
    fontSize: 20,
  },
  downloadIndicatorBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#02DB54",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowDownEmoji: {
    fontSize: 9,
  },
  adPlayTextInfo: {
    flex: 1,
    justifyContent: "center",
    marginRight: 10,
  },
  adPlayTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  adPlaySubTitle: {
    color: "#A0A0A0",
    fontSize: 12,
  },

  // Onboarding Footer Action Bar style
  footerActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: "#0D0E0F",
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333537",
    marginRight: 6,
  },
  activeDot: {
    width: 24,
    backgroundColor: "#02DB54",
  },
  inactiveDot: {
    width: 8,
    backgroundColor: "#333537",
  },
  nextButton: {
    borderColor: "#02DB54",
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 22,
    backgroundColor: "transparent",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
});
