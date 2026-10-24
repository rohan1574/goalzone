import React, { useState } from "react";
import { Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";

interface RemoteLogoProps {
  uri?: string | null;
  label: string; // initials are shown when there's no image or it fails to load
  size?: number;
  round?: boolean;
  // Light disc behind the image, for competition logos that are dark-on-transparent
  plate?: boolean;
}

// Team / league / flag logo.
// Country flags from API-Football come as .svg URLs — we swap to .png to avoid
// SvgUri, which parses SVG on the main thread and causes ANR on Android
// (BlendModeHelper.needsIsolatedLayer + VirtualView.setClientRect).
function RemoteLogo({ uri, label, size = 32, round, plate }: RemoteLogoProps) {
  const [failed, setFailed] = useState(false);

  // Convert country flag SVG URLs to FlagCDN high-res PNGs
  // (api-sports.io only serves flags in SVG which causes ANR; FlagCDN serves fast, cached PNG flags)
  let safeUri = uri;
  if (uri) {
    const flagMatch = uri.match(/\/flags\/([a-zA-Z0-9_-]+)\.(?:svg|png)/i);
    if (flagMatch) {
      safeUri = `https://flagcdn.com/w80/${flagMatch[1].toLowerCase()}.png`;
    } else if (uri.toLowerCase().endsWith(".svg")) {
      safeUri = uri.replace(/\.svg$/i, ".png");
    }
  }

  const box = { width: size, height: size, borderRadius: round ? size / 2 : 6 };

  if (!safeUri || failed) {
    return (
      <View style={box} className="bg-white/10 items-center justify-center">
        <Text className="text-white font-black" style={{ fontSize: size * 0.32 }}>
          {label.substring(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }
  if (plate) {
    return (
      <View style={{ ...box, borderRadius: size / 2 }} className="bg-white items-center justify-center">
        <ExpoImage
          source={{ uri: safeUri }}
          style={{ width: size * 0.72, height: size * 0.72 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }
  return (
    <ExpoImage
      source={{ uri: safeUri }}
      style={box}
      contentFit="contain"
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  );
}

export default React.memo(RemoteLogo);

