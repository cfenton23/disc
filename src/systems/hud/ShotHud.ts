import Phaser from "phaser";
import { ThrowSystem } from "../throw/ThrowSystem";

export class ShotHud {
  private powerBorder?: Phaser.GameObjects.Rectangle;
  private powerShadow?: Phaser.GameObjects.Rectangle;
  private powerGloss?: Phaser.GameObjects.Rectangle;

  private powerBg?: Phaser.GameObjects.Rectangle;
  private powerFg?: Phaser.GameObjects.Rectangle;

  private scene: Phaser.Scene;
  private throwSys: ThrowSystem;
  private text!: Phaser.GameObjects.Text;
  private discText!: Phaser.GameObjects.Text;
  private depth = 130;
  private yTop = 64;
  private pbW = 300;
  private pbH = 24;
  private pbYOffset = -14;

  constructor(scene: Phaser.Scene, throwSys: ThrowSystem) {
    this.scene = scene;
    this.throwSys = throwSys;
  }

  init(depth: number, uiCourse?: any) {
    this.depth = depth;
    this.yTop = uiCourse?.hud?.textY ?? 64;
    this.__initPowerBar(); // pb

    this.text = this.scene.add.text(16, this.yTop, "", {
      fontFamily: "Arial, sans-serif", fontSize: "16px",
      color: "#ffffff", stroke: "#000000", strokeThickness: 3
    }).setDepth(this.depth).setScrollFactor(0);

    this.discText = this.scene.add.text(16, this.yTop + 22, "", {
      fontFamily: "Arial, sans-serif", fontSize: "14px",
      color: "#e4ffe4", stroke: "#000000", strokeThickness: 2
    }).setDepth(this.depth).setScrollFactor(0);
  }

  update() {
    const remaining = Math.max(0, Math.round(this.throwSys.getRemainingFeet()));
    const est = Math.round(this.throwSys.estimateCarryFeet());
    
    
    /*pb*/ try {
      // Recompute geometry each frame so it stays centered on resize
      const BAR_W = this.pbW, BAR_H = this.pbH;
      const ui = (this as any).depth ?? 2000;
      const yTop = (this as any).yTop ? (this as any).yTop : 64;
      const y = Math.max(32, yTop + this.pbYOffset);
      const cx = this.scene.scale.width * 0.5;
      const x = Math.round(cx - BAR_W / 2);

      // Ensure created
      this.__initPowerBar();

      // Position everything (keeps center)
      if (this.powerBorder) this.powerBorder.setPosition(x-2, y-2).setDepth(ui);
      if (this.powerBg)     this.powerBg.setPosition(x, y).setDisplaySize(BAR_W, BAR_H).setDepth(ui+1);
      if (this.powerShadow) this.powerShadow.setPosition(x+2, y+BAR_H-2).setDisplaySize(BAR_W-4, 3).setDepth(ui+3);
      if (this.powerGloss)  this.powerGloss.setPosition(x+2, y+2).setDisplaySize(BAR_W-4, Math.max(2, Math.floor((BAR_H-4)/3))).setDepth(ui+3);

      // Meter + colors
      const m = Phaser.Math.Clamp(this.throwSys.getMeter01?.() ?? 0, 0, 1);
      let color = 0xffffff;                    // 0–25% white
      if (m >= 1.0) color = 0xef4444;          // 100% red
      else if (m >= 0.90) color = 0xf59e0b;    // 90–99% orange
      else if (m >= 0.50) color = 0x22c55e;    // 50–89% green
      else if (m >= 0.26) color = 0xfcd34d;    // 26–49% yellow

      const innerW = Math.max(0, (BAR_W-4) * m);
      if (this.powerFg){
        this.powerFg.setPosition(x+2, y+2);
        this.powerFg.width = Math.max(0, innerW);
        this.powerFg.height = BAR_H-4;
        this.powerFg.fillColor = color;
        this.powerFg.alpha = m > 0 ? 1 : 0.5;
        if (this.throwSys.isOvercharging?.()) {
          // quick pulse: widen gloss and shadow subtly when overcharging
          this.powerGloss?.setAlpha(0.18);
          this.powerShadow?.setAlpha(0.38);
        } else {
          this.powerGloss?.setAlpha(0.12);
          this.powerShadow?.setAlpha(0.30);
        }
      }
    } catch(e) {}
this.text.setText(`Remaining ${remaining} ft  •  Est. carry ${est} ft`);

    const d = this.throwSys.getActiveDisc();
    if (d) this.discText.setText(`${(d.slot||"disc").toUpperCase()} • S ${d.speed ?? "-"} G ${d.glide ?? "-"} T ${d.turn ?? "-"} F ${d.fade ?? "-"}`);
  }

  destroy() { this.text?.destroy(); this.discText?.destroy(); }
    private __initPowerBar(){
    // Geometry
    const BAR_W = this.pbW;  // thicker/longer
    const BAR_H = this.pbH;
    const ui = (this as any).depth ?? 2000;

    // Top-center position (keeps bar under the HUD text)
    const yTop = (this as any).yTop ? (this as any).yTop : 64;
    const y = Math.max(32, yTop + this.pbYOffset);
    const cx = this.scene.scale.width * 0.5;
    const x = Math.round(cx - BAR_W / 2);

    // Border (bold black)
    if (!this.powerBorder) this.powerBorder = this.scene.add.rectangle(x-2, y-2, BAR_W+4, BAR_H+4, 0x000000, 1)
      .setOrigin(0,0).setDepth(ui);

    // Background (dark fill)
    if (!this.powerBg) this.powerBg = this.scene.add.rectangle(x, y, BAR_W, BAR_H, 0x0a0a0a, 0.85)
      .setOrigin(0,0).setDepth(ui+1);

    // Foreground (actual meter)
    if (!this.powerFg) this.powerFg = this.scene.add.rectangle(x+2, y+2, 0, BAR_H-4, 0x6bff6b, 1)
      .setOrigin(0,0).setDepth(ui+2);

    // Soft shadow (bottom)
    if (!this.powerShadow) this.powerShadow = this.scene.add.rectangle(x+2, y+BAR_H-2, BAR_W-4, 3, 0x000000, 0.30)
      .setOrigin(0,1).setDepth(ui+3);

    // Gloss (top)
    if (!this.powerGloss) this.powerGloss = this.scene.add.rectangle(x+2, y+2, BAR_W-4, Math.max(2, Math.floor((BAR_H-4)/3)), 0xffffff, 0.12)
      .setOrigin(0,0).setDepth(ui+3);
  }
}




