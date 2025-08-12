import Phaser from 'phaser';
import uiTheme from '../../ui_theme.json';
import uiMotion from '../../ui_motion.json';

export type UIButton = { container: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone };

export function makeUIButton(
  scene: Phaser.Scene,
  label: string,
  onClick: () => void,
  widthPx: number,
  heightPx: number
): UIButton {
  const theme: any = uiTheme;
  const radiusMap: any = { sm: 8, md: 12, lg: 20, xl: 28 };
  const btn = theme?.components?.button ?? {};
  const radius =
    typeof btn.radius === 'number' ? btn.radius : (radiusMap[btn.radius] ?? 16);

// Root container for visuals
const container = scene.add.container(0, 0);

// NEW: render above background layers for sure
container.setDepth(100);

// Keep fully opaque + normal blend
container.setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);



  
  // Background graphics (force fully opaque + normal blend)
  const g = scene.add.graphics();
  const fill = colorFromToken(btn.bg, theme) ?? 0x6fc276;
  const stroke = colorFromToken(theme?.palette?.accent2, theme) ?? 0xc3a46a;

  g.clear();
  g.setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
  g.fillStyle(fill, 1).fillRoundedRect(-widthPx / 2, -heightPx / 2, widthPx, heightPx, radius);
  g.lineStyle(3, stroke, 1).strokeRoundedRect(-widthPx / 2, -heightPx / 2, widthPx, heightPx, radius);
  container.add(g);

  // Label (force normal blend + opaque)
  const text = scene.add.text(0, 0, label, {
    fontFamily: theme?.typography?.fontUI ?? 'Inter, system-ui, sans-serif',
    fontSize: ((theme?.typography?.sizes?.lg ?? 20) as number) + 'px',
    fontStyle: '600',
    color: theme?.palette?.bg ?? '#0F1511'
  }).setOrigin(0.5);
  text.setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
  container.add(text);

  // Invisible input zone (ALWAYS active, independent of hover state)
  const zone = scene.add.zone(0, 0, widthPx, heightPx).setOrigin(0.5);
  zone.setInteractive({ useHandCursor: true });
  container.add(zone);

  // Visual hover/press only (doesn't gate clicks)
  const hoverCfg = (uiMotion as any)?.micro?.hoverPop ?? { scale: 1.04, duration: 120 };
  zone.on('pointerover', () => scene.tweens.add({
    targets: container,
    scale: hoverCfg.scale,
    duration: numberish(hoverCfg.duration),
    ease: 'Sine.Out'
  }));
  zone.on('pointerout', () => scene.tweens.add({
    targets: container,
    scale: 1,
    duration: 100,
    ease: 'Sine.Out'
  }));

  const pressCfg = (uiMotion as any)?.micro?.press ?? { scale: 0.98, duration: 80 };
  const activate = () => onClick();

  // Trigger on down AND up to catch fast mouse flicks
  zone.on('pointerdown', () => {
    scene.tweens.add({
      targets: container,
      scale: pressCfg.scale,
      duration: numberish(pressCfg.duration),
      ease: 'Sine.Out',
      yoyo: true
    });
    activate();
  });
  zone.on('pointerup', () => activate());

  // keyboard handler hooks into container via 'button:activate'
  container.on('button:activate', activate);

  return { container, zone };
}

function colorFromToken(token: any, theme: any): number | undefined {
  if (!token) return undefined;
  const hex = typeof token === 'string' && token in (theme?.palette ?? {})
    ? theme.palette[token]
    : token;
  if (typeof hex !== 'string') return undefined;

  // Support #RRGGBB or #RRGGBBAA; strip alpha if provided so we can enforce opacity=1
  const clean = hex.length === 9 ? hex.substring(0, 7) : hex;
  return Phaser.Display.Color.HexStringToColor(clean).color;
}

function numberish(v: any): number {
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

