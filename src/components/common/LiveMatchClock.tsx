import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";

const FINISHED_SET = new Set([
  "FT", "AET", "PEN", "FINISHED", "ENDED", "FULL TIME", "CANC", "ABD", "AWD", "WO", "PST"
]);

const NOT_STARTED_SET = new Set([
  "NS", "TBD", "TIMED", "SCHEDULED", "UPCOMING", "POSTPONED"
]);

export const useLiveClock = (
  initialMinute?: string | number,
  status?: string,
  extraProp?: string | number,
  timestamp?: number
) => {
  const minStr = String(initialMinute || "").trim();
  const stUpper = String(status || "").trim().toUpperCase();
  const minUpper = minStr.toUpperCase();

  const isNotStarted = NOT_STARTED_SET.has(stUpper) || NOT_STARTED_SET.has(minUpper);

  // 0. Kickoff duration check: if 115+ minutes have passed since match kickoff, match is FT
  if (timestamp && !isNotStarted) {
    const minsSinceKO = (Date.now() - timestamp * 1000) / 60000;
    if (minsSinceKO >= 115) {
      return "FT";
    }
    if (minsSinceKO >= 55 && minsSinceKO < 75 && (stUpper === "1H" || minUpper.startsWith("45"))) {
      return "HT";
    }
  }

  // 1. Finished match check (ONLY true full-time / finished statuses)
  const isFinished =
    FINISHED_SET.has(stUpper) ||
    FINISHED_SET.has(minUpper) ||
    stUpper.includes("FINISH") ||
    stUpper.includes("ENDED") ||
    stUpper.includes("FULL TIME") ||
    minUpper.includes("FINISH") ||
    minUpper.includes("ENDED") ||
    minUpper.includes("FULL TIME");

  const isHalfTime = stUpper === "HT" || minUpper === "HT";

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

  const parseMinute = (val: string, extraVal?: string | number) => {
    // Extract bracketed total extra, e.g. (+5) or [5] or (5) or (+3)
    const bracketMatch = val.match(/[\(\[]\+?(\d+)[\)\]]/);
    const bracketExtra = bracketMatch ? parseInt(bracketMatch[1], 10) : null;

    let propExtra: number | null = null;
    if (extraVal !== undefined && extraVal !== null) {
      const p = parseInt(String(extraVal).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(p) && p > 0) propExtra = p;
    }

    const totalExtra = bracketExtra ?? propExtra;

    // Clean out brackets and apostrophes
    const clean = val
      .replace(/[\(\[][^\)\]]*[\)\]]/g, "")
      .replace("'", "")
      .trim();

    if (clean.includes("+")) {
      const parts = clean.split("+");
      const base = parseInt(parts[0], 10);
      const elapsedExtra = parseInt(parts[1], 10);
      if (!isNaN(base)) {
        const effectiveTotalExtra =
          totalExtra ?? (!isNaN(elapsedExtra) && elapsedExtra > 0 ? elapsedExtra : null);
        return {
          base,
          elapsedExtra: !isNaN(elapsedExtra) ? elapsedExtra : 0,
          totalExtra: effectiveTotalExtra,
        };
      }
    }

    const num = parseInt(clean, 10);
    if (!isNaN(num)) {
      // If 2H stoppage time: elapsed minute >= 90
      if (stUpper === "2H" && num >= 90) {
        const cur = num > 90 ? num - 90 : 0;
        return {
          base: 90,
          elapsedExtra: cur,
          totalExtra: totalExtra ?? (cur > 0 ? cur : null),
        };
      }
      // If 1H stoppage time: elapsed minute >= 45
      if (stUpper === "1H" && num >= 45) {
        const cur = num > 45 ? num - 45 : 0;
        return {
          base: 45,
          elapsedExtra: cur,
          totalExtra: totalExtra ?? (cur > 0 ? cur : null),
        };
      }
      // If extra time is explicitly announced and minute is 90+
      if (num >= 90 && totalExtra) {
        return {
          base: 90,
          elapsedExtra: num > 90 ? num - 90 : 0,
          totalExtra,
        };
      }
      // If extra time is explicitly announced and minute is 45-59
      if (num >= 45 && num < 60 && totalExtra) {
        return {
          base: 45,
          elapsedExtra: num > 45 ? num - 45 : 0,
          totalExtra,
        };
      }
      return {
        base: num,
        elapsedExtra: 0,
        totalExtra,
      };
    }

    return null;
  };

  const parsed = parseMinute(minStr, extraProp);

  // Hooks MUST be called unconditionally at the top level
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() / 1000) % 60));
  const [extraMinutesTicked, setExtraMinutesTicked] = useState(0);

  const lastBaseExtraKey = `${parsed?.base}_${parsed?.elapsedExtra}`;
  const lastBaseExtraRef = React.useRef(lastBaseExtraKey);

  useEffect(() => {
    if (isSpecial || !parsed) return;

    if (lastBaseExtraRef.current !== lastBaseExtraKey) {
      lastBaseExtraRef.current = lastBaseExtraKey;
      setExtraMinutesTicked(0);
    }

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev >= 59) {
          setExtraMinutesTicked((e) => e + 1);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lastBaseExtraKey, isSpecial, extraProp, timestamp]);

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

  const secDisplay = seconds < 10 ? `0${seconds}` : `${seconds}`;

  // When stoppage / extra time is active: format base+elapsedExtra:sec(+totalExtra)
  if (parsed.totalExtra !== null && parsed.totalExtra !== undefined) {
    const curExtra = parsed.elapsedExtra + extraMinutesTicked;
    // When extra time has ended:
    if (curExtra > parsed.totalExtra) {
      if (parsed.base === 45 || stUpper === "1H") return "HT";
      if (parsed.base === 90 || stUpper === "2H") return "FT";
      if (parsed.base === 105) return "HT";
      if (parsed.base === 120) return "FT";
      return "FT";
    }
    return `${parsed.base}+${curExtra}:${secDisplay}(+${parsed.totalExtra})`;
  }

  if (parsed.elapsedExtra > 0) {
    const curExtra = parsed.elapsedExtra + extraMinutesTicked;
    if (parsed.base === 45 && curExtra >= 5) return "HT";
    if (parsed.base === 90 && curExtra >= 5) return "FT";
    return `${parsed.base}+${curExtra}:${secDisplay}`;
  }

  const currentMinute = parsed.base + extraMinutesTicked;
  if (parsed.base >= 90 && currentMinute >= 96) return "FT";
  if (parsed.base >= 45 && currentMinute >= 50 && stUpper === "1H") return "HT";
  return `${currentMinute}:${secDisplay}`;
};

export interface LiveMatchClockProps {
  minute?: string | number;
  status?: string;
  extra?: string | number;
  timestamp?: number;
  textClass?: string;
  showDot?: boolean;
}

export default function LiveMatchClock({
  minute,
  status,
  extra,
  timestamp,
  textClass = "text-[#02DB54] text-[10px] font-bold",
  showDot = true,
}: LiveMatchClockProps) {
  const formatted = useLiveClock(minute, status, extra, timestamp);
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
