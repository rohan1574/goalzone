import React from "react";
import { ScrollView, View, Text, Image } from "react-native";
import { Sparkles } from "lucide-react-native";

export default function PredictionView() {
  return (
    <ScrollView className="flex-1 px-4 mt-4 mb-20">
      <Text className="text-xl font-bold text-white mb-4">AI Predictions</Text>
      
      {/* Main prediction feature card */}
      <View className="bg-[#131415] border border-[#ffffff08] rounded-3xl p-5 mb-5">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Sparkles size={18} color="#02DB54" />
            <Text className="text-[#02DB54] font-bold text-xs uppercase tracking-wider">Today's Featured prediction</Text>
          </View>
          <View className="bg-white/10 px-2 py-0.5 rounded">
            <Text className="text-white text-[10px]">UCL Final</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center my-2">
          <View className="items-center w-1/3">
            <Image source={{ uri: "https://images.fotmob.com/image_resources/logo/teamlogo/8457.png" }} className="w-12 h-12" />
            <Text className="text-white font-bold text-sm mt-1 text-center">Man City</Text>
          </View>
          <View className="items-center w-1/3">
            <Text className="text-gray-400 text-xs font-bold">VS</Text>
            <Text className="text-[#02DB54] text-xl font-extrabold mt-1">AI Pick</Text>
          </View>
          <View className="items-center w-1/3">
            <Image source={{ uri: "https://images.fotmob.com/image_resources/logo/teamlogo/8633.png" }} className="w-12 h-12" />
            <Text className="text-white font-bold text-sm mt-1 text-center">Real Madrid</Text>
          </View>
        </View>

        {/* Progress probabilities bar */}
        <View className="mt-4">
          <View className="flex-row justify-between text-xs text-gray-400 mb-1">
            <Text className="text-[#02DB54] font-bold">Man City (48%)</Text>
            <Text className="text-gray-400">Draw (22%)</Text>
            <Text className="text-yellow-500 font-bold">R. Madrid (30%)</Text>
          </View>
          <View className="h-3 flex-row rounded-full overflow-hidden bg-white/10">
            <View style={{ width: "48%" }} className="bg-[#02DB54]" />
            <View style={{ width: "22%" }} className="bg-gray-600" />
            <View style={{ width: "30%" }} className="bg-yellow-500" />
          </View>
        </View>

        <Text className="text-gray-300 text-xs leading-normal mt-4">
          <Text className="font-bold text-white">AI Verdict: </Text>
          Manchester City holds a slight advantage due to their dominant home form and high goal-conversion rate, but Real Madrid's strong defensive counter-attacks make them highly dangerous.
        </Text>
      </View>
    </ScrollView>
  );
}
