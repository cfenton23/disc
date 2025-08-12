import Phaser from "phaser";
import { EventBus } from "../core/EventBus";

type CourseHole = {
  par?: number; lengthFt?: number|string;
  tee?: {x:number;y:number}|[number,number];
  pin?: {x:number;y:number}|[number,number];
  elevation?: string; fairwayWidth?: any; hazards?: string[];
};
type Course = { id?:string; name?:string; holes: CourseHole[] };

type InitData = {
  course: Course; holeIndex: number; uiCourse: any; tuning: any; discs: any;
  depths: { play:number; ui:number };
};

export class ThrowSystem {
  private __pbBG?: Phaser.GameObjects.Rectangle;
  private __pbFG?: Phaser.GameObjects.Rectangle;

  private map01(v:number,a:number,b:number){ return Phaser.Math.Clamp((v-a)/(b-a),0,1); }
  private lerp(a:number,b:number,t:number){ return a + (b-a)*t; }

  // world vs UI layering (UI must sit above trees/fairway/disc)
  private playDepth:number = 200;
  private uiDepth:number   = 2000;

  private scene: Phaser.Scene;
  private bus: EventBus;

  private course!: Course;
  private holeIndex!: number;
  private uiCourse!: any;
  private tuning!: any;
  private discs!: any;

  // keys
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyEsc?: Phaser.Input.Keyboard.Key;
  private key1?: Phaser.Input.Keyboard.Key;
  private key2?: Phaser.Input.Keyboard.Key;
  private key3?: Phaser.Input.Keyboard.Key;

  // meter
  private meterActive = false;
  private meterVal = 0;                 // 0..1
  private meterSpeed = 0.55;            // %/s
  private overchargeHoldSec = 1.5;
  private overchargeT = 0;
  private overchargeActive = false;

  // aim
  private aimDeg = -15;                 // 0=right, 90=down
  private aimSpeedDegPerSec = 90;
  private aimMaxDeg = 179;              // allow near-360 rotation without wrap bugs

  // flight + visuals
  private flightTween?: Phaser.Tweens.Tween;
  private disc?: Phaser.GameObjects.Ellipse;
  private discShadow?: Phaser.GameObjects.Ellipse;
  private aimLine?: Phaser.GameObjects.Graphics;  // visible aim indicator

  // geometry
  private teeIso!: Phaser.Math.Vector2;
  private pinIso!: Phaser.Math.Vector2;
  private lieIso!: Phaser.Math.Vector2;
  private segLenPx = 120;

  // disc
  private slot: 1|2|3 = 1;

  // dev
  private clickTargetEnabled = true;

  constructor(scene: Phaser.Scene, bus: EventBus) {
    try { this.scene.events.on("update", this.__uiTick, this); } catch(e) {}

    this.scene = scene;
    this.bus = bus;
  }

