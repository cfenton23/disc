// Shared lightweight types (kept minimal on purpose)
export interface DiscSpec {
  id: string;
  name: string;
  slot: 'putter'|'mid'|'midrange'|'fairway'|'driver'|string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  stability?: string;
  textureKey: string;   // <- use this with setTexture()
  image?: string;       // optional info path for tooltips
}


export interface CourseHole {
  n: number;
  par: number;
  lengthFt: number;
  fairwayWidth?: 'narrow'|'medium'|'wide';
  elevation?: 'downhill'|'flat'|'uphill';
  hazards?: string[];
  windProfile?: 'open'|'mixed'|'sheltered';
  pinGuard?: 'none'|'light'|'trees'|string;
  recommendedLine?: string;
  minimapImage?: string;
  teePlacement?: { x:number, y:number };
}

export interface CourseData {
  id: string;
  name: string;
  seed: number;
  totalPar: number;
  holes: CourseHole[];
}

export interface PlayerRow {
  id: string;
  name: string;
  rating: number;
  isHuman: boolean;
  group: number;        // card index
  hole: number;         // 1..18
  strokesOnHole: number;
  totalScore: number;   // vs par
  finished: boolean;
  scoreByHole: number[]; // length 18, stroke count per hole
}

