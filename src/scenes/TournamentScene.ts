// src/scenes/TournamentScene.ts
//
// Thin controller: orchestrates systems, owns a local EventBus, wires inputs,
// and emits lifecycle events. No heavy logic here.
//
// Step scope (0.0.4):
// - Reads courses.json (fallback safe course if missing/bad)
// - Loads ui_course.json, tuning_throw.json, discs.json
// - Creates CourseRenderSystem (2.5D), BagSystem (1/2/3), ThrowSystem, ShotHud
// - ESC → back to Main Menu
// - SPACE → HUD normal (start/commit) OR advance hole if overlay is up
// - Emits: TOURNAMENT_START, HOLE_START, SHOT_END, HOLE_END, ROUND_END
//
// Visual tuning lives in /assets/json/ui_course.json
// Throw tuning lives in /assets/json/tuning_throw.json
//

import Phaser from 'phaser';
import { EventBus } from '../systems/core/EventBus';
import { CourseRenderSystem } from '../systems/course/CourseRenderSystem';
import { ThrowSystem } from '../systems/throw/ThrowSystem';
import { ShotHud } from '../systems/hud/ShotHud';
import { BagSystem } from '../systems/bag/BagSystem';

type CourseHole = {
  par?: number;
  lengthFt?: number | string; length?: number | string;
  tee?: { x:number; y:number } | [number, number];
  pin?: { x:number; y:number } | [number, number];
  elevation?: 'uphill'|'downhill'|'flat'|string;
  fairwayWidth?: number|'narrow'|'medium'|'wide';
  hazards?: string[];
  controlPoints?: { x:number; y:number }[];
};
type Course = { id?: string; name?: string; holes: CourseHole[] };

const DEPTHS = {
  TERRAIN: 10,
  FAIRWAY: 14,
  MARKERS: 24,
  PLAY:    40,
  UI:     130
};

export default class TournamentScene extends Phaser.Scene {
  private bus!: EventBus;

  private course!: Course;
  private holeIndex = 0;

  private uiCourse: any = {};
  private tuning: any = {};
  private discsJson: any = {};

  private courseRender!: CourseRenderSystem;
  private bag!: BagSystem;
  private throwSys!: ThrowSystem;
  private hud!: ShotHud;

  // Overlay (hole end)
  private overlayRoot?: Phaser.GameObjects.Container;
  private overlayUp = false;

  private keyEsc?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;

  constructor() { super('TournamentScene'); }

  preload() {
    // Data (JSON-first approach)
    this.load.json('courses', 'assets/json/courses.json');                 // root
    this.load.json('ui_course', 'assets/json/ui_course.json'); // visuals
    this.load.json('tuning_throw', 'assets/json/tuning_throw.json'); // throw params
    this.load.json('discs', 'assets/json/discs.json');                     // active discs/bag

    // Tiny sprite fallback for disc if needed (optional)
    if (!this.textures.exists('disc_base')) {
      this.textures.generate('disc_base', { data: ['2222','2222','2222','2222'], pixelWidth: 4 });
    }

    // Tree sprites (menu-provided) used for forest border
    ['tree1','tree2','tree3'].forEach(k=>{
      if (!this.textures.exists(k)) this.load.image(k, `assets/ui/${k}.png`);
    });
  }

