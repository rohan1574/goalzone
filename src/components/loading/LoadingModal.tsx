import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");

interface LoadingModalProps {
  visible: boolean;
}

export default function LoadingModal({ visible }: LoadingModalProps) {
  const bounceValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (visible) {
      // 1. Bouncing ball animation loop
      const startBouncing = () => {
        bounceValue.setValue(0);
        Animated.loop(
          Animated.sequence([
            // Ball goes up
            Animated.timing(bounceValue, {
              toValue: -50,
              duration: 450,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            // Ball falls down
            Animated.timing(bounceValue, {
              toValue: 0,
              duration: 350,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      // 2. Pulsing text animation loop
      const startPulsing = () => {
        pulseValue.setValue(0.4);
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseValue, {
              toValue: 1.0,
              duration: 800,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(pulseValue, {
              toValue: 0.4,
              duration: 800,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      startBouncing();
      startPulsing();
    } else {
      bounceValue.stopAnimation();
      pulseValue.stopAnimation();
    }
  }, [visible, bounceValue, pulseValue]);

  // Interpolate ball movement to shadow scaling and opacity
  const shadowScale = bounceValue.interpolate({
    inputRange: [-50, 0],
    outputRange: [0.3, 1.0],
  });

  const shadowOpacity = bounceValue.interpolate({
    inputRange: [-50, 0],
    outputRange: [0.1, 0.45],
  });

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        {/* Glassmorphic Container Card */}
        <View style={styles.cardContainer}>
          <View style={styles.animationArea}>
            {/* Bouncing Football */}
            <Animated.View
              style={[
                styles.ballContainer,
                { transform: [{ translateY: bounceValue }] },
              ]}
            >
              <Text style={styles.footballEmoji}>⚽</Text>
            </Animated.View>

            {/* Dynamic Shadow */}
            <Animated.View
              style={[
                styles.shadow,
                {
                  opacity: shadowOpacity,
                  transform: [{ scaleX: shadowScale }, { scaleY: 0.2 }],
                },
              ]}
            />
          </View>

          {/* Pulsing Loading Text */}
          <Animated.Text style={[styles.loadingText, { opacity: pulseValue }]}>
            Loading matches...
          </Animated.Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContainer: {
    width: width * 0.55,
    paddingVertical: 32,
    backgroundColor: "rgba(20, 21, 23, 0.9)",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  animationArea: {
    height: 90,
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  ballContainer: {
    marginBottom: 4,
  },
  footballEmoji: {
    fontSize: 42,
    lineHeight: 48,
  },
  shadow: {
    width: 32,
    height: 12,
    backgroundColor: "#000000",
    borderRadius: 6,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 8,
  },
});
