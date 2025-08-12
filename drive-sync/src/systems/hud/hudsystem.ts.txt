/**
 * HUDSystem
 * Minimal, legible HUD with hole/par/distance and key hints.
 * Depth should remain >= 100 so it sits above play layers.
 */

import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';

type CourseHole = {
  par?: number;
  lengthFt?: number | string;
  length?: number | string;
  tee?: { x: number; y: number } | [number, number];
  pin?: { x: number; y: number } | [number, number];
};

type Course = { name?: string; id?: string; holes: CourseHole[] };

type InitData = {
  course: Course;
  holeIndex: number;
  depth: number;
  uiCourse: any;
};

export class HUDSystem {
  private scene: Phaser.Scene;
  private bus: EventBus;
  private course!: Course;
  private holeIndex!: number;

  private container!: Phaser.GameObjects.Container;
  private holeText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, bus: EventBus) {
    this.scene = scene;
    this.bus = bus;
  }

  init(data: InitData) {
    this.course = data.course;
    this.holeIndex = data.holeIndex;

    this.container = this.scene.add.container(24, 20).setDepth(data.depth);

    const font = { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '24px', color: '#ffffff' };
    const sub  = { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '18px', color: '#d0d7de' };

    this.holeText = this.scene.add.text(0, 0, '', font).setOrigin(0, 0);
    this.infoText = this.scene.add.text(0, 30, '', sub).setOrigin(0, 0);

    this.holeText.setShadow(1, 1, '#000', 3, true, true);
    this.infoText.setShadow(1, 1, '#000', 3, true, true);

    this.container.add([this.holeText, this.infoText]);

    this.refresh();
  }

  setHole(index: number) {
    this.holeIndex = index;
    this.refresh();
  }

  update(_deltaMs: number) {}

  destroy() {
    this.container?.destroy(true);
  }

  // --- internal ---

  private refresh() {
    const hole = this.safeHole();
    const par = typeof hole.par === 'number' ? hole.par : 3;

    const courseName = this.course?.name || this.course?.id || 'Course';
    const holeNo = this.holeIndex + 1;

    const dist = this.resolveDistanceFt(hole);
    const distText = dist ? `Distance: ${dist} ft  â€¢  ` : '';

    this.holeText.setText(`${courseName} â€” Hole ${holeNo} (Par ${par})`);
    this.infoText.setText(`${distText}SPACE = Next Hole  â€¢  ESC = Menu`);
  }

  private safeHole(): CourseHole {
    const holes = this.course?.holes ?? [];
    return holes[this.holeIndex] ?? { par: 3, lengthFt: 320, tee: [160, 160], pin: [1000, 520] };
  }

  private resolveDistanceFt(hole: CourseHole): number | null {
    const len = (hole.lengthFt ?? hole.length) as number | string | undefined;
    if (typeof len === 'number') return Math.round(len);
    if (typeof len === 'string') {
      const n = Number(len.replace(/[^\d.]/g, ''));
      if (!Number.isNaN(n)) return Math.round(n);
    }
    const tee = this.pt(hole.tee);
    const pin = this.pt(hole.pin);
    if (tee && pin) {
      const px = Phaser.Math.Distance.Between(tee.x, tee.y, pin.x, pin.y);
      return Math.round(px * 0.6);
    }
    return null;
  }

  private pt(p: any): { x:number; y:number } | null {
    if (!p) return null;
    if (Array.isArray(p) && p.length >= 2) return { x: Number(p[0]) || 0, y: Number(p[1]) || 0 };
    if (typeof p === 'object' && p.x != null && p.y != null) return { x: Number(p.x) || 0, y: Number(p.y) || 0 };
    return null;
  }
}

