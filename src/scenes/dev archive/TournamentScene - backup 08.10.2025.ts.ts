// src/scenes/TournamentScene.ts
import Phaser from 'phaser';

// Data (json files in your project root)
import discsData from '../../discs.json';
import coursesData from '../../courses.json';
import opponentsData from '../../opponents.json';

// Shared types + systems
import { DiscSpec, CourseHole } from '../types/models';
import { SeededRNG, initCourseWind, applyHoleWind, CourseWind } from '../systems/wind';
import { chooseAiDisc } from '../systems/ai';
import { drawWater, drawMinimapMissing } from '../systems/draw';
import {
  WIND_STRENGTH_BASE, MAX_NOSE_DEG, PUTTER_MAX_FT,
  PUTT_PERFECT_WINDOW, PUTT_MISS_CUTOFF, 
  DISC_SCALE_NEAR
} from '../systems/config';

// Small local style constants
const FONT = 'Arial';
const COL_TEXT = '#e8fff3';
const COL_TEXT_SUB = '#cdeacc';
const COL_FRAME = 0x3c624f;
const COL_PANEL = 0x0c1e14;
const COL_BAR_BG = 0x183325;

export default class TournamentScene extends Phaser.Scene {
  // 2.5D layers
  private layerSky!: Phaser.GameObjects.Rectangle;
  private layerSun!: Phaser.GameObjects.Container;
  private layerFar!: Phaser.GameObjects.Container;
  private layerMid!: Phaser.GameObjects.Container;
  private layerNear!: Phaser.GameObjects.Container;
  private fogOverlay!: Phaser.GameObjects.Rectangle;

  // Course / hole
  private course = (coursesData as any).courses?.find((c: any) => c.id === 'lakeview_pines_47291');
  private holeIndex = 0;
  private holeDistanceFt = 320;

  // RNG & wind
  private rng!: SeededRNG;                 // //NOTE seeded from course.seed
  private baseCourseWind!: CourseWind;     // round-level
  private holeWind!: CourseWind;           // per-hole modulated

  // Discs
  private allDiscs: DiscSpec[] = [];       // library from discs.json (fallback if empty)
  private activeDiscIdx = 0;

  // Throw state
  private discFly!: Phaser.GameObjects.Image;
  private curveValue = 0;                  // -MAX_NOSE_DEG..+MAX_NOSE_DEG
  private forehand = false;                // false=BH true=FH
  private powerValue = 0;                  // 0..1
  private powerActive = false;
  private powerDir: 1 | -1 = 1;

  // HUD & widgets
  private rootHUD!: Phaser.GameObjects.Container;
  private weatherPanel!: Phaser.GameObjects.Container;
  private leaderboard!: Phaser.GameObjects.Container;
  private leaderboardBody!: Phaser.GameObjects.Container;
  private leaderboardHeader!: Phaser.GameObjects.Text;
  private leaderboardState: 0 | 1 | 2 = 1; // 0=Hidden,1=Top5,2=Full

  private miniMap!: Phaser.GameObjects.Container;
  private holePanel!: Phaser.GameObjects.Container;
  private meterPanel!: Phaser.GameObjects.Container;
  private menuPanel!: Phaser.GameObjects.Container;
  private helpPanel!: Phaser.GameObjects.Container;

  private discSpriteHUD!: Phaser.GameObjects.Image;
  private discTooltip!: Phaser.GameObjects.Container;

  private bagButton!: Phaser.GameObjects.Container;
  private bagModal!: Phaser.GameObjects.Container;
  private bagOpen = false;

  // meters internals
  private curveBarBox!: Phaser.GameObjects.Container;
  private curveBarFill!: Phaser.GameObjects.Graphics;
  private powerTargetMarker?: Phaser.GameObjects.Rectangle;
  private showPowerTarget = false;
  private powerTargetRatio = 0;

  // debug strip
  private hudStrip?: Phaser.GameObjects.Graphics;
  private hudLabel?: Phaser.GameObjects.Text;

  constructor() { super({ key: 'TournamentScene' }); }

  preload(): void {
    // NOTE: swap these to whatever disc art you have
    this.load.image('disc1', '/assets/discs/disc1.png');
    this.load.image('disc2', '/assets/discs/disc2.png');
    this.load.image('bag_icon', '/assets/ui/bag.png');

    const hole = this.currentHole();
    const mm = hole?.minimapImage ? `/assets/${hole.minimapImage}` : '/assets/minimaps/course1.png';
    this.load.image('minimap_dynamic', mm);
  }

