import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";

const FINISHED_SET = new Set([
  "FT", "AET", "PEN", "FINISHED", "ENDED", "FULL TIME", "CANC", "ABD", "AWD", "WO", "PST"
]);

const NOT_STARTED_SET = new Set([
  "NS", "TBD", "TIMED", "SCHEDULED", "UPCOMING", "POSTPONED"
]);

const REGULATION_LIVE_SET = new Set(["1H", "2H", "LIVE"]);
const STALE_LIVE_MINUTES = 135;

// End minute of the period a live status belongs to (stoppage is shown as end+N)
const periodEndMinute = (status: string, minute: number) => {
  if (status === "1H") return 45;
  if (status === "2H") return 90;
  if (status === "ET") return minute > 105 ? 120 : 105;
  return null;
};

export const useLiveClock = (
  initialMinute?: string | number,
  status?: string,
  extraProp?: string | number,
  timestamp?: number,
  showSeconds: boolean = false
) => {
  const minStr = String(initialMinute || "").trim();
  const stUpper = String(status || "").trim().toUpperCase();
  const minUpper = minStr.toUpperCase();

  const isNotStarted = NOT_STARTED_SET.has(stUpper) || NOT_STARTED_SET.has(minUpper);

  // 0. Stale-feed fallback: a regulation match still "live" 135+ min after kickoff is over
  // (2H stoppage can legitimately run ~120 min after kickoff). Extra time is never expired.
  // Returned only after the hooks below: an early return here changes the hook count between
  // renders and React throws "Rendered fewer hooks than expected" (a fatal JS crash).
  let kickoffResult: "FT" | "HT" | null = null;
  if (timestamp && !isNotStarted && (!stUpper || REGULATION_LIVE_SET.has(stUpper))) {
    const minsSinceKO = (Date.now() - timestamp * 1000) / 60000;
    if (minsSinceKO >= STALE_LIVE_MINUTES) {
      kickoffResult = "FT";
    } else if (minsSinceKO >= 60 && minsSinceKO < 75 && (stUpper === "1H" || minUpper.startsWith("45"))) {
      kickoffResult = "HT";
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
    kickoffResult !== null ||
    isFinished ||
    isHalfTime ||
    isNotStarted ||
    ["HT", "FT", "AET", "PEN", "PST", "CANC", "NS", "TBD", "SUSP", "INT", "BT", "P"].includes(minUpper) ||
    Boolean(
      stUpper &&
        ["HT", "FT", "AET", "PEN", "PST", "CANC", "NS", "TBD", "SUSP", "INT", "BT", "P"].includes(stUpper)
    );

  // "90+3'" / "67'" → { base, played }. `played` is stoppage minutes played so far: the API
  // (fixture.status.extra) never gives the announced added time, so there is no target to
  // count down to and the half only ends when the status changes.
  const parseMinute = (val: string, extraVal?: string | number) => {
    // Drop legacy bracketed "(+5)" suffixes and apostrophes
    const clean = val
      .replace(/[\(\[][^\)\]]*[\)\]]/g, "")
      .replace(/'/g, "")
      .trim();

    if (clean.includes("+")) {
      const [baseStr, playedStr] = clean.split("+");
      const base = parseInt(baseStr, 10);
      const played = parseInt(playedStr, 10);
      // "90+0" falls through so the `extra` field can supply the stoppage
      if (!isNaN(base) && played > 0) return { base, played };
    }

    const num = parseInt(clean, 10);
    if (isNaN(num)) return null;

    const propExtra = parseInt(String(extraVal ?? "").replace(/[^0-9]/g, ""), 10);
    if (!isNaN(propExtra) && propExtra > 0) return { base: num, played: propExtra };

    // Stoppage reported as elapsed past the period end (e.g. 93 in 2H)
    const end = periodEndMinute(stUpper, num);
    if (end && num > end) return { base: end, played: num - end };

    return { base: num, played: 0 };
  };

  const parsed = parseMinute(minStr, extraProp);

  // Hooks MUST be called unconditionally at the top level
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() / 1000) % 60));
  const [extraMinutesTicked, setExtraMinutesTicked] = useState(0);

  const lastBaseExtraKey = `${parsed?.base}_${parsed?.played}`;
  const lastBaseExtraRef = React.useRef(lastBaseExtraKey);

  useEffect(() => {
    // CRITICAL PERFORMANCE: Only run the 1-second interval when showSeconds is explicitly enabled (e.g. Details Modal)
    if (!showSeconds || isSpecial || !parsed) return;

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
  }, [showSeconds, lastBaseExtraKey, isSpecial, extraProp, timestamp]);

  if (kickoffResult) {
    return kickoffResult;
  }

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

  // STATIC MODE (Used for all match list cards - 0 timers, 0 CPU re-renders)
  if (!showSeconds) {
    return parsed.played > 0 ? `${parsed.base}+${parsed.played}'` : `${parsed.base}'`;
  }

  // DETAILED MODE WITH SECONDS (Used ONLY inside MatchDetailsModal for active match)
  const secDisplay = seconds < 10 ? `0${seconds}` : `${seconds}`;

  if (parsed.played > 0) {
    return `${parsed.base}+${parsed.played + extraMinutesTicked}:${secDisplay}`;
  }

  // Ticking past the period end between polls rolls into stoppage (90' → 90+1) rather than 91'
  const currentMinute = parsed.base + extraMinutesTicked;
  const periodEnd = periodEndMinute(stUpper, parsed.base);
  if (periodEnd && parsed.base <= periodEnd && currentMinute > periodEnd) {
    return `${periodEnd}+${currentMinute - periodEnd}:${secDisplay}`;
  }
  return `${currentMinute}:${secDisplay}`;
};

export interface LiveMatchClockProps {
  minute?: string | number;
  status?: string;
  extra?: string | number;
  timestamp?: number;
  textClass?: string;
  showDot?: boolean;
  showSeconds?: boolean;
}

function LiveMatchClock({
  minute,
  status,
  extra,
  timestamp,
  textClass = "text-[#02DB54] text-[10px] font-bold",
  showDot = true,
  showSeconds = false,
}: LiveMatchClockProps) {
  const formatted = useLiveClock(minute, status, extra, timestamp, showSeconds);
  const isLive = !["FT", "HT", "NS", "AET", "PEN", "PST", "CANC", "TBD"].includes(formatted);

  return (
    <View className="flex-row items-center gap-1 justify-center">
      {showDot && isLive && (
        <View className="w-1.5 h-1.5 rounded-full bg-[#02DB54]" />
      )}
      <Text className={textClass}>{formatted}</Text>
    </View>
  );
}

export default React.memo(LiveMatchClock);
