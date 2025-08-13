import Phaser from "phaser";

type ControlPoint = { x: number; y: number } | [number, number];

export function buildFairwayPath(
  tee: Phaser.Math.Vector2,
  pin: Phaser.Math.Vector2,
  widthPx: number,
  style: string,
  controlPoints?: ControlPoint[]
): Phaser.Math.Vector2[] {
  const base = pin.clone().subtract(tee);
  const len = base.length();
  const dir = base.clone().normalize();
  const perp = new Phaser.Math.Vector2(-dir.y, dir.x);
  let amp = widthPx * 0.55;
  if (style === "S-curve") { amp = widthPx * 0.35; }

  const anchors: Phaser.Math.Vector2[] = [tee.clone()];
  if (style === "hyzer") {
    anchors.push(tee.clone().add(dir.clone().scale(len * 0.5)).add(perp.clone().scale(-amp)));
  } else if (style === "anhyzer") {
    anchors.push(tee.clone().add(dir.clone().scale(len * 0.5)).add(perp.clone().scale(amp)));
  } else if (style === "S-curve") {
    anchors.push(
      tee.clone().add(dir.clone().scale(len * 0.33)).add(perp.clone().scale(amp)),
      tee.clone().add(dir.clone().scale(len * 0.66)).add(perp.clone().scale(-amp))
    );
  }

  (controlPoints || []).forEach(cp => {
    if (Array.isArray(cp)) anchors.push(new Phaser.Math.Vector2(cp[0], cp[1]));
    else anchors.push(new Phaser.Math.Vector2(cp.x, cp.y));
  });

  anchors.push(pin.clone());

  const curve = new Phaser.Curves.Spline(anchors);
  return curve.getPoints(22);
}
