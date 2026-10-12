import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { SvgUri } from "react-native-svg";

interface RemoteLogoProps {
  uri?: string | null;
  label: string; // initials are shown when there's no image or it fails to load
  size?: number;
  round?: boolean;
  // Light disc behind the image, for competition logos that are dark-on-transparent
  plate?: boolean;
}

// Team / league / flag logo. Country flags from API-Football are SVGs, which <Image> can't draw.
function RemoteLogo({ uri, label, size = 32, round, plate }: RemoteLogoProps) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: round ? size / 2 : 6 };

  if (!uri || failed) {
    return (
      <View style={box} className="bg-white/10 items-center justify-center">
        <Text className="text-white font-black" style={{ fontSize: size * 0.32 }}>
          {label.substring(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }
  if (uri.toLowerCase().endsWith(".svg")) {
    return (
      <View style={box} className="overflow-hidden items-center justify-center">
        <SvgUri uri={uri} width={size} height={size * 0.75} onError={() => setFailed(true)} />
      </View>
    );
  }
  if (plate) {
    return (
      <View style={{ ...box, borderRadius: size / 2 }} className="bg-white items-center justify-center">
        <Image
          source={{ uri }}
          style={{ width: size * 0.72, height: size * 0.72 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }
  return <Image source={{ uri }} style={box} resizeMode="contain" onError={() => setFailed(true)} />;
}

export default React.memo(RemoteLogo);

