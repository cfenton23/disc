import Phaser from 'phaser';
import { CourseWind } from './wind';
import { DiscSpec } from './types';
import { SPEED_TO_FT, GLIDE_TO_FT, CURVE_TO_FT, WIND_TO_FEET, DISC_SCALE_NEAR, DISC_SCALE_FAR, MAX_NOSE_DEG } from './config';

// Feet-based estimate (no meters)
export function estimateCarryFt(disc: DiscSpec, power:number, noseDeg:number, wind: CourseWind): number {
  power = Phaser.Math.Clamp(power, 0, 1);
  const base = (disc.speed * SPEED_TO_FT + disc.glide * GLIDE_TO_FT) * Math.pow(power, 1.08);
  const curvePenalty = Math.abs(noseDeg) * CURVE_TO_FT;
  // project wind into throw direction (0Â° = to the right). Simplify: use tail/head = cos(dir), cross = sin(dir)
  const theta = Phaser.Math.DegToRad(wind.dirDeg);
  const tailHead = Math.cos(theta); // + tail, - head
  const windBonus = tailHead * (wind.strength) * WIND_TO_FEET;
  return Math.max(40, base - curvePenalty + windBonus);
}

export function createFlightPath(
  start: Phaser.Math.Vector2,
  carryFt: number,
  noseDeg: number,
  wind: CourseWind,
  forehand: boolean,
  pxPerFt: number
): Phaser.Curves.Path {
  // Gentle S: two control points offset laterally by nose & crosswind, easing toward end.
  const rangePx = carryFt * pxPerFt;
  const cross = Math.sin(Phaser.Math.DegToRad(wind.dirDeg)) * wind.strength; // -1..1
  const curveSide = (forehand ? -noseDeg : noseDeg) / MAX_NOSE_DEG; // -1..1 desired side

  const lateral = rangePx * 0.22 * curveSide + rangePx * 0.12 * cross;
  const cp1 = new Phaser.Math.Vector2(start.x + rangePx * 0.33, start.y - rangePx * 0.22);
  const cp2 = new Phaser.Math.Vector2(start.x + rangePx * 0.66, start.y - rangePx * 0.10);
  cp1.y -= Math.abs(lateral) * 0.12;
  cp2.y += Math.abs(lateral) * 0.06;

  const end = new Phaser.Math.Vector2(start.x + rangePx, start.y - rangePx * 0.02);
  cp1.x += lateral * 0.35;
  cp2.x += lateral * 0.85;
  end.x  += lateral;

  const path = new Phaser.Curves.Path(start.x, start.y);
  path.cubicBezierTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
  return path;
}

export function playThrow(
  scene: Phaser.Scene,
  path: Phaser.Curves.Path,
  discKey: string,
  opts: { durationMs:number; onProgress?: (p:number, pt:Phaser.Math.Vector2)=>void }
): Promise<{ landedAt: Phaser.Math.Vector2 }> {
  const cam = scene.cameras.main;
  const disc = scene.add.image(0,0,discKey).setDepth(500)
    .setScale(DISC_SCALE_NEAR)
    .setVisible(true);

  const tmp = { t: 0 };
  cam.shake(120, 0.002);

  return new Promise(resolve=>{
    scene.tweens.add({
      targets: tmp, t: 1, duration: opts.durationMs, ease: 'Cubic.easeOut',
      onUpdate: () => {
        const pt = path.getPoint(tmp.t);
        const tan = path.getTangent(tmp.t);
        const angle = Phaser.Math.RadToDeg(Math.atan2(tan.y, tan.x));
        disc.setPosition(pt.x, pt.y).setRotation(Phaser.Math.DegToRad(angle - 90));
        // Monotonic scale: lerp NEAR -> FAR (no grow-back)
        disc.setScale(Phaser.Math.Linear(DISC_SCALE_NEAR, DISC_SCALE_FAR, tmp.t));
        opts.onProgress?.(tmp.t, pt);
      },
      onComplete: () => {
        const end = path.getPoint(1);
        disc.destroy();
        resolve({ landedAt: end });
      }
    });
  });
}

