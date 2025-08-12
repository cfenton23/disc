// src/systems/ai.ts
import Phaser from 'phaser';
import { DiscSpec } from '../types/models';
import { PUTTER_MAX_FT } from './config';

/** Minimal course-hole shape we need here (keep local to avoid wide deps). */
export type CourseHole = {
  n: number;           // 1..18
  par: number;         // 3/4/5
  lengthFt: number;    // tee to pin, feet
};

/** Course-lite shape consumed by the AI helpers. */
export type CourseLite = {
  holes: CourseHole[];
};

/** One player row tracked during a round. */
export type PlayerRow = {
  name: string;
  rating: number;        // PDGA-ish rating ~ 800..1000
  isHuman: boolean;
  holeIndex: number;     // 0..17
  strokesOnHole: number; // strokes taken on current hole
  total: number;         // to-par (E=0, -1, +2, ...)
  finished: boolean;     // completed 18
  remainingFt: number;   // remaining feet to the pin on current lie
};

/* -------------------------------------------------------------------------- */
/*                          AI disc selection helper                          */
/* -------------------------------------------------------------------------- */

/**
 * Chooses an AI disc from the available bag based on remaining distance.
 * Keeps your original behavior exactly.
 */
export function chooseAiDisc(allDiscs: DiscSpec[], remainingFt: number): DiscSpec {
  const MID_MAX_FT = 260; // //NOTE: AI putter max range ceiling for midrange fallback

  const slot = (d: DiscSpec) => (d.slot || '').toLowerCase();

  // 1) Prefer putter when inside putt range
  let candidates = allDiscs.filter(
    d => slot(d) === 'putter' && remainingFt <= PUTTER_MAX_FT
  );

  // 2) Otherwise midrange comfort zone
  if (candidates.length === 0 && remainingFt <= MID_MAX_FT) {
    candidates = allDiscs.filter(d => slot(d) === 'mid' || slot(d) === 'midrange');
  }

  // 3) Otherwise drivers; fallback to "any"
  if (candidates.length === 0) {
    candidates = allDiscs.filter(d => slot(d) === 'driver' || slot(d) === 'fairway');
    if (candidates.length === 0) candidates = allDiscs.slice();
  }

  // Rank â€œbestâ€ by a simple bias toward speed + glide
  candidates.sort((a, b) => (b.speed * 10 + b.glide) - (a.speed * 10 + a.glide));
  return candidates[0];
}

/* -------------------------------------------------------------------------- */
/*                      Tournament seeding & live simulation                   */
/* -------------------------------------------------------------------------- */

/**
 * Seeds the round players:
 * - Human first (hole 1 / index 0)
 * - 19 AI (or fewer if not enough provided), shotgun-ish start across early holes
 */
export function seedPlayers(
  ops: { name: string; rating: number }[],
  humanName: string,
  course: CourseLite,
  rng: Phaser.Math.RandomDataGenerator
): PlayerRow[] {
  const players: PlayerRow[] = [];

  // Human
  players.push({
    name: humanName,
    rating: 900, // //NOTE: placeholder base; hook to profile later
    isHuman: true,
    holeIndex: 0,
    strokesOnHole: 0,
    total: 0,
    finished: false,
    remainingFt: course.holes?.[0]?.lengthFt ?? 300
  });

  // 19 opponents (shotgun-ish spread over the first few holes)
  const targetCount = 19;
  const shuffled = rng.shuffle(ops.slice()).slice(0, targetCount);

  // Shotgun offsets (roughly groups of 4 across first 5 tees)
  const startOffsets = [0,0,0,0, 1,1,1,1, 2,2,2,2, 3,3,3,3, 4,4,3];

  shuffled.forEach((o, i) => {
    const offset = startOffsets[i] ?? 0;
    const h = Math.min(offset, Math.max(0, (course.holes?.length ?? 18) - 1));
    players.push({
      name: o.name,
      rating: o.rating,
      isHuman: false,
      holeIndex: h,
      strokesOnHole: 0,
      total: 0,
      finished: false,
      remainingFt: course.holes?.[h]?.lengthFt ?? 300
    });
  });

  return players;
}

/**
 * Builds simple leaderboard rows, sorted by total then hole index.
 * (You can shape this to your UIâ€™s setRows() format.)
 */
export function buildRows(players: PlayerRow[]) {
  return players
    .slice()
    .sort((a, b) => {
      if (a.total !== b.total) return a.total - b.total; // better score first
      return a.holeIndex - b.holeIndex;                   // ahead in round first
    })
    .map((p, idx) => ({
      rank: idx + 1,
      name: p.isHuman ? 'You' : p.name,
      total: p.total,
      hole: p.finished ? 'H18' : `H${(p.holeIndex + 1).toString().padStart(2, '0')}`
    }));
}

/**
 * Advance ONE AI by one "throw".
 * - Uses a simple rating-based distance model.
 * - Respects gating: no AI can be >1 hole ahead of the human's seen progress.
 * - Calls onAdvanced(ai) after mutating the chosen AI row.
 */
export function tickTournament(
  players: PlayerRow[],
  rng: Phaser.Math.RandomDataGenerator,
  course: CourseLite,
  onAdvanced: (p: PlayerRow) => void,
  maxHoleHumanHasSeen: number
) {
  const activeAis = players.filter(p => !p.isHuman && !p.finished);
  if (activeAis.length === 0) return;

  // Pick one AI to act this tick
  const ai = rng.pick(activeAis);
  if (!ai) return;

  // Gating rule: AI cannot be >1 hole ahead of what the human has seen
  const capHole = Math.min(
    maxHoleHumanHasSeen + 1,
    (course.holes?.length ?? 18) - 1
  );
  if (ai.holeIndex > capHole) return;

  const hole = course.holes?.[ai.holeIndex];
  if (!hole) return;

  // Skill 0..1 from rating (800..1050 -> 0..1)
  const skill = Phaser.Math.Clamp((ai.rating - 800) / 250, 0, 1);

  // If within putt range, simulate a putt; otherwise simulate a throw carry.
  const isPutt = ai.remainingFt <= PUTTER_MAX_FT;
  let carryFt = 0;

  if (isPutt) {
    // Make probability increases with skill and proximity
    const pMake = Phaser.Math.Clamp(
      0.35 + skill * 0.5 + (PUTTER_MAX_FT - ai.remainingFt) / (PUTTER_MAX_FT * 2),
      0.12,
      0.97
    );
    const made = rng.frac() < pMake;
    carryFt = made ? ai.remainingFt + 5 : Phaser.Math.Between(8, 22) * (0.5 + skill * 0.6);
  } else {
    // Tee/approach: coarse carry distribution by skill with noise
    const base = 180 + skill * 220;      // 180..400+
    const jitter = rng.between(-40, 40);
    carryFt = Math.max(70, base + jitter);
  }

  ai.strokesOnHole += 1;
  ai.remainingFt = Math.max(0, ai.remainingFt - carryFt);

  // Holed out?
  if (ai.remainingFt <= 0) {
    const toPar = ai.strokesOnHole - (hole.par ?? 3);
    ai.total += toPar;

    if (ai.holeIndex >= (course.holes.length - 1)) {
      ai.finished = true;
    } else {
      ai.holeIndex += 1;
      ai.strokesOnHole = 0;
      ai.remainingFt = course.holes[ai.holeIndex]?.lengthFt ?? 300;
    }
  }

  onAdvanced(ai);
}

