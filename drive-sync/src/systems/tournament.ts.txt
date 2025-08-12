import { PlayerRow, CourseData, CourseHole } from './types';
import { SeededRNG } from './wind';
import { AI_THROW_INTERVAL_MIN_MS, AI_THROW_INTERVAL_MAX_MS, RATING_POWER_BONUS, PUTTER_MAX_FT, PUTT_PERFECT_WINDOW, PUTT_MISS_CUTOFF } from './config';

export function seedPlayers(opponents: {name:string; rating:number}[], humanName:string, course: CourseData, rng: SeededRNG): PlayerRow[] {
  const ai = [...opponents];
  while (ai.length < 19) ai.push(ai[ai.length % opponents.length]); // repeat if needed
  const picked = ai.slice(0,19);
  const human: PlayerRow = { id:'human', name:humanName, rating: 900, isHuman:true, group:0, hole:1, strokesOnHole:0, totalScore:0, finished:false, scoreByHole: new Array(18).fill(0) };
  const pool: PlayerRow[] = [human, ...picked.map((o,i)=>({
    id:'ai'+i, name:o.name, rating:o.rating, isHuman:false, group:0, hole:1, strokesOnHole:0, totalScore:0, finished:false, scoreByHole: new Array(18).fill(0)
  }))];
  // Shuffle and deal into groups, random starting holes for AI groups (human fixed H1)
  const others = pool.slice(1);
  for (let i=others.length-1;i>0;i--){ const j=Math.floor(rng.next()*(i+1)); [others[i],others[j]]=[others[j],others[i]]; }
  const groups: PlayerRow[][] = [ [pool[0]] ];
  for (const p of others) {
    let g = groups.length-1;
    if (groups[g].length >= 4) { groups.push([]); g++; }
    groups[g].push(p);
  }
  // Assign holes
  const holes = course.holes.map(h=>h.n);
  for (let g=1; g<groups.length; g++){
    const start = rng.pick(holes.filter(n=>n!==1));
    for (const p of groups[g]) { p.hole = start; p.group = g; }
  }
  for (const p of groups[0]) { p.group = 0; p.hole = 1; }
  return groups.flat();
}

// Lightweight difficulty factor per hole
function holeDifficulty(h: CourseHole): number {
  let d = 1;
  if (h.elevation === 'uphill') d += 0.08;
  if (h.elevation === 'downhill') d -= 0.05;
  if (h.fairwayWidth === 'narrow') d += 0.06;
  if (h.fairwayWidth === 'wide') d -= 0.04;
  if ((h.hazards||[]).some(z=>z.includes('water'))) d += 0.05;
  if (h.pinGuard && h.pinGuard !== 'none') d += 0.04;
  return Math.max(0.85, Math.min(1.2, d));
}

export function tickTournament(players: PlayerRow[], rng: SeededRNG, course: CourseData, onAdvance:(p:PlayerRow)=>void) {
  // choose random active AI (skip human & finished)
  const active = players.filter(p=>!p.isHuman && !p.finished);
  if (!active.length) return;
  const p = rng.pick(active);
  const hole = course.holes[Math.min(p.hole-1, course.holes.length-1)];
  // Simple throw cadence: advance strokes or finish hole
  const hd = holeDifficulty(hole);
  const rating01 = Math.max(0, Math.min(1, (p.rating - 780) / (1020 - 780)));
  const power = Math.min(1, 0.7 + RATING_POWER_BONUS * rating01 + (rng.next()-0.5)*0.2) * (1/hd);
  p.strokesOnHole++;

  // Putt logic when close
  if (rng.next() < 0.35) { // sometimes approach lands close
    const remainingFt = rng.range(8, 60) * hd;
    if (remainingFt <= PUTTER_MAX_FT) {
      const target = remainingFt / PUTTER_MAX_FT;
      const error = Math.abs(power - target);
      const bonus = rating01 * 0.12;
      const makes = (error <= PUTT_PERFECT_WINDOW + bonus) && (error < PUTT_MISS_CUTOFF);
      if (makes) { finishHole(p, hole); onAdvance(p); return; }
    }
  }
  // Otherwise randomly decide if hole completes based on skill
  if (rng.next() < 0.22 + 0.45 * rating01 * (1/hd)) {
    finishHole(p, hole);
    onAdvance(p);
  }
}

function finishHole(p: PlayerRow, hole: CourseHole) {
  const strokes = Math.max(1, p.strokesOnHole);
  p.scoreByHole[hole.n-1] = strokes;
  p.totalScore += (strokes - hole.par);
  p.strokesOnHole = 0;
  if (hole.n >= 18) p.finished = true; else p.hole++;
}

export function buildRows(players: PlayerRow[]) {
  const rows = players.slice().sort((a,b)=>{
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
    return a.hole - b.hole; // further hole first
  }).map((p,i)=>({ rank:i+1, name:p.name, score:p.totalScore, hole:p.hole, isHuman:p.isHuman }));
  return rows;
}

