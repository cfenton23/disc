import Phaser from 'phaser';
import { WATER_WAVE_AMP, WATER_WAVE_FREQ } from './config';

// Simple water strip with a safe polyline ripple (no quadraticCurveTo)
export function drawWater(scene: Phaser.Scene, y: number, width: number): Phaser.GameObjects.Graphics {
  const H = scene.scale.height;
  const g = scene.add.graphics({ x: 0, y });
  g.fillStyle(0x1a4e4e, 0.45).fillRect(0, 0, width, 0.05 * H);
  g.lineStyle(1, 0x89d7d7, 0.35).beginPath();
  for (let x = 20; x <= width - 20; x += 12) {
    const yy = 12 + Math.sin(x * WATER_WAVE_FREQ) * WATER_WAVE_AMP;
    if (x === 20) g.moveTo(x, yy); else g.lineTo(x, yy);
  }
  g.strokePath();
  return g;
}

// Big "X" card when a minimap image is missing
export function drawMinimapMissing(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x10201a, 1).fillRoundedRect(0, 0, w, h, 12);
  g.lineStyle(2, 0x5a7b6c).strokeRoundedRect(0, 0, w, h, 12);
  g.lineStyle(4, 0x8a1f1f).beginPath()
    .moveTo(10, 10).lineTo(w - 10, h - 10)
    .moveTo(w - 10, 10).lineTo(10, h - 10)
    .strokePath();
  c.add(g);
  return c;
}

