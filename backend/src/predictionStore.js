// ==========================================
// COMMUNITY MATCH PREDICTIONS ("Who will win?")
// ==========================================
// Every vote is its own empty file: <VOTES_DIR>/<matchId>/<deviceId>.<choice>
// Each device only ever touches its own file, so PM2 workers can't lose each
// other's votes the way a shared read-modify-write counter file would, and a
// tally is just a readdir (no file contents are read).
const fs = require("fs");
const path = require("path");

const VOTES_DIR = process.env.VOTES_DIR
  ? path.resolve(process.env.VOTES_DIR)
  : path.join(__dirname, "../.data/predictions");

const CHOICES = ["home", "draw", "away"];

const isValidMatchId = (matchId) => /^\d+$/.test(String(matchId || ""));
const isValidDeviceId = (deviceId) => /^[A-Za-z0-9-]{8,64}$/.test(String(deviceId || ""));
const isValidChoice = (choice) => CHOICES.includes(choice);

const matchDir = (matchId) => path.join(VOTES_DIR, String(matchId));

async function getTally(matchId, deviceId) {
  let files = [];
  try {
    files = await fs.promises.readdir(matchDir(matchId));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  const counts = { home: 0, draw: 0, away: 0 };
  const seen = new Set();
  let myVote = null;
  for (const file of files) {
    const dot = file.lastIndexOf(".");
    const id = file.slice(0, dot);
    const choice = file.slice(dot + 1);
    // A double tap can briefly leave two files for one device; count it once
    if (dot <= 0 || !isValidChoice(choice) || seen.has(id)) continue;
    seen.add(id);
    counts[choice]++;
    if (id === deviceId) myVote = choice;
  }

  return {
    ...counts,
    total: counts.home + counts.draw + counts.away,
    myVote,
  };
}

async function castVote(matchId, deviceId, choice) {
  const dir = matchDir(matchId);
  await fs.promises.mkdir(dir, { recursive: true });

  // Drop this device's previous pick (if any) so changing a vote moves it
  await Promise.all(
    CHOICES.filter((c) => c !== choice).map((c) =>
      fs.promises.unlink(path.join(dir, `${deviceId}.${c}`)).catch((err) => {
        if (err.code !== "ENOENT") throw err;
      }),
    ),
  );
  await fs.promises.writeFile(path.join(dir, `${deviceId}.${choice}`), "");

  return getTally(matchId, deviceId);
}

module.exports = {
  getTally,
  castVote,
  isValidMatchId,
  isValidDeviceId,
  isValidChoice,
};
