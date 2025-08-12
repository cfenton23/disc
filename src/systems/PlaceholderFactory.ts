// src/systems/PlaceholderFactory.ts
// Generates crisp dev placeholders at runtime so missing art doesn't block the demo.

import Phaser from 'phaser';

export class PlaceholderFactory {
  /**
   * Ensure that a placeholder texture exists in the scene's texture manager.
   * If it doesn't exist yet, draw it on an HTMLCanvasElement and add it.
   */
  static ensure(scene: Phaser.Scene, key: string, width: number, height: number, label: string = 'MISSING') {
    if (scene.textures.exists(key)) return;

    // Create a canvas texture
    const canvas = scene.textures.createCanvas(key, width, height);
    const ctx = canvas.getContext();

    // Background
    ctx.fillStyle = '#444'; // dark gray dev bg
    ctx.fillRect(0, 0, width, height);

    // Diagonal stripes for "placeholder" look
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 4;
    for (let i = -height; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }

    // Label text
    ctx.fillStyle = '#ff5555'; // bright red for visibility
    ctx.font = `${Math.floor(height / 6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = label.split('\n');
    const lineHeight = height / (lines.length + 1);

    lines.forEach((line, idx) => {
      ctx.fillText(line, width / 2, (idx + 1) * lineHeight);
    });

    // Commit canvas changes to the Phaser texture
    canvas.refresh();
  }
}

export default PlaceholderFactory;

