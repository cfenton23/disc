import Phaser from "phaser";

type HoleOverlayData = { holeNumber: number; par: number; strokes: number; finalHole?: boolean; };

/** Centered card with result; SPACE or ✕ to continue. */
export class HoleResultOverlay {
  private scene: Phaser.Scene;
  private root!: Phaser.GameObjects.Container;
  private onContinue!: () => void;
  private visible = false;

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  init(depth: number, onContinue: () => void) {
    this.onContinue = onContinue;
    const w = this.scene.scale.width, h = this.scene.scale.height;
    const cx = w / 2, cy = h / 2;

    const dim = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.45).setOrigin(0);
    const panel = this.scene.add.rectangle(cx, cy, 480, 240, 0x1b2a17, 0.95).setStrokeStyle(3, 0xffffff, 0.6);
    const title = this.scene.add.text(cx, cy - 70, "", { fontFamily: "Arial, sans-serif", fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);
    const line1 = this.scene.add.text(cx, cy - 10, "", { fontFamily: "Arial, sans-serif", fontSize: "20px", color: "#e6ffe6" }).setOrigin(0.5);
    const line2 = this.scene.add.text(cx, cy + 24, "Press SPACE to continue", { fontFamily: "Arial, sans-serif", fontSize: "16px", color: "#ffffff" }).setOrigin(0.5);

    const close = this.scene.add.text(cx + 480/2 - 20, cy - 240/2 + 10, "✕", { fontFamily: "Arial, sans-serif", fontSize: "18px", color: "#ffffff" })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on("pointerup", () => { if (this.visible) this.onContinue(); });

    this.root = this.scene.add.container(0, 0, [dim, panel, title, line1, line2, close]).setDepth(depth);
    this.root.setVisible(false);
    (this.root as any)._title = title;
    (this.root as any)._line1 = line1;
    (this.root as any)._final = false;
  }

  show(data: HoleOverlayData) {
    const title: Phaser.GameObjects.Text = (this.root as any)._title;
    const line1: Phaser.GameObjects.Text = (this.root as any)._line1;
    const diff = data.strokes - (data.par || 3);
    const sign = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
    title.setText(data.finalHole ? "Round Complete" : `Hole ${data.holeNumber} Complete`);
    line1.setText(`Par ${data.par} • Strokes ${data.strokes} • ${sign}`);
    (this.root as any)._final = !!data.finalHole;
    this.root.setVisible(true);
    this.visible = true;
  }

  hide() { this.root.setVisible(false); this.visible = false; }
  isVisible() { return this.visible; }
  destroy() { this.root?.destroy(true); }
}

