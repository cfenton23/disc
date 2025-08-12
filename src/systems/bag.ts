// src/systems/bag.ts
import Phaser from 'phaser';
import { DiscSpec } from './types';

/** Light UI palette (duplicated here to avoid cross-file coupling). */
const FONT = 'Arial';
const COL_TEXT = 0xe8fff3;
const COL_TEXT_SUB = 0xcdeacc;
const COL_FRAME = 0x3c624f;
const COL_PANEL = 0x0c1e14;
const COL_BG = 0x183325;

export type BagUI = {
  icon: Phaser.GameObjects.Image;
  tooltip: Phaser.GameObjects.Container;
  modal: Phaser.GameObjects.Container;
  open: () => void;
  close: () => void;
  setDisc: (d: DiscSpec) => void;
};

/**
 * Creates the Bag UI (icon + tooltip + modal grid).
 * - `discs` are the player's active bag (already hydrated with textureKey).
 * - `onPick` is called when the player selects a disc from the modal.
 */
export function createBag(
  scene: Phaser.Scene,
  discs: DiscSpec[],
  onPick?: (d: DiscSpec) => void
): BagUI {
  const W = scene.scale.width;
  const H = scene.scale.height;

  // ---------- HUD Icon ----------
  const iconSize = 72;
  const icon = scene.add
    .image(0, 0, (discs[0]?.textureKey ?? 'disc1'))
    .setDisplaySize(iconSize, iconSize)
    .setDepth(10005)
    .setInteractive({ useHandCursor: true });

  // Position: scene should place this container; default bottom-left margin
  icon.setPosition(28 + iconSize / 2, H - 120);

  // ---------- Tooltip (anchored bottom-left so it never clips) ----------
  const tooltip = scene.add
    .container(20, H - 20)
    .setDepth(10003)
    .setVisible(false)
    .setAlpha(0);

  const tipW = 240;
  const tipH = 140;

  const tipBg = scene.add.graphics();
  tipBg
    .fillStyle(COL_PANEL, 0.98)
    .fillRoundedRect(0, -tipH, tipW, tipH, 12)
    .lineStyle(2, COL_FRAME)
    .strokeRoundedRect(0, -tipH, tipW, tipH, 12);

  const tipName = scene.add.text(12, -tipH + 10, '', {
    fontFamily: FONT,
    fontSize: '18px',
    color: '#' + COL_TEXT.toString(16),
  });
  const tipStats = scene.add.text(12, -tipH + 40, '', {
    fontFamily: FONT,
    fontSize: '16px',
    color: '#' + COL_TEXT_SUB.toString(16),
  });

  tooltip.add([tipBg, tipName, tipStats]);

  // ---------- Modal (grid) ----------
  const modal = scene.add.container(W / 2, H / 2).setDepth(10010).setVisible(false).setAlpha(0);

  const dim = scene.add
    .rectangle(-W / 2, -H / 2, W, H, 0x000000, 0.55)
    .setOrigin(0, 0)
    .setInteractive();

  // Panel
  const panelW = Math.min(760, W - 100);
  const panelH = Math.min(460, H - 120);
  const panelX = -panelW / 2;
  const panelY = -panelH / 2;

  const panel = scene.add.graphics();
  panel
    .fillStyle(COL_PANEL, 0.98)
    .fillRoundedRect(panelX, panelY, panelW, panelH, 16)
    .lineStyle(2, COL_FRAME)
    .strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

  // Title
  const title = scene.add.text(panelX + 16, panelY + 10, 'Bag', {
    fontFamily: FONT,
    fontSize: '20px',
    color: '#' + COL_TEXT.toString(16),
  });

  // Close button (X)
  const closeBtn = scene.add
    .text(panelX + panelW - 28, panelY + 10, 'âœ•', {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#' + COL_TEXT.toString(16),
    })
    .setInteractive({ useHandCursor: true });

  // Grid container
  const grid = scene.add.container(panelX + 16, panelY + 46);

  modal.add([dim, panel, title, closeBtn, grid]);

  // Build grid
  const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(discs.length))));
  const gap = 16;
  const cellW = Math.floor((panelW - 32 - gap * (cols - 1)) / cols);
  const cellH = 120;

  let x = 0;
  let y = 0;

  const makeCell = (d: DiscSpec, index: number) => {
    const cell = scene.add.container(x, y);

    const box = scene.add.graphics();
    box
      .fillStyle(COL_BG, 0.98)
      .fillRoundedRect(0, 0, cellW, cellH, 12)
      .lineStyle(2, COL_FRAME)
      .strokeRoundedRect(0, 0, cellW, cellH, 12);

    const imgKey = d.textureKey || 'disc1';
    const discImg = scene.add.image(50, cellH / 2, imgKey).setDisplaySize(70, 70);

    const name = scene.add.text(96, 14, d.name, {
      fontFamily: FONT,
      fontSize: '18px',
      color: '#' + COL_TEXT.toString(16),
    });

    const stats = scene.add.text(
      96,
      44,
      `Slot: ${d.slot}\nSpeed: ${d.speed}  Glide: ${d.glide}\nTurn: ${d.turn}  Fade: ${d.fade}`,
      {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#' + COL_TEXT_SUB.toString(16),
        lineSpacing: 2,
      }
    );

    const hit = scene.add
      .rectangle(cellW / 2, cellH / 2, cellW, cellH, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      setDisc(d);
      if (onPick) onPick(d);
      close();
    });

    cell.add([box, discImg, name, stats, hit]);
    grid.add(cell);

    x += cellW + gap;
    if ((index + 1) % cols === 0) {
      x = 0;
      y += cellH + gap;
    }
  };

  discs.forEach((d, i) => makeCell(d, i));

  // ---------- API & behaviors ----------
  function open() {
    modal.setVisible(true);
    scene.tweens.add({ targets: modal, alpha: 1, duration: 120 });
  }

  function close() {
    scene.tweens.add({
      targets: modal,
      alpha: 0,
      duration: 120,
      onComplete: () => modal.setVisible(false),
    });
  }

  function setDisc(d: DiscSpec) {
    const key = d.textureKey || 'disc1'; // fallback during dev
    icon.setTexture(key);

    // Tooltip content
    tipName.setText(d.name);
    tipStats.setText(`Slot: ${d.slot}\nSpeed: ${d.speed}  Glide: ${d.glide}\nTurn: ${d.turn}  Fade: ${d.fade}`);
  }

  // Hover tooltip behavior
  icon.on('pointerover', () => {
    tooltip.setVisible(true);
    scene.tweens.add({ targets: tooltip, alpha: 1, duration: 120 });
  });
  icon.on('pointerout', () => {
    scene.tweens.add({
      targets: tooltip,
      alpha: 0,
      duration: 120,
      onComplete: () => tooltip.setVisible(false),
    });
  });

  // Open/close interactions
  icon.on('pointerdown', open);
  dim.on('pointerdown', close);
  closeBtn.on('pointerdown', close);

  scene.input.keyboard?.on('keydown-B', () => (modal.visible ? close() : open()));
  scene.input.keyboard?.on('keydown-ESC', () => modal.visible && close());

  // Initialize tooltip with first disc if present
  if (discs[0]) setDisc(discs[0]);

  return { icon, tooltip, modal, open, close, setDisc };
}

