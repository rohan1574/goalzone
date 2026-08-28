import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Languages,
  Star,
  Share2,
  Shield,
  ChevronRight,
} from "lucide-react-native";
import { router } from "expo-router";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0E0F" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0E0F" />

      {/* Subtle radial glow effect at the top */}
      <View className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-green-950/10 to-transparent pointer-events-none" />

      {/* Navigation Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/5 bg-[#0D0E0F]">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 active:opacity-70"
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text className="text-white font-extrabold text-lg tracking-wide">
          Settings
        </Text>
        
        {/* Empty Spacer to balance the layout and keep the title perfectly centered */}
        <View className="w-8" />
      </View>

      <ScrollView style={{ flex: 1 }} className="px-4 py-6">
        {/* GO PRO VERSION CARD */}
        <View className="bg-[#131415] border border-white/5 rounded-2xl p-5 flex-row items-center mb-6 shadow-2xl">
          {/* Trophy Sticker image */}
          <View className="w-20 h-20 items-center justify-center bg-black/40 rounded-xl overflow-hidden">
            <Image
              source={require("../../assets/images/settings_trophy.jpg")}
              className="w-full h-full"
              resizeMode="contain"
            />
          </View>

          {/* Upgrade Content Info */}
          <View className="flex-1 items-center ml-2">
            <Text className="text-white font-black text-base tracking-widest text-center">
              GO PRO VERSION
            </Text>
            <Text className="text-gray-400 text-[10px] font-black text-center mt-1 uppercase tracking-wide leading-4">
              UPGRADE FOR UNLIMITED{"\n"}ACCESS & NO ADS
            </Text>
            
            <TouchableOpacity 
              className="bg-[#7BEA54] px-8 py-2 rounded-full mt-3 active:opacity-90 shadow-md"
              activeOpacity={0.8}
            >
              <Text className="text-black font-extrabold text-xs">Upgrade</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SETTINGS OPTION LIST CARD WITH GREEN GLOW LEFT BORDER */}
        <View className="bg-[#131415] border border-white/5 border-l-[3px] border-l-[#02DB54] rounded-2xl overflow-hidden shadow-xl">
          
          {/* 1. Language Row */}
          <TouchableOpacity 
            className="flex-row items-center justify-between px-5 py-4 border-b border-white/5 active:bg-white/5"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Languages size={20} color="#FFFFFF" />
              <Text className="text-white font-bold text-sm ml-4">
                Language
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-400 font-bold text-xs mr-1">
                English
              </Text>
              <ChevronRight size={14} color="#9BA1A6" />
            </View>
          </TouchableOpacity>

          {/* 2. Rate Row */}
          <TouchableOpacity 
            className="flex-row items-center px-5 py-4 border-b border-white/5 active:bg-white/5"
            activeOpacity={0.7}
          >
            <Star size={20} color="#FFFFFF" />
            <Text className="text-white font-bold text-sm ml-4">
              Rate
            </Text>
          </TouchableOpacity>

          {/* 3. Share Row */}
          <TouchableOpacity 
            className="flex-row items-center px-5 py-4 border-b border-white/5 active:bg-white/5"
            activeOpacity={0.7}
          >
            <Share2 size={20} color="#FFFFFF" />
            <Text className="text-white font-bold text-sm ml-4">
              Share
            </Text>
          </TouchableOpacity>

          {/* 4. Privacy Policy Row */}
          <TouchableOpacity 
            className="flex-row items-center px-5 py-4 active:bg-white/5"
            activeOpacity={0.7}
            onPress={() => router.push("/PrivacyScreen")}
          >
            <Shield size={20} color="#FFFFFF" />
            <Text className="text-white font-bold text-sm ml-4">
              Privacy policy
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