  init(data: InitData) {
    this.course    = data.course;
    this.holeIndex = data.holeIndex;
    this.uiCourse  = data.uiCourse || {};
    this.tuning    = data.tuning   || {};
    this.discs     = data.discs    || {};

    // allow JSON to tweak
    this.overchargeHoldSec   = this.tuning?.power?.overchargeHoldSec ?? this.overchargeHoldSec;
    this.aimSpeedDegPerSec   = this.tuning?.aim?.speedDegPerSec      ?? this.aimSpeedDegPerSec;
    this.segLenPx            = this.tuning?.flight?.segLenPx         ?? this.segLenPx;
    this.playDepth           = data.depths?.play ?? this.playDepth;
    this.uiDepth             = data.depths?.ui   ?? this.uiDepth;

    // hole geometry
    const h = this.safeHole();
    this.teeIso = this.v(h.tee ?? [160,160]);
    this.pinIso = this.v(h.pin ?? [1000,520]);
    this.lieIso = this.teeIso.clone();

    // visuals
    this.buildDisc(this.playDepth);
    if (!this.aimLine) {
      this.aimLine = this.scene.add.graphics()
        .setDepth(this.uiDepth - 1)
        .setVisible(true)
        .setScrollFactor(0);
    }

    // input
    const KB = Phaser.Input.Keyboard.KeyCodes;
    this.keyA     = this.scene.input.keyboard?.addKey(KB.A);
    this.keyD     = this.scene.input.keyboard?.addKey(KB.D);
    this.keyF     = this.scene.input.keyboard?.addKey(KB.F);
    this.keySpace = this.scene.input.keyboard?.addKey(KB.SPACE);
    this.keyEsc   = this.scene.input.keyboard?.addKey(KB.ESC);
    this.key1     = this.scene.input.keyboard?.addKey(KB.ONE);
    this.key2     = this.scene.input.keyboard?.addKey(KB.TWO);
    this.key3     = this.scene.input.keyboard?.addKey(KB.THREE);

    // SPACE down → arm meter
    this.keySpace?.on("down", () => {
      if (this.flightTween) return;
      if (this.meterActive) return;
      this.meterActive = true;
      this.meterVal = 0;
      this.overchargeT = 0;
      this.overchargeActive = false;
      this.aimLine?.setVisible(true);
      this.bus.emit("THROW_POWER_STARTED", {});
    });

    // SPACE up → commit throw
    this.keySpace?.on("up", () => {
      if (!this.meterActive || this.flightTween) return;
      const v = Phaser.Math.Clamp(this.meterVal, 0, 1);
      this.meterActive = false;
      this.overchargeT = 0;
      this.overchargeActive = false;
      this.bus.emit("THROW_POWER_COMMITTED", { power01: v });
      this.performThrow(v);
      this.meterVal = 0;
    });

    // ESC → cancel meter
    this.keyEsc?.on("down", () => {
      if (!this.meterActive || this.flightTween) return;
      this.cancelMeter();
    });

    // DEV click: report from-lie distance anywhere on map
    this.scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.clickTargetEnabled) return;
      const t = new Phaser.Math.Vector2(p.worldX, p.worldY);
      const distPx = Phaser.Math.Distance.Between(this.lieIso.x, this.lieIso.y, t.x, t.y);
      this.bus.emit("THROW_AIM_CHANGED", { angleDeg: this.aimDeg, fromLieFeet: this.pxToFeet(distPx) });
    });
  }

  destroy() {
    this.stopFlightTween();
    this.keyA?.removeAllListeners(); this.keyD?.removeAllListeners();
    this.keyF?.removeAllListeners(); this.keySpace?.removeAllListeners();
    this.keyEsc?.removeAllListeners(); this.key1?.removeAllListeners();
    this.key2?.removeAllListeners(); this.key3?.removeAllListeners();
    this.disc?.destroy(); this.discShadow?.destroy(); this.aimLine?.destroy();
  }

  setHole(index: number) {
    this.holeIndex = index;
    const h = this.safeHole();
    this.teeIso = this.v(h.tee ?? [160,160]);
    this.pinIso = this.v(h.pin ?? [1000,520]);
    this.lieIso = this.teeIso.clone();
    this.placeDisc(this.lieIso);
  }

  setSlot(slot: 1|2|3) { this.slot = slot; }

  update(deltaMs: number) {
    const dt = deltaMs / 1000;

    // aim rotation (full sweep; keep within ±aimMaxDeg for sanity)
    let changed = false;
    if (this.keyA?.isDown) { this.aimDeg -= this.aimSpeedDegPerSec * dt; changed = true; }
    if (this.keyD?.isDown) { this.aimDeg += this.aimSpeedDegPerSec * dt; changed = true; }
    if (changed) {
      this.aimDeg = Phaser.Math.Wrap(this.aimDeg, -180, 180); // 360 sweep
      this.bus.emit("THROW_AIM_CHANGED", { angleDeg: this.aimDeg });
    }

    // disc slot hotkeys
    if (this.key1 && Phaser.Input.Keyboard.JustDown(this.key1)) this.setSlot(1);
    if (this.key2 && Phaser.Input.Keyboard.JustDown(this.key2)) this.setSlot(2);
    if (this.key3 && Phaser.Input.Keyboard.JustDown(this.key3)) this.setSlot(3);

    // meter
    if (this.meterActive) {
      this.meterVal += this.meterSpeed * dt;
      if (this.meterVal >= 1) {
        this.meterVal = 1;
        this.overchargeT += dt;
        this.overchargeActive = this.overchargeT >= this.overchargeHoldSec;
      }
    } else { this.meterVal = 0; 
      
    }

    // draw aim line (hide while flying)
    this.drawAimLine(!this.flightTween);
  }

  // ---------- HUD helpers ----------
  getRemainingFeet(): number {
    const dPx = Phaser.Math.Distance.Between(this.lieIso.x, this.lieIso.y, this.pinIso.x, this.pinIso.y);
    return Math.max(0, this.pxToFeet(dPx));
  }
  getMeter01(): number { return this.meterVal; }
  isOvercharging(): boolean { return this.overchargeActive; }

  // ShotHud expects both:
  estimateCarryFeet(v01: number): number {
    const p = Number.isFinite(v01 as any) ? Phaser.Math.Clamp(v01, 0, 1) : 0;
    const px = Number(this.computeCarryPx(p, false)) || 0;
    return Math.max(0, this.pxToFeet(px * 0.6));   // conservative readout
  }
  getActiveDisc(): any {
    const d = this.getDisc();
    const fallback = (this.slot === 1 ? "driver" : this.slot === 2 ? "mid" : "putter");
    const s = (typeof (d as any).slot === "string" ? (d as any).slot : fallback);
    return { ...d, slot: s };
  }

  // ---------- Throw core ----------
  private cancelMeter() {
    this.meterActive = false;
    this.meterVal = 0;
    this.overchargeT = 0;
    this.overchargeActive = false;
    this.aimLine?.setVisible(true);
    this.bus.emit("THROW_POWER_CANCELLED", {});
  }

  private performThrow(power01: number) {
    const carryPx = this.computeCarryPx(power01, true);
    const rad = Phaser.Math.DegToRad(this.aimDeg);
    const dir = new Phaser.Math.Vector2(Math.cos(rad), Math.sin(rad)).normalize();
    const target = new Phaser.Math.Vector2(
      this.lieIso.x + dir.x * carryPx,
      this.lieIso.y + dir.y * carryPx
    );

    this.stopFlightTween();
    this.aimLine?.setVisible(false);

    const timeMs = 450 + 350 * power01; // brisk then glide
    this.flightTween = this.scene.tweens.add({
      targets: [this.disc, this.discShadow],
      x: (o:any)=> (o===this.disc ? target.x : target.x + 6),
      y: (o:any)=> (o===this.disc ? target.y : target.y + 6),
      duration: timeMs,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.lieIso = target.clone();
        this.stopFlightTween();
        this.aimLine?.setVisible(true);
        this.bus.emit("SHOT_END", { lie: this.lieIso.clone() });
      }
    });
  }

  private stopFlightTween() { if (this.flightTween) this.flightTween.remove(); this.flightTween=undefined; }

  // ---------- Geometry / visuals ----------
  private buildDisc(depth: number) {
    this.discShadow = this.scene.add.ellipse(0,0,12,6,0x000000,0.25).setDepth(depth-1);
    this.disc = this.scene.add.ellipse(0,0,14,8,0xff3d2e,1).setStrokeStyle(2, 0x000000, 0.6).setDepth(depth);
    this.placeDisc(this.teeIso ?? new Phaser.Math.Vector2(160,160));
  }

  private placeDisc(p: Phaser.Math.Vector2) {
    this.disc?.setPosition(p.x, p.y);
    this.discShadow?.setPosition(p.x+6, p.y+6);
  }

  private drawAimLine(visible: boolean) {
    if (!this.aimLine) return;
    if (!visible) { this.aimLine.setVisible(false); return; }

    const len = 64; // px
    const ang = Phaser.Math.DegToRad(this.aimDeg || 0);
    const sx = this.lieIso.x, sy = this.lieIso.y;
    const ex = sx + Math.cos(ang) * len;
    const ey = sy + Math.sin(ang) * len;

    this.aimLine.clear();
    // outline then inner so it pops on dark trees
    this.aimLine.lineStyle(6, 0x000000, 0.9).strokeLineShape(new Phaser.Geom.Line(sx, sy, ex, ey));
    this.aimLine.lineStyle(3, 0xFFD34D, 1.0).strokeLineShape(new Phaser.Geom.Line(sx, sy, ex, ey));
    this.aimLine.setDepth(this.uiDepth - 1).setVisible(true);
  }

  // ---------- Helpers ----------
  private safeHole(): CourseHole {
    return this.course?.holes?.[this.holeIndex] ?? { par:3, lengthFt:320, tee:[160,160], pin:[1000,520], elevation:"flat" };
  }
  private v(xy: {x:number;y:number}|[number,number]): Phaser.Math.Vector2 {
    return Array.isArray(xy) ? new Phaser.Math.Vector2(xy[0], xy[1]) : new Phaser.Math.Vector2(xy.x, xy.y);
  }
  private pxToFeet(px: number): number {
    const fpp = Number(this.uiCourse?.feetPerPx);
    const feet = Number.isFinite(fpp) && fpp > 0 ? Math.round(px / fpp) : Math.round(px * 0.6);
    return feet;
  }

  private computeCarryPx(power01: number, includeDisc: boolean): number {
  const p0 = Number(power01);
  const p = Phaser.Math.Clamp(Number.isFinite(p0) ? p0 : 0, 0, 1);
  const t:any = (this as any).tuning?.flight ?? {};
  const d:any = (this as any).getActiveDisc?.() ?? { speed:7, glide:4, slot:"driver" };
  const exp = Number((this as any).tuning?.power?.powerCurveExp ?? 1.15);
  const slot = String(d.slot ?? "driver").toLowerCase();
  const baseMap:any = t.baseCarryFeetAtFull ?? { driver:350, mid:240, putter:60 };
  let ft = Number(baseMap[slot] ?? 300) * Math.pow(p, exp);
  if (includeDisc) {
    const speed01 = this.map01(d.speed ?? 7, 1, 14);
    const carryMult = this.lerp(t.speedToCarryMult?.min ?? 0.90, t.speedToCarryMult?.max ?? 1.10, speed01);
    const glide01 = this.map01(d.glide ?? 4, 1, 7);
    const dragMult = this.lerp(t.glideToDragMult?.min ?? 1.05, t.glideToDragMult?.max ?? 0.92, glide01);
    ft = ft * carryMult * (1 / dragMult);
  }
  if ((this as any).overchargeActive) {
    const oc = Number((this as any).tuning?.power?.overchargeBonus ?? 1.05);
    ft *= oc;
  }
  const fpp = Number((this as any).uiCourse?.feetPerPx ?? 0.60);
  const px = ft / (fpp > 0 ? fpp : 0.60);
  return Number.isFinite(px) ? px : 0;
}

  private getDisc(): any {
    const list = (this.discs?.discs ?? []) as any[];
    const id = this.slot === 1 ? "dev_driver" : this.slot === 2 ? "dev_mid" : "dev_putt";
    return list.find(d => d.id === id) || { id, name:id, speed:7, glide:4, turn:-1, fade:2, slot:"driver" };
  }
