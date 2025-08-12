import Phaser from 'phaser';
import uiAmbience from '../../ui_ambience.json';
import uiLayout from '../../ui_layout.json';

type BgParts = { far: Phaser.GameObjects.Image; near: Phaser.GameObjects.Image };
const DEPTH = { BG_FAR: 0, BG_NEAR: 2 };

export function buildBackground(scene: Phaser.Scene): BgParts {
  const { width, height } = scene.scale;

  // Far layer
  const far = scene.add.image(width * 0.5, height * 0.5, 'bg_trees')
    .setOrigin(0.5).setDepth(DEPTH.BG_FAR);
  const cover = Math.max(width / far.width, height / far.height);
  far.setScale(cover);

  // Near layer (reuse same art, slightly different scale/alpha)
  const nearAlpha = (uiAmbience as any)?.ambient?.layers?.find((l: any)=>l.id==='treeLineNear')?.opacity ?? 0.85;
  const near = scene.add.image(width * 0.5, height * 0.5, 'bg_trees')
    .setOrigin(0.5).setDepth(DEPTH.BG_NEAR).setAlpha(nearAlpha);
  near.setScale(cover * 1.01);

  // Motion (very gentle)
  const mv = (uiLayout as any)?.motion ?? {};
  const farDeg = (mv.rotateDegFar ?? 1.0);
  const nearDeg = (mv.rotateDegNear ?? 1.0);
  const farDrift = (mv.driftPxFar ?? 1);
  const nearDrift = (mv.driftPxNear ?? 2);

  const slowMs = 260 * 6; // long/relaxed; pulled from ui_motion earlier

  scene.tweens.add({ targets: far,  angle: farDeg,  duration: slowMs, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: far,  x: far.x + farDrift,  duration: slowMs, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: near, angle: -nearDeg, duration: slowMs, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: near, x: near.x + nearDrift, duration: slowMs, ease: 'Sine.InOut', yoyo: true, repeat: -1 });

  return { far, near };
}

export function resizeBackground(parts: BgParts, scene: Phaser.Scene) {
  const { width, height } = scene.scale;
  const cover = Math.max(width / parts.far.width, height / parts.far.height);
  parts.far.setPosition(width * 0.5, height * 0.5).setScale(cover);
  parts.near.setPosition(width * 0.5, height * 0.5).setScale(cover * 1.01);
}