  create() {
    // Hygiene: camera reset (prevents “menu slip” bleed)
    this.cameras.main.resetFX();
    this.cameras.main.setAlpha(1);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setZoom(1);
    this.cameras.main.setRotation(0);

    // Cache JSON (with safe defaults)
    this.uiCourse = this.cache.json.get('ui_course') || {};
    this.tuning   = this.cache.json.get('tuning_throw') || {};
    this.discsJson = this.cache.json.get('discs') || {};

    const allCourses: Course[] = this.cache.json.get('courses') || [];
    this.course = Array.isArray(allCourses) && allCourses[0]
      ? allCourses[0]
      : { name: 'Demo Links', holes: [
          { par:3, lengthFt:320, tee:[160,160], pin:[1000,520], elevation:'flat', fairwayWidth:'medium', hazards:['trees_both'] },
          { par:4, lengthFt:420, tee:[160,210], pin:[1100,560], elevation:'flat', fairwayWidth:'medium', hazards:['OB_path','water_long'] }
        ]};

    // Event bus
    this.bus = new EventBus();

    // Systems
    this.courseRender = new CourseRenderSystem(this, this.bus);
    this.courseRender.init({
      course: this.course,
      holeIndex: this.holeIndex,
      uiCourse: this.uiCourse,
      depths: { terrain: DEPTHS.TERRAIN, fairway: DEPTHS.FAIRWAY, markers: DEPTHS.MARKERS, hud: DEPTHS.UI }
    });

    this.bag = new BagSystem(this, this.bus);
    this.bag.init(this.discsJson);

    this.throwSys = new ThrowSystem(this, this.bus);
    this.throwSys.init({
      course: this.course,
      holeIndex: this.holeIndex,
      uiCourse: this.uiCourse,
      tuning: this.tuning,
      discs: this.discsJson,
      depths: { play: DEPTHS.PLAY, ui: DEPTHS.UI }
    });

    this.hud = new ShotHud(this, this.throwSys);
    this.hud.init(DEPTHS.UI, this.uiCourse);

    // Inputs
    const KB = Phaser.Input.Keyboard.KeyCodes;
    this.keyEsc   = this.input.keyboard?.addKey(KB.ESC);
    this.keySpace = this.input.keyboard?.addKey(KB.SPACE);

    this.keyEsc?.on('down', () => {
      if (this.overlayUp) { this.hideOverlay(); return; }
      this.scene.start('MainMenuScene');
    });
    this.keySpace?.on('down', () => {
      if (this.overlayUp) { this.endHoleAndAdvance(); }
    });

    // Lifecycle + game events
    this.bus.emit('TOURNAMENT_START', { course: this.course });
    this.bus.on('HOLE_END', () => this.showOverlayForHole());
    this.bus.on('SHOT_END', () => {/* future: show toasts, penalties, etc. */});
  }

  update(_time: number, delta: number) {
    this.courseRender.update(delta);
    this.throwSys.update(delta);
    this.hud.update();
  }

  // ───────────────────────────────────────────── overlay / flow
  private showOverlayForHole() {
    if (this.overlayUp) return;
    this.overlayUp = true;

    const pad = 48, w = 480, h = 200;
    const cx = this.scale.width/2, cy = this.scale.height/2;

    const root = this.add.container(0,0).setDepth(DEPTHS.UI + 20);
    const dim = this.add.rectangle(0,0,this.scale.width,this.scale.height,0x000000,0.45).setOrigin(0,0);
    const panelShadow = this.add.rectangle(cx+4, cy+4, w, h, 0x000000, 0.35).setOrigin(0.5);
    const panel = this.add.rectangle(cx, cy, w, h, 0x0f2a14, 0.94).setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.2);


    const title = this.add.text(cx, cy - 56, `Hole ${this.holeIndex+1} Complete`, {
      fontFamily: 'Arial, sans-serif', fontSize: '22px',
      color: '#ffffff', stroke:'#000', strokeThickness: 3
    }).setOrigin(0.5);

    // Compute score term (rough, scene-level for now; ThrowSystem increments strokes internally)
    const hole = this.course.holes[this.holeIndex] || { par:3 };
    const par = Number(hole.par||3);
    const strokes = 1; // placeholder since we don’t yet track card; hook up to scoring soon
    const diff = strokes - par;
    const term = diff<=-3 ? 'Albatross!' : diff===-2 ? 'Eagle!' : diff===-1 ? 'Birdie!' : diff===0 ? 'Par' : diff===1 ? 'Bogey' : `+${diff}`;

    const body = this.add.text(cx, cy - 16, `Par ${par} • Strokes ${strokes}  •  ${term}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px',
      color: '#e8f5e7', stroke:'#000', strokeThickness: 2
    }).setOrigin(0.5);

    const hint = this.add.text(cx, cy + 44, 'Press SPACE to continue', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px',
      color: '#d6ead8'
    }).setOrigin(0.5).setAlpha(0.92);

    // Close button (X)
    const xBtn = this.add.text(panel.getCenter().x + w/2 - 18, panel.getCenter().y - h/2 + 10, '✕', {
      fontFamily:'Arial', fontSize:'16px', color:'#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor:true }).on('pointerdown', ()=> this.hideOverlay());

    root.add([dim,panelShadow,panel,title,body,hint,xBtn]);
    this.overlayRoot = root;
  }

  private hideOverlay() {
    this.overlayRoot?.destroy(true);
    this.overlayRoot = undefined;
    this.overlayUp = false;
  }

  private endHoleAndAdvance() {
    this.hideOverlay();
    this.holeIndex++;
    if (this.holeIndex >= (this.course?.holes?.length || 0)) {
      this.bus.emit('ROUND_END', {});
      this.scene.start('MainMenuScene');
      return;
    }

    // Advance systems
    this.courseRender.setHole(this.holeIndex);
    this.throwSys.setHole(this.holeIndex);
    this.bus.emit('HOLE_START', { holeIndex: this.holeIndex, hole: this.course.holes[this.holeIndex] });
  }
}