public estimateCarryFeet(meter01?: number){
  try{
    const t:any = (this as any).tuning?.flight ?? {};
    const d:any = this.getActiveDisc?.() ?? { speed:5, glide:4, slot:"mid" };
    const m = Phaser.Math.Clamp(meter01 ?? this.getMeter01?.() ?? 0, 0, 1);

    const speed01 = this.map01(d.speed ?? 5, 1, 14);
    const carryMult = this.lerp(t.speedToCarryMult?.min ?? 0.7, t.speedToCarryMult?.max ?? 1.3, speed01);

    const baseBySlot = t.baseCarryFeetAtFull ?? { driver:350, mid:260, putter:190 };
    const slot = (d.slot ?? "mid").toLowerCase();
    const slotBase = baseBySlot[slot] ?? 260;

    const glide01 = this.map01(d.glide ?? 4, 1, 7);
    const dragMult = this.lerp(t.glideToDragMult?.min ?? 1.2, t.glideToDragMult?.max ?? 0.85, glide01);

    return (slotBase * carryMult * m) * (1 / dragMult);
  } catch(e){ return 0; }
}
  private __initPowerBar(){
    const ui = (this as any).uiDepth ?? 2000;
    if (!this.__pbBG) this.__pbBG = this.scene.add.rectangle(24,78,220,12,0x000000,0.35).setOrigin(0,0).setDepth(ui);
    if (!this.__pbFG) this.__pbFG = this.scene.add.rectangle(26,80,0,8,0x6bff6b,1).setOrigin(0,0).setDepth(ui);
  }
  private __uiTick(){
    try{
      this.__initPowerBar();
      const m = Phaser.Math.Clamp(this.getMeter01?.() ?? 0, 0, 1);
      if (this.__pbFG){
        this.__pbFG.width = 216 * m;
        this.__pbFG.alpha = m > 0 ? 1 : 0.5;
        this.__pbFG.fillColor = this.isOvercharging?.() ? 0xfff06b : 0x6bff6b;
      }
    } catch(e){}
  }
}



