import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";

const FINISHED_SET = new Set([
  "FT", "AET", "PEN", "FINISHED", "ENDED", "FULL TIME", "CANC", "ABD", "AWD", "WO", "PST"
]);

const NOT_STARTED_SET = new Set([
  "NS", "TBD", "TIMED", "SCHEDULED", "UPCOMING", "POSTPONED"
]);

export const useLiveClock = (initialMinute?: string | number, status?: string) => {
  const minStr = String(initialMinute || "").trim();
  const stUpper = String(status || "").trim().toUpperCase();
  const minUpper = minStr.toUpperCase();

  // 1. Finished match check
  const isFinished =
    FINISHED_SET.has(stUpper) ||
    FINISHED_SET.has(minUpper) ||
    stUpper.includes("FINISH") ||
    stUpper.includes("ENDED") ||
    stUpper.includes("FULL TIME") ||
    minUpper.includes("FINISH") ||
    minUpper.includes("ENDED") ||
    minUpper === "90'" ||
    minUpper === "90" ||
    minUpper === "90M" ||
    minUpper === "90 MIN" ||
    minUpper === "90MIN" ||
    (stUpper === "2H" && minUpper.startsWith("90"));

  const isHalfTime = stUpper === "HT" || minUpper === "HT";
  const isNotStarted = NOT_STARTED_SET.has(stUpper) || NOT_STARTED_SET.has(minUpper);

  // Check for non-ticking statuses
  const isSpecial =
    isFinished ||
    isHalfTime ||
    isNotStarted ||
    ["HT", "FT", "AET", "PEN", "PST", "CANC", "NS", "TBD", "SUSP", "INT"].includes(minUpper) ||
    Boolean(
      stUpper &&
        ["HT", "FT", "AET", "PEN", "PST", "CANC", "NS", "TBD", "SUSP", "INT"].includes(stUpper)
    );

  const parseMinute = (val: string) => {
    const clean = val.replace("'", "").trim();
    if (clean.includes("+")) {
      const parts = clean.split("+");
      const base = parseInt(parts[0], 10);
      const extra = parseInt(parts[1], 10);
      return !isNaN(base) ? { base, extra: !isNaN(extra) ? extra : 0 } : null;
    }
    const num = parseInt(clean, 10);
    return isNaN(num) ? null : { base: num, extra: 0 };
  };

  const parsed = parseMinute(minStr);

  // Hooks MUST be called unconditionally at the top level
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() / 1000) % 60));
  const [extraSeconds, setExtraSeconds] = useState(0);

  useEffect(() => {
    if (isSpecial || !parsed) return;

    setExtraSeconds(0);
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev >= 59) {
          setExtraSeconds((e) => e + 1);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [minStr, isSpecial]);

  if (isFinished) {
    if (stUpper === "AET" || minUpper === "AET") return "AET";
    if (stUpper === "PEN" || minUpper === "PEN") return "PEN";
    return "FT";
  }

  if (isHalfTime) {
    return "HT";
  }

  if (isNotStarted) {
    return status || minStr || "NS";
  }

  if (isSpecial || !parsed) {
    return status || minStr || "Live";
  }

  const currentMinute = parsed.base + extraSeconds;
  const secDisplay = seconds < 10 ? `0${seconds}` : `${seconds}`;

  if (parsed.extra > 0) {
    return `${parsed.base}+${parsed.extra}:${secDisplay}`;
  }

  return `${currentMinute}:${secDisplay}`;
};

interface LiveMatchClockProps {
  minute?: string | number;
  status?: string;
  textClass?: string;
  showDot?: boolean;
}

export default function LiveMatchClock({
  minute,
  status,
  textClass = "text-[#02DB54] text-[10px] font-bold",
  showDot = true,
}: LiveMatchClockProps) {
  const formatted = useLiveClock(minute, status);
  const isTicking = formatted.includes(":");

  return (
    <View className="flex-row items-center gap-1 justify-center">
      {showDot && isTicking && (
        <View className="w-1.5 h-1.5 rounded-full bg-[#02DB54]" />
      )}
      <Text className={textClass}>{formatted}</Text>
    </View>
  );
}
