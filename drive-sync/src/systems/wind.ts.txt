export class SeededRNG {
  private s: number;
  constructor(seed: string|number) {
    const str = String(seed);
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    this.s = (h >>> 0) / 4294967295;
  }
  next() { // 0..1
    // xorshift*
    let x = Math.floor(this.s * 1e9) + 0x9e3779b9;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.s = (x >>> 0) / 4294967295;
    return this.s;
  }
  range(min:number, max:number) { return min + (max-min)*this.next(); }
  pick<T>(arr:T[]) { return arr[Math.floor(this.next() * arr.length)]; }
}

export interface CourseWind {
  dirDeg: number;   // 0..360
  strength: number; // 0..1 baseline
}

export function initCourseWind(rng: SeededRNG): CourseWind {
  return { dirDeg: Math.floor(rng.range(0, 360)), strength: 0.45 };
}

export function applyHoleWind(base: CourseWind, hole: {windProfile?:string}|undefined, rng: SeededRNG): CourseWind {
  const profile = hole?.windProfile ?? 'mixed';
  const mul = profile === 'open' ? 1.25 : profile === 'sheltered' ? 0.7 : 1.0; // //NOTE
  return {
    dirDeg: (base.dirDeg + Math.floor(rng.range(-18, 18)) + 360) % 360,
    strength: Math.min(1, Math.max(0, base.strength * mul * rng.range(0.95, 1.1))),
  };
}

