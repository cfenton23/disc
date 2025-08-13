export type DiscSpec = {
  id: string;
  name: string;
  slot: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  stability?: string;
  image?: string;
};

export type CourseHole = {
  n: number;
  par: number;
  lengthFt: number;
  minimapImage?: string;
  teePlacement?: { x: number; y: number }; // 0..1
  windProfile?: 'sheltered' | 'mixed' | 'open';
  hazards?: string[];
  controlPoints?: { x: number; y: number }[];
};

export type PlayerRow = {
  id: string;
  name: string;
  rating: number;
  holeIndex: number;            // 0..17
  strokesOnHole: number;
  totalScore: number;           // vs par
  holeScores: number[];         // length 18, NaN if not played
  finished: boolean;
  remainingFt?: number;         // for sim
};

