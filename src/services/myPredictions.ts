import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchFixturesByDate, getMatchEventId, PredictionChoice } from "./footballApi";

// This device's own "Who will win?" picks, kept locally so the Prediction tab can
// show real XP / accuracy once the matches are played.
const STORAGE_KEY = "@goalzone_my_predictions";

export type PickResult = PredictionChoice | "void";

export interface MyPick {
  matchId: string;
  choice: PredictionChoice;
  home: string;
  away: string;
  kickoff: number | null; // ms
  pickedAt: number;
  result?: PickResult; // set once the match is over
}

export type MyPicks = Record<string, MyPick>;

const XP_PER_PICK = 10;
const XP_PER_CORRECT = 40;
const XP_PER_LEVEL = 500;
const TIERS = ["Rookie", "Amateur", "Semi-Pro", "Pro", "Expert", "Legend"];
// A match is checked for its result once it should be over
const SETTLE_AFTER_MS = 2.5 * 60 * 60 * 1000;
const FINISHED = new Set(["FT", "AET", "PEN"]);
const VOIDED = new Set(["CANC", "ABD", "AWD", "WO"]);

export const loadMyPicks = async (): Promise<MyPicks> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Error reading my predictions:", err);
    return {};
  }
};

const saveMyPicks = async (picks: MyPicks) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  } catch (err) {
    console.warn("Error saving my predictions:", err);
  }
};

export const recordMyPick = async (
  pick: Omit<MyPick, "pickedAt" | "result">,
): Promise<MyPicks> => {
  const picks = await loadMyPicks();
  picks[pick.matchId] = { ...pick, pickedAt: Date.now() };
  await saveMyPicks(picks);
  return picks;
};

// "2 - 1" → "home"; null when the score can't be read
const resultFromScore = (score: string): PredictionChoice | null => {
  const [h, a] = String(score || "").split("-").map((s) => parseInt(s.trim(), 10));
  if (isNaN(h) || isNaN(a)) return null;
  return h > a ? "home" : h < a ? "away" : "draw";
};

const dateKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

/** Looks up final results for picks whose matches should be over, and saves them. */
export const settleMyPicks = async (picks: MyPicks): Promise<MyPicks> => {
  const due = Object.values(picks).filter(
    (p) => !p.result && p.kickoff && Date.now() - p.kickoff > SETTLE_AFTER_MS,
  );
  if (due.length === 0) return picks;

  const byDate = new Map<string, MyPick[]>();
  due.forEach((p) => {
    const key = dateKey(p.kickoff!);
    byDate.set(key, [...(byDate.get(key) || []), p]);
  });

  const updated = { ...picks };
  let changed = false;
  for (const [date, list] of byDate) {
    let fixtures: any[] = [];
    try {
      fixtures = (await fetchFixturesByDate(date)) || [];
    } catch (_) {
      continue;
    }
    for (const pick of list) {
      const fixture = fixtures.find(
        (m: any) => String(getMatchEventId(m) || m?.id) === pick.matchId,
      );
      const status = String(fixture?.status || "").toUpperCase();
      let result: PickResult | null = null;
      if (FINISHED.has(status)) result = resultFromScore(fixture.score);
      else if (VOIDED.has(status)) result = "void";
      if (result) {
        updated[pick.matchId] = { ...pick, result };
        changed = true;
      }
    }
  }
  if (changed) await saveMyPicks(updated);
  return updated;
};

export interface PredictionStats {
  total: number;
  settled: number;
  correct: number;
  pending: number;
  accuracy: number | null; // %
  streak: number; // current run of correct picks
  xp: number;
  level: number;
  tier: string;
  levelXp: number; // xp inside the current level
  xpPerLevel: number;
}

export const computeStats = (picks: MyPicks): PredictionStats => {
  const list = Object.values(picks);
  const graded = list
    .filter((p) => p.result && p.result !== "void")
    .sort((a, b) => (a.kickoff || a.pickedAt) - (b.kickoff || b.pickedAt));
  const correct = graded.filter((p) => p.result === p.choice).length;

  let streak = 0;
  for (let i = graded.length - 1; i >= 0 && graded[i].result === graded[i].choice; i--) streak++;

  const xp = list.length * XP_PER_PICK + correct * XP_PER_CORRECT;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return {
    total: list.length,
    settled: graded.length,
    correct,
    pending: list.filter((p) => !p.result).length,
    accuracy: graded.length ? Math.round((correct / graded.length) * 100) : null,
    streak,
    xp,
    level,
    tier: TIERS[Math.min(level - 1, TIERS.length - 1)],
    levelXp: xp % XP_PER_LEVEL,
    xpPerLevel: XP_PER_LEVEL,
  };
};

export const XP_REWARDS = { pick: XP_PER_PICK, correct: XP_PER_CORRECT };
