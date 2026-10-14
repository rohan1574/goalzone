import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Check } from "lucide-react-native";
import {
  fetchMatchPrediction,
  submitMatchPrediction,
  MatchPredictionTally,
  PredictionChoice,
} from "../../services/footballApi";
import { recordMyPick } from "../../services/myPredictions";

interface Team {
  name: string;
  short?: string;
  logo?: string;
}

interface MatchPredictionProps {
  matchId: string;
  home: Team;
  away: Team;
  score: string;
  isUpcoming: boolean;
  isFinished: boolean;
  kickoff?: number | null; // ms, lets the Prediction tab settle the pick after the match
  onVote?: (choice: PredictionChoice) => void;
}

const CHOICE_COLORS: Record<PredictionChoice, string> = {
  home: "#02DB54",
  draw: "#9CA3AF",
  away: "#60A5FA",
};

// Largest-remainder rounding so the three percentages always add up to exactly 100
const toPercentages = (tally: MatchPredictionTally): Record<PredictionChoice, number> => {
  const choices: PredictionChoice[] = ["home", "draw", "away"];
  if (!tally.total) return { home: 0, draw: 0, away: 0 };
  const raw = choices.map((c) => (tally[c] / tally.total) * 100);
  const floored = raw.map(Math.floor);
  let remaining = 100 - floored.reduce((a, b) => a + b, 0);
  raw
    .map((value, i) => ({ i, remainder: value - floored[i] }))
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ i }) => {
      if (remaining > 0) {
        floored[i]++;
        remaining--;
      }
    });
  return { home: floored[0], draw: floored[1], away: floored[2] };
};

// "2 - 1" → "home", "1 - 1" → "draw"; null when the score can't be read
const getResult = (score: string): PredictionChoice | null => {
  const [h, a] = String(score || "").split("-").map((s) => parseInt(s.trim(), 10));
  if (isNaN(h) || isNaN(a)) return null;
  return h > a ? "home" : h < a ? "away" : "draw";
};

export default function MatchPrediction({
  matchId,
  home,
  away,
  score,
  isUpcoming,
  isFinished,
  kickoff = null,
  onVote,
}: MatchPredictionProps) {
  const [tally, setTally] = useState<MatchPredictionTally | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTally(null);
    setLoadFailed(false);
    fetchMatchPrediction(matchId)
      .then((data) => {
        if (!cancelled) setTally(data);
      })
      .catch((err) => {
        console.warn("Match prediction unavailable:", err?.message || err);
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Backend without the prediction endpoint (or a non-API match id): leave the card out
  if (loadFailed) return null;

  const votingOpen = isUpcoming;
  const handleVote = async (choice: PredictionChoice) => {
    if (!tally || !votingOpen || submitting || tally.myVote === choice) return;

    // Optimistic update: move this device's vote straight away, then trust the server's numbers
    const previous = tally;
    const next: MatchPredictionTally = {
      ...tally,
      myVote: choice,
      total: tally.myVote ? tally.total : tally.total + 1,
    };
    next[choice] = tally[choice] + 1;
    if (tally.myVote) next[tally.myVote] = Math.max(0, tally[tally.myVote] - 1);
    setTally(next);
    setSubmitting(true);
    setSubmitError(false);

    try {
      setTally(await submitMatchPrediction(matchId, choice));
      await recordMyPick({ matchId, choice, home: home.name, away: away.name, kickoff });
      onVote?.(choice);
    } catch (err) {
      console.warn("Failed to submit prediction:", err);
      setTally(previous);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const showResults = !!tally && (!!tally.myVote || !votingOpen);
  const percentages = tally ? toPercentages(tally) : { home: 0, draw: 0, away: 0 };
  const result = isFinished ? getResult(score) : null;

  const options: { choice: PredictionChoice; label: string; logo?: string }[] = [
    { choice: "home", label: home.short || home.name, logo: home.logo },
    { choice: "draw", label: "Draw" },
    { choice: "away", label: away.short || away.name, logo: away.logo },
  ];
  const choiceName = (choice: PredictionChoice) =>
    choice === "home" ? home.name : choice === "away" ? away.name : "a draw";

  let footer = "Tap to predict and see what everyone else thinks";
  if (tally?.myVote && result) {
    footer = tally.myVote === result ? "✅ Your prediction was correct!" : `❌ You predicted ${choiceName(tally.myVote)}`;
  } else if (tally?.myVote && votingOpen) {
    footer = `You picked ${choiceName(tally.myVote)} · tap another option to change`;
  } else if (tally?.myVote) {
    footer = `You picked ${choiceName(tally.myVote)} · voting closed at kickoff`;
  } else if (!votingOpen) {
    footer = "Voting closed at kickoff";
  }

  return (
    <View className="bg-[#131517] rounded-2xl p-4 border border-white/5 mb-6">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white font-extrabold text-sm">Who will win?</Text>
        {tally ? (
          <Text className="text-gray-400 font-bold text-[11px]">
            {tally.total.toLocaleString()} {tally.total === 1 ? "vote" : "votes"}
          </Text>
        ) : null}
      </View>

      {!tally ? (
        <ActivityIndicator color="#02DB54" className="my-4" />
      ) : (
        <>
          {/* Options */}
          <View className="flex-row gap-2">
            {options.map(({ choice, label, logo }) => {
              const isMine = tally.myVote === choice;
              const isResult = result === choice;
              const color = CHOICE_COLORS[choice];
              return (
                <TouchableOpacity
                  key={choice}
                  onPress={() => handleVote(choice)}
                  disabled={!votingOpen || submitting}
                  activeOpacity={0.7}
                  className="flex-1 items-center py-3 px-1 rounded-xl border"
                  style={{
                    borderColor: isMine ? color : "rgba(255,255,255,0.08)",
                    backgroundColor: isMine ? `${color}1A` : "#181A1C",
                  }}
                >
                  {logo ? (
                    <ExpoImage source={{ uri: logo }} style={{ width: 28, height: 28 }} contentFit="contain" />
                  ) : (
                    <View className="w-7 h-7 rounded-full bg-white/10 items-center justify-center">
                      <Text className="text-white font-black text-xs">X</Text>
                    </View>
                  )}
                  <Text className="text-white font-bold text-[11px] mt-1.5 text-center" numberOfLines={1}>
                    {label}
                  </Text>
                  {showResults ? (
                    <Text className="font-black text-base mt-0.5" style={{ color }}>
                      {percentages[choice]}%
                    </Text>
                  ) : null}
                  {isMine ? (
                    <View
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <Check size={10} color="#000000" strokeWidth={3.5} />
                    </View>
                  ) : null}
                  {isResult ? (
                    <View className="absolute top-1.5 left-1.5 px-1 rounded bg-white/10">
                      <Text className="text-white font-black text-[7px]">RESULT</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Ratio bar */}
          {showResults ? (
            <View className="flex-row h-2 rounded-full overflow-hidden bg-white/5 mt-3">
              {(["home", "draw", "away"] as PredictionChoice[]).map((choice) =>
                percentages[choice] > 0 ? (
                  <View
                    key={choice}
                    style={{ flex: percentages[choice], backgroundColor: CHOICE_COLORS[choice] }}
                  />
                ) : null,
              )}
            </View>
          ) : null}

          <Text className={`text-[11px] font-bold text-center mt-3 ${submitError ? "text-red-400" : "text-gray-400"}`}>
            {submitError ? "Couldn't save your prediction. Please try again." : footer}
          </Text>
        </>
      )}
    </View>
  );
}