  create(): void {
    const { width: W, height: H } = this.scale;

    // --- Seeded RNG + round wind --------------------------------------
    const seedStr = String(this.course?.seed ?? 1); // //NOTE seed source
    this.rng = new SeededRNG(seedStr);
    this.baseCourseWind = initCourseWind(this.rng);
    this.holeWind = applyHoleWind(this.baseCourseWind, this.currentHole(), this.rng);

    // course hole distance
    this.holeDistanceFt = this.currentHole()?.lengthFt ?? 320;

    // --- Playfield -----------------------------------------------------
    this.buildPlayfield();

    // fly disc (hidden until throw)
    this.discFly = this.add.image(W * 0.22, H * 0.70, 'disc1').setDepth(200).setScale(0.8).setVisible(false);

    // --- Discs library -------------------------------------------------
    const parsed = discsData as unknown as { discs?: DiscSpec[] };
    this.allDiscs = (parsed.discs ?? []).map((d, i) => ({ ...d, image: d.image ?? (i === 0 ? 'disc1.png' : 'disc2.png') }));
    if (!this.allDiscs.length) {
      this.allDiscs = [
        { id: 'starter_mid',    name: 'Starter Midrange', slot: 'mid',    speed: 5, glide: 4, turn: 0,  fade: 1, stability: 'stable', image: 'disc1.png' },
        { id: 'starter_driver', name: 'Starter Driver',   slot: 'driver', speed: 8, glide: 5, turn: -1, fade: 2, stability: 'stable', image: 'disc2.png' },
      ];
    }

    // --- HUD root & debug strip ---------------------------------------
    this.rootHUD = this.add.container(0, 0).setDepth(10000);
    this.hudStrip = this.add.graphics().setDepth(10005).fillStyle(0xff3bb0, 0.9).fillRect(0, 0, W, 6);
    this.hudLabel = this.add.text(10, 10, 'HUD ONLINE', { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setDepth(10005);

    // --- Panels --------------------------------------------------------
    this.weatherPanel = this.buildWeatherPanel(); this.rootHUD.add(this.weatherPanel);
    this.leaderboard  = this.buildLeaderboard();  this.rootHUD.add(this.leaderboard);
    this.miniMap      = this.buildMiniMap();      this.rootHUD.add(this.miniMap);
    this.holePanel    = this.buildHolePanel();    this.rootHUD.add(this.holePanel);
    this.meterPanel   = this.buildMeterPanel();   this.rootHUD.add(this.meterPanel);
    this.menuPanel    = this.buildMenuPanel();    this.rootHUD.add(this.menuPanel);

    // Disc icon + tooltip
    this.discSpriteHUD = this.add.image(0, 0, this.keyForDiscImage(this.allDiscs[this.activeDiscIdx].image!))
      .setDisplaySize(64, 64).setOrigin(0.5).setDepth(10002);
    this.rootHUD.add(this.discSpriteHUD);
    this.discTooltip = this.buildDiscTooltip().setDepth(10003).setVisible(false).setAlpha(0);
    this.rootHUD.add(this.discTooltip);
    this.wireDiscTooltip();

    // Bag
    this.bagButton = this.buildBagButton(); this.rootHUD.add(this.bagButton);
    this.bagModal  = this.buildBagModal().setVisible(false).setAlpha(0); this.rootHUD.add(this.bagModal);

    // Leaderboard sample data + render
    this.generateLeaderboard();
    this.renderLeaderboard();

    // Input + layout
    this.initInput();
    this.layout();
    this.scale.on('resize', () => {
      this.layout();
      if (this.hudStrip) this.hudStrip.clear().fillStyle(0xff3bb0, 0.9).fillRect(0, 0, this.scale.width, 6);
    });
  }

  // --------------------- 2.5D Playfield ----------------------
  private buildPlayfield() {
    const { width: W, height: H } = this.scale;

    // sky + tint
    this.layerSky = this.add.rectangle(W / 2, H / 2, W, H, 0x7fae9a).setDepth(0);
    this.add.rectangle(W / 2, H / 2, W, H, 0x204031, 0.20).setDepth(1);

    // sun shafts
    this.layerSun = this.add.container(0, 0).setDepth(2);
    for (let i = 0; i < 5; i++) {
      const shaft = this.add.graphics({ x: W * (0.15 + i * 0.12), y: 0 });
      shaft.fillStyle(0xffffff, 0.040).fillTriangle(0, 0, 160, 0, 80, H * 0.9);
      this.layerSun.add(shaft);
    }

    // tree bands
    this.layerFar  = this.add.container(0, 0).setDepth(3);
    this.layerMid  = this.add.container(0, 0).setDepth(4);
    this.layerNear = this.add.container(0, 0).setDepth(5);
    this.drawTreeBand(this.layerFar,  0x274b3a, H * 0.15, 0.45);
    this.drawTreeBand(this.layerMid,  0x1f3b2e, H * 0.10, 0.58);
    this.drawTreeBand(this.layerNear, 0x183024, 0,        0.74);

    const sway = (t: Phaser.GameObjects.Container, amp: number, dur: number) =>
      this.tweens.add({ targets: t, x: { from: -amp, to: amp }, duration: dur, ease: 'Sine.inOut', repeat: -1, yoyo: true });
    sway(this.layerFar, 6, 9000); sway(this.layerMid, 10, 7000); sway(this.layerNear, 14, 6000);

    // hazard hint: water strip if needed
    const hz = this.currentHole()?.hazards ?? [];
    if (hz.some(h => h.startsWith('water'))) drawWater(this, H * 0.64, W);

    // foreground fog
    this.fogOverlay = this.add.rectangle(W / 2, H - 120, W, H * 0.6, 0x0e1b14, 0.18).setDepth(6);
  }

  private drawTreeBand(parent: Phaser.GameObjects.Container, color: number, yOffset: number, scaleMul: number) {
    const { width: W, height: H } = this.scale;
    const g = this.add.graphics(); g.fillStyle(color, 1);
    const baseY = H * (0.55 + yOffset / H);
    const step = 60;

    g.beginPath(); g.moveTo(0, H); g.lineTo(0, baseY);
    for (let x = 0; x <= W + step; x += step) {
      const h = Phaser.Math.Between(50, 140) * scaleMul;
      g.lineTo(x, baseY - h); g.lineTo(x + step * 0.5, baseY - h * 0.7); g.lineTo(x + step, baseY - h);
    }
    g.lineTo(W, H); g.closePath(); g.fillPath();

    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(0, W); const h = Phaser.Math.Between(120, 260) * scaleMul;
      g.fillRect(x, baseY - h, 8 * scaleMul, h);
    }
    parent.add(g);
  }

  // ------------------------ HUD Panels -----------------------
  private buildWeatherPanel() {
    const w = 260, h = 64, c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, h, 12)
     .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, h, 12);
    const dir = Math.round(this.holeWind.dirDeg);
    const spd = (this.holeWind.strength * 10 * WIND_STRENGTH_BASE).toFixed(1); // NOTE cheap mph-like display
    const t1 = this.add.text(14, 10, `Wind: ${dir}Â°  ${spd} mph`, { fontFamily: FONT, fontSize: '16px', color: COL_TEXT });
    const t2 = this.add.text(14, 34, 'Temp: 72Â°F â€¢ Humidity: 40%', { fontFamily: FONT, fontSize: '14px', color: COL_TEXT_SUB });
    c.add([g, t1, t2]); return c;
  }

  private buildLeaderboard() {
    const w = 380, headerH = 52;
    const c = this.add.container(0, 0);

    const bg = this.add.graphics();
    bg.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, headerH + 5, 16)
      .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, headerH + 5, 16);
    c.add(bg);

    this.leaderboardHeader = this.add.text(w/2, headerH/2, 'LEADERBOARD (TAB)', {
      fontFamily: FONT, fontSize: '22px', color: COL_TEXT
    }).setOrigin(0.5);
    c.add(this.leaderboardHeader);

    const btnExpand = this.add.text(w - 56, 12, 'â–¼', { fontFamily: FONT, fontSize: '22px', color: COL_TEXT })
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleLeaderboardExpand());
    const btnClose = this.add.text(w - 20, 12, 'âœ•', { fontFamily: FONT, fontSize: '22px', color: COL_TEXT })
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleLeaderboardHide());
    c.add([btnExpand, btnClose]);

    this.leaderboardBody = this.add.container(0, headerH);
    c.add(this.leaderboardBody);

    (c as any).bg = bg; (c as any).btnExpand = btnExpand;
    return c;
  }

  private buildMiniMap() {
    const w = 260, h = 300, c = this.add.container(0, 0);
    const frame = this.add.graphics();
    frame.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, h, 14)
         .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, h, 14);

    if (this.textures.exists('minimap_dynamic')) {
      c.add(this.add.image(w/2, h/2, 'minimap_dynamic').setDisplaySize(w - 16, h - 16));
    } else {
      c.add(drawMinimapMissing(this, 0, 0, w, h));
    }
    c.add(frame);
    return c;
  }

  private buildHolePanel() {
    const w = 260, h = 64, hole = this.currentHole(), c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, h, 12)
     .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, h, 12);
    const title = this.add.text(16, 10, `HOLE ${hole?.n ?? 1}`, { fontFamily: FONT, fontSize: '22px', color: COL_TEXT });
    const par   = this.add.text(w - 16, 10, `PAR ${hole?.par ?? 3}`, { fontFamily: FONT, fontSize: '22px', color: COL_TEXT_SUB }).setOrigin(1, 0);
    const sub   = this.add.text(16, 38, `Distance: ${this.holeDistanceFt} ft`, { fontFamily: FONT, fontSize: '14px', color: '#9fd5b6' });
    c.add([g, title, par, sub]); return c;
  }

  private buildMeterPanel() {
    const w = 900, h = 110, pad = 16, c = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, h, 18)
      .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, h, 18);
    c.add(bg);

    const title = this.add.text(pad, pad + 2, 'NOSE ANGLE', { fontFamily: FONT, fontSize: '16px', color: COL_TEXT, fontStyle: 'bold' });
    const handChip = this.add.text(pad + 140, pad + 2, '(BH)', { fontFamily: FONT, fontSize: '16px', color: COL_TEXT });
    c.add([title, handChip]);

    const curve = this.buildCurveBar(w * 0.55, h - pad*2 - 30, -MAX_NOSE_DEG, MAX_NOSE_DEG, () => this.curveValue);
    this.curveBarBox = curve.container; this.curveBarFill = curve.fill;
    c.add(curve.container); curve.container.setPosition(pad, 46);

    const pLabel = this.add.text(w * 0.60, pad + 2, 'POWER', { fontFamily: FONT, fontSize: '16px', color: COL_TEXT });
    c.add(pLabel);

    const power = this.buildPowerBar(w * 0.35, h - pad*2 - 30, 0, 1, () => this.powerValue);
    c.add(power.container); power.container.setPosition(w * 0.60, 46);
    this.powerTargetMarker = power.targetMarker;

    this.events.on('update-bars', () => {
      curve.update(); power.update(); handChip.setText(this.forehand ? '(FH)' : '(BH)');
    });
    return c;
  }

  private buildMenuPanel() {
    const w = 220, h = 110, pad = 12, c = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, h, 14)
      .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, h, 14);
    c.add(bg);

    const btn = (label: string, y: number, onClick: () => void) => {
      const b = this.add.container(w/2, y);
      const box = this.add.graphics();
      box.fillStyle(COL_BAR_BG, 1).fillRoundedRect(-w/2 + pad, -16, w - pad*2, 32, 10)
        .lineStyle(1, COL_FRAME).strokeRoundedRect(-w/2 + pad, -16, w - pad*2, 32, 10);
      const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '18px', color: COL_TEXT }).setOrigin(0.5);
      const hit = this.add.rectangle(0, 0, w - pad*2, 32, 0x000000, 0).setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
      b.add([box, t, hit]); return b;
    };
    c.add([ btn('Options', 30, () => this.showHelp()), btn('Save', 70, () => console.log('Save (WIP)')) ]);
    return c;
  }

  private buildHelpPanel() {
    const { width: W } = this.scale;
    const w = 520, h = 200, c = this.add.container((W - w)/2, 100);
    const bg = this.add.graphics();
    bg.fillStyle(COL_PANEL, 0.98).fillRoundedRect(0, 0, w, h, 14)
      .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, h, 14);
    const title = this.add.text(16, 12, 'Controls', { fontFamily: FONT, fontSize: '20px', color: COL_TEXT });
    const body = this.add.text(16, 44,
      'A/D: Nose Angle (Hyzer/Anhyzer)\nF: Forehand / Backhand\nSpace: Hold to build Power; release to throw\nTAB: Hide/Show Leaderboard\nB: Open Bag',
      { fontFamily: FONT, fontSize: '16px', color: COL_TEXT_SUB });
    const close = this.add.text(w - 14, 10, 'âœ•', { fontFamily: FONT, fontSize: '22px', color: COL_TEXT })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.hideHelp());
    c.add([bg, title, body, close]); return c;
  }

  private buildBagButton() {
    const w = 80, h = 80, c = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, h, 14)
      .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, h, 14);
    c.add(bg);

    if (this.textures.exists('bag_icon')) {
      c.add(this.add.image(w/2, h/2, 'bag_icon').setDisplaySize(48, 48));
    } else {
      const ico = this.add.graphics({ x: w/2, y: h/2 });
      ico.fillStyle(0x7fe6b5, 1).fillCircle(0, 0, 20).lineStyle(3, 0x2b5241).strokeCircle(0, 0, 20);
      c.add(ico);
    }
    const hit = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleBag());
    c.add(hit);
    return c;
  }

  private buildBagModal() {
    const { width: W, height: H } = this.scale;
    const panelW = Math.min(860, W - 80), panelH = Math.min(520, H - 80);
    const c = this.add.container(0, 0);
    const dim = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.35).setInteractive().on('pointerdown', () => this.toggleBag(false));
    c.add(dim);

    const g = this.add.graphics();
    g.fillStyle(COL_PANEL, 0.98).fillRoundedRect(0, 0, panelW, panelH, 18).lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, panelW, panelH, 18);
    const panel = this.add.container((W - panelW)/2, (H - panelH)/2, [g]); c.add(panel);

    const title = this.add.text(panelW/2, 20, 'Disc Bag', { fontFamily: FONT, fontSize: '24px', color: COL_TEXT }).setOrigin(0.5, 0);
    const close = this.add.text(panelW - 16, 12, 'âœ•', { fontFamily: FONT, fontSize: '24px', color: COL_TEXT })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleBag(false));
    panel.add([title, close]);

    const gridPad = 24, cellW = 160, cellH = 140, gap = 16;
    const cols = Math.floor((panelW - gridPad * 2 + gap) / (cellW + gap));
    const startX = gridPad + (panelW - gridPad * 2 - cols * (cellW + gap) + gap) / 2;
    let x = startX, y = 64;

    this.allDiscs.forEach((d, idx) => {
      const cell = this.add.container(x, y);
      const box = this.add.graphics();
      box.fillStyle(COL_BAR_BG, 1).fillRoundedRect(0, 0, cellW, cellH, 12).lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, cellW, cellH, 12);
      const imgKey = this.keyForDiscImage(d.image || 'disc1.png');
      const discImg = this.add.image(cellW/2, 56, imgKey).setDisplaySize(64, 64);
      const name = this.add.text(cellW/2, cellH - 28, d.name, { fontFamily: FONT, fontSize: '16px', color: COL_TEXT }).setOrigin(0.5);
      const hit = this.add.rectangle(cellW/2, cellH/2, cellW, cellH, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this.activeDiscIdx = idx; this.updateActiveDiscUI(); this.toggleBag(false); });
      cell.add([box, discImg, name, hit]); panel.add(cell);
      x += cellW + gap; if ((idx + 1) % cols === 0) { x = startX; y += cellH + gap; }
    });
    return c;
  }

  private buildDiscTooltip() {
    const w = 240, h = 140, c = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(COL_PANEL, 0.98).fillRoundedRect(0, 0, w, h, 12).lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, h, 12);
    const name = this.add.text(12, 10, '', { fontFamily: FONT, fontSize: '18px', color: COL_TEXT });
    const stats = this.add.text(12, 40, '', { fontFamily: FONT, fontSize: '16px', color: COL_TEXT_SUB });
    c.add([bg, name, stats]); c.setData('name', name); c.setData('stats', stats); return c;
  }
  private wireDiscTooltip() {
    const update = () => {
      const d = this.allDiscs[this.activeDiscIdx];
      (this.discTooltip.getData('name') as Phaser.GameObjects.Text).setText(d.name);
      (this.discTooltip.getData('stats') as Phaser.GameObjects.Text).setText(
        `Slot: ${d.slot}\nSpeed: ${d.speed}  Glide: ${d.glide}\nTurn: ${d.turn}  Fade: ${d.fade}${d.stability ? `\nStability: ${d.stability}` : ''}`
      );
    };
    this.discSpriteHUD.setInteractive({ useHandCursor: true });
    this.discSpriteHUD
      .on('pointerover', () => { update(); this.discTooltip.setVisible(true); this.tweens.add({ targets: this.discTooltip, alpha: 1, duration: 120 }); })
      .on('pointerout',  () => { this.tweens.add({ targets: this.discTooltip, alpha: 0, duration: 120, onComplete: () => this.discTooltip.setVisible(false) }); });
  }

  // -------------------------- Meters ---------------------------
  private buildCurveBar(width: number, height: number, min: number, max: number, getter: () => number) {
    const container = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(COL_BAR_BG, 1).fillRoundedRect(0, 0, width, height, 12)
     .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, width, height, 12);
    container.add(g);

    const zeroX = width * (0 - min) / (max - min);
    container.add(this.add.rectangle(zeroX, height/2, 2, height - 8, 0x335d4a).setOrigin(0.5));

    const fill = this.add.graphics(); container.add(fill);
    let pulse: Phaser.Tweens.Tween | null = null;

    const update = () => {
      const v = Phaser.Math.Clamp(getter(), min, max);
      const norm = (v - min) / (max - min);
      const w = Math.max(0, width * norm);

      const sev = Math.abs(v) / max;
      let color = 0x74e39d; if (sev >= 0.25) color = 0xe0c24d; if (sev >= 0.5) color = 0xe88a3a; if (sev >= 0.75) color = 0xd24f4f;

      fill.clear(); fill.fillStyle(color, 1).fillRoundedRect(2, 2, Math.max(0, w - 4), height - 4, 10);

      if (sev >= 0.75 && !pulse) {
        pulse = this.tweens.add({
          targets: container, scaleX: { from: 1.0, to: 1.02 }, duration: 60, yoyo: true, repeat: 1,
          onComplete: () => { container.setScale(1, 1); pulse = null; }
        });
      }
    };
    return { container, update, fill };
  }

  private buildPowerBar(width: number, height: number, min: number, max: number, getter: () => number) {
    const container = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(COL_BAR_BG, 1).fillRoundedRect(0, 0, width, height, 12)
     .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, width, height, 12);
    container.add(g);

    for (let i = 1; i < 10; i++) container.add(this.add.rectangle((width * i) / 10, height - 6, 2, 8, 0x335d4a).setOrigin(0.5, 1));

    const fill = this.add.graphics(); container.add(fill);
    const marker = this.add.rectangle(0, height/2, 3, height - 6, 0x7fe6b5).setOrigin(0.5).setAlpha(0); container.add(marker);

    const update = () => {
      const v = Phaser.Math.Clamp(getter(), min, max);
      const norm = (v - min) / (max - min);
      const w = Math.max(0, width * norm);
      fill.clear();
      fill.fillStyle(0xd8c07a, 1).fillRoundedRect(2, 2, Math.max(0, w - 4), height - 4, 10);

      if (this.showPowerTarget) { marker.setAlpha(1); marker.x = 2 + (width - 4) * Phaser.Math.Clamp(this.powerTargetRatio, 0, 1); }
      else marker.setAlpha(0);
    };
    return { container, update, targetMarker: marker };
  }

  // --------------------------- Input ---------------------------
  private initInput() {
    const kb = this.input.keyboard!;
    kb.on('keydown-A', () => { this.curveValue = Phaser.Math.Clamp(this.curveValue - 2.5, -MAX_NOSE_DEG, MAX_NOSE_DEG); });
    kb.on('keydown-D', () => { this.curveValue = Phaser.Math.Clamp(this.curveValue + 2.5, -MAX_NOSE_DEG, MAX_NOSE_DEG); });
    kb.on('keydown-F', () => { this.forehand = !this.forehand; });
    kb.on('keydown-TAB', (ev: KeyboardEvent) => { ev.preventDefault(); this.toggleLeaderboardHide(); });
    kb.on('keydown-B', () => this.toggleBag());

    kb.on('keydown-SPACE', () => {
      if (!this.powerActive) {
        this.powerActive = true; this.powerDir = 1;
        this.powerTargetRatio = this.computePowerTargetRatio(); // //NOTE target hint vs hole distance
        this.showPowerTarget = true;
      }
    });
    kb.on('keyup-SPACE', () => {
      if (!this.powerActive) return;
      this.powerActive = false;
      this.executeThrow();
      this.showPowerTarget = false;
    });

    kb.on('keydown-H', () => {
      if (!this.hudStrip || !this.hudLabel) return;
      this.hudStrip.visible = !this.hudStrip.visible;
      this.hudLabel.visible = this.hudStrip.visible;
    });
    kb.on('keydown-ESC', () => this.scene.start('MainMenuScene'));
  }

  // ------------------------ Throw logic ------------------------
  private executeThrow() {
    const signedCurve = this.forehand ? -this.curveValue : this.curveValue;
    const active = this.allDiscs[this.activeDiscIdx];
    const key = this.keyForDiscImage(active.image || 'disc1.png');
    this.discFly.setTexture(key).setVisible(true);

    const { width: W, height: H } = this.scale;
    const tee = this.currentHole()?.teePlacement ?? { x: 0.22, y: 0.70 }; // //NOTE teePlacement override support
    const startX = W * tee.x, startY = H * tee.y;

    const pwr = this.powerValue;
    const rangeX = Phaser.Math.Linear(W * 0.30, W * 0.72, pwr);
    const peakY  = H * (0.42 - 0.10 * (pwr));
    const curveX = Phaser.Math.Linear(0, W * 0.18, signedCurve / MAX_NOSE_DEG);

    const path = new Phaser.Curves.Path(startX, startY);
    path.cubicBezierTo(
      startX + (rangeX * 0.35) + curveX * 0.2, peakY,
      startX + (rangeX * 0.70) + curveX * 0.8, peakY + 60,
      startX + rangeX + curveX, H * 0.68
    );

    const cam = this.cameras.main;
    this.tweens.add({ targets: cam, scrollX: { from: 0, to: 40 }, duration: 500, yoyo: true, ease: 'Quad.easeInOut' });
    cam.shake(120, 0.0025);

    const tmp = { t: 0 };
    this.tweens.add({
      targets: tmp, t: 1, duration: Phaser.Math.Linear(600, 1300, pwr), ease: 'Cubic.easeOut',
      onUpdate: () => {
        const p = path.getPoint(tmp.t);
        const tan = path.getTangent(tmp.t);
        const angle = Phaser.Math.RadToDeg(Math.atan2(tan.y, tan.x));
        this.discFly.setPosition(p.x, p.y).setRotation(Phaser.Math.DegToRad(angle - 90));

        // Perspective: shrink on rise, slight grow on descent
        const s = DISC_SCALE_NEAR * Math.sin(Math.min(tmp.t, 1) * Math.PI);
        this.discFly.setScale(s);
      },
      onComplete: () => { this.discFly.setVisible(false); }
    });

    // reset power
    this.tweens.addCounter({ from: this.powerValue, to: 0, duration: 220, onUpdate: t => { this.powerValue = t.getValue() as number; } });
  }

  private computeDiscMaxCarryFt(d: DiscSpec) {
    const stab = (d.turn <= -1 ? 8 : 0) + (d.fade >= 2 ? -10 : 0);
    return Math.max(150, d.speed * 35 + d.glide * 12 + stab); // //NOTE naive carry model
  }
  private computePowerTargetRatio() {
    const d = this.allDiscs[this.activeDiscIdx]; const maxFt = this.computeDiscMaxCarryFt(d);
    return Phaser.Math.Clamp(this.holeDistanceFt / maxFt, 0.1, 1);
  }

  // ---------------------- Leaderboard demo ---------------------
  private generateLeaderboard() {
    const groupKey = 'Amateur_Week_Seed47291';
    const ops = (opponentsData as any)?.generatedGroups?.[groupKey] ?? [
      { name: 'S Smith', rating: 900 }, { name: 'J Jones', rating: 910 }, { name: 'â€“ Johnson', rating: 880 },
    ];

    const hole = this.currentHole() ?? { par: 3, n: 1, lengthFt: 280 };
    const rows = (ops as { name: string; rating: number }[]).map(o => {
      const mean = (920 - o.rating) / 80;
      const sd = 1.2;
      // Box-Muller
      let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      const score = Math.round(Phaser.Math.Clamp(mean + z * sd, -6, 9));
      return { rank: 0, name: o.name, score, hole: hole.n };
    });
    rows.sort((a, b) => a.score - b.score); rows.forEach((r, i) => (r.rank = i + 1));
    (this as any)._lbRows = rows;
  }

  private renderLeaderboard() {
    const w = 380, rowH = 34, headerH = 52;
    const body = this.leaderboardBody;
    body.removeAll(true);

    const rows: any[] = (this as any)._lbRows ?? [];
    const maxRows = this.leaderboardState === 1 ? Math.min(5, rows.length) :
                    this.leaderboardState === 2 ? rows.length : 0;

    for (let i = 0; i < maxRows; i++) {
      const r = rows[i];
      const y = i * rowH + 8;
      body.add(this.add.text(12, y, `#${r.rank}`, { fontFamily: FONT, fontSize: '18px', color: COL_TEXT_SUB }));
      body.add(this.add.text(72, y, r.name, { fontFamily: FONT, fontSize: '18px', color: COL_TEXT }));
      body.add(this.add.text(w - 16, y, `${r.score === 0 ? 'E' : (r.score > 0 ? '+' + r.score : String(r.score))}  (H${r.hole})`,
        { fontFamily: FONT, fontSize: '18px', color: COL_TEXT }).setOrigin(1, 0));
    }

    const bg = (this.leaderboard as any).bg as Phaser.GameObjects.Graphics;
    const targetH = headerH + (this.leaderboardState === 0 ? 0 : (maxRows * rowH + 10));
    bg.clear();
    bg.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, Math.max(headerH + 5, targetH), 16)
      .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, Math.max(headerH + 5, targetH), 16);

    const expBtn = (this.leaderboard as any).btnExpand as Phaser.GameObjects.Text;
    expBtn.setText(this.leaderboardState === 2 ? 'â–²' : 'â–¼');
  }

  private toggleLeaderboardExpand() {
    if (this.leaderboardState === 0) this.leaderboardState = 1;
    else if (this.leaderboardState === 1) this.leaderboardState = 2;
    else this.leaderboardState = 1;
    this.renderLeaderboard();
  }
  private toggleLeaderboardHide() {
    this.leaderboardState = this.leaderboardState === 0 ? 1 : 0;
    this.renderLeaderboard();
  }

  // ------------------------ Utility & layout -------------------
  private keyForDiscImage(filename: string) { return filename.replace(/\.(png|jpg|jpeg|webp)$/i, ''); }
  private currentHole(): CourseHole | undefined { return this.course?.holes?.[this.holeIndex]; }
  private updateActiveDiscUI() {
    const d = this.allDiscs[this.activeDiscIdx];
    const key = this.keyForDiscImage(d.image || 'disc1.png');
    if (this.discSpriteHUD) this.discSpriteHUD.setTexture(key);
  }

  private showHelp() {
    if (!this.helpPanel) this.helpPanel = this.buildHelpPanel();
    this.rootHUD.add(this.helpPanel);
    this.helpPanel.setVisible(true);
    this.tweens.add({ targets: this.helpPanel, alpha: { from: 0, to: 1 }, duration: 120 });
  }
  private hideHelp() {
    if (!this.helpPanel) return;
    this.tweens.add({ targets: this.helpPanel, alpha: { from: 1, to: 0 }, duration: 120,
      onComplete: () => this.helpPanel.setVisible(false)
    });
  }

  private toggleBag(force?: boolean) {
    const open = force !== undefined ? force : !this.bagOpen;
    this.bagOpen = open;
    if (open) {
      this.bagModal.setVisible(true);
      this.tweens.add({ targets: this.bagModal, alpha: { from: 0, to: 1 }, duration: 120 });
    } else {
      this.tweens.add({ targets: this.bagModal, alpha: { from: 1, to: 0 }, duration: 120,
        onComplete: () => this.bagModal.setVisible(false) });
    }
  }

  private layout() {
    const { width: W, height: H } = this.scale;

    // Weather
    this.weatherPanel.setPosition(20, 16);
    // Leaderboard
    this.leaderboard.setPosition(W - 20 - 380, 16);
    // Hole + minimap (left stack)
    this.holePanel.setPosition(20, H - 20 - 64 - 300 - 10);
    this.miniMap.setPosition(20, H - 20 - 300);
    // Meters (bottom center)
    this.meterPanel.setPosition((W - 900) / 2, H - 20 - 110);
    // Menu (bottom right)
    this.menuPanel.setPosition(W - 20 - 220, H - 20 - 110);

    // Disc icon + bag + tooltip
    const discX = (W - 900) / 2 - 48;
    const discY = H - 20 - 110 + 55;
    this.discSpriteHUD.setPosition(discX, discY);
    this.bagButton.setPosition(discX, discY + 84);
    this.discTooltip.setPosition(discX - 120, discY - 20); // pinned bottom-left of disc

    // Fog resize
    this.fogOverlay.setPosition(W / 2, H - 120).setSize(W, H * 0.6);
  }

  update(_: number, delta: number): void {
    if (this.powerActive) {
      const speed = 0.0016 * delta;  // //NOTE power charge rate
      this.powerValue += speed * this.powerDir;
      if (this.powerValue >= 1) { this.powerValue = 1; this.powerDir = -1; }
      if (this.powerValue <= 0) { this.powerValue = 0; this.powerDir = 1; }
    }
    this.events.emit('update-bars');
  }
}

