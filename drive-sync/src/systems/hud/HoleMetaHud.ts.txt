import Phaser from 'phaser';

export type HoleMetaCfg = { hud?: { holeMeta?: string } };

export default class HoleMetaHud {
  private text?: Phaser.GameObjects.Text;
  constructor(private scene: Phaser.Scene) {}

  private resolveTemplate(cfg: HoleMetaCfg | any): string {
    try {
      if (cfg && cfg.hud && typeof cfg.hud.holeMeta === 'string') return cfg.hud.holeMeta;
    } catch (e) { }
    return 'Hole {n} · Par {par} · {lengthFt} ft';
  }

  private selectHole(course: any, holeIdx: any): any {
    try {
      const holes = Array.isArray(course?.holes) ? course.holes : [];
      if (typeof holeIdx === 'number' && holeIdx >= 0 && holeIdx < holes.length) return holes[holeIdx];
      const targetN = (typeof holeIdx === 'number') ? (holeIdx + 1) : 1;
      const byN = holes.find((h:any)=> (h && typeof h.n === 'number') && h.n === targetN);
      return byN || holes[0] || null;
    } catch { return null }
  }

  private formatLine(h: any, cfg: HoleMetaCfg | any): string {
    const tpl = this.resolveTemplate(cfg);
    const n   = (h && h.n   != null) ? String(h.n)        : '?';
    const par = (h && h.par != null) ? String(h.par)      : '?';
    const len = (h && h.lengthFt != null) ? String(h.lengthFt) : '?';
    let out = tpl;
    out = out.replace('{n}', n);
    out = out.replace('{par}', par);
    out = out.replace('{lengthFt}', len);
    return out;
  }

  updateFrom(sceneLike: any): void {
    try {
      const course = (sceneLike && sceneLike.course) ? sceneLike.course : null;
      const holeIdx = (sceneLike && sceneLike.holeIdx != null) ? sceneLike.holeIdx : 0;
      const cfg = this.scene.cache.json.get('ui_course') || {};
      const hole = this.selectHole(course, holeIdx);
      const line = this.formatLine(hole, cfg);
      if (this.text) { this.text.setText(line); return; }
      this.text = this.scene.add.text(8, 22, line, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
        .setScrollFactor(0).setDepth(9999).setAlpha(0.9);
    } catch (e) { /* no-op */ }
  }
}

