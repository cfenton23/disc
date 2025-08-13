export interface UICourseConfig {
  feetPerPx?: number;
  targetRadiusPx?: number;
  isometric?: {
    yScale?: number;
    ySkew?: number;
  };
  colors?: {
    terrain?: string;
    border?: string;
    fairway?: string;
    fairwayEdge?: string;
  };
  fairwayWidth?: {
    narrow?: number;
    medium?: number;
    wide?: number;
  };
  hazards?: {
    trees?: {
      tint?: string;
      density?: number;
      offset?: number;
    };
    treesBorder?: {
      density?: number;
      jitterPx?: number;
      tint?: string;
    };
    ob?: {
      color?: string;
      offset?: number;
    };
    water?: {
      color?: string;
      width?: number;
    };
    bunker?: {
      color?: string;
    };
  };
  hud?: {
    textY?: number;
  };
}

export interface ThrowTuning {
  power?: {
    overchargeHoldSec?: number;
    powerCurveExp?: number;
    overchargeBonus?: number;
  };
  aim?: {
    speedDegPerSec?: number;
  };
  flight?: {
    segLenPx?: number;
    baseCarryFeetAtFull?: {
      driver?: number;
      mid?: number;
      putter?: number;
    };
    speedToCarryMult?: {
      min?: number;
      max?: number;
    };
    glideToDragMult?: {
      min?: number;
      max?: number;
    };
  };
}

import type { DiscSpec } from './models';
export interface DiscCatalog {
  discs?: DiscSpec[];
}

