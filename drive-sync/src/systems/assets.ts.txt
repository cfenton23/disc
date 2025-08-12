// src/systems/Assets.ts
export const assetPaths = {
  minimap: (courseId: string, holeN: number) =>
    `assets/minimaps/${courseId}_h${String(holeN).padStart(2, '0')}.png`,
  disc: (discId: string) => `assets/discs/${discId}.png`,
  buff: (buffId: string) => `assets/buffs/${buffId}.png`,
  rival: (rivalId: string) => `assets/rivals/${rivalId}.png`
};

