import Phaser from 'phaser';
import { COL_PANEL, COL_FRAME, COL_TEXT, COL_TEXT_SUB, FONT } from './config';

export type LbState = 'hidden'|'top'|'full';
export interface LbRow { rank:number; name:string; score:number; hole:number; isHuman?:boolean; }

export function createLeaderboard(scene: Phaser.Scene) {
  const w = 380, headerH = 52;
  const root = scene.add.container(0, 0);
  const bg = scene.add.graphics();
  root.add(bg);

  const header = scene.add.text(w/2, headerH/2, 'LEADERBOARD (TAB)', {
    fontFamily: FONT, fontSize: '22px', color: COL_TEXT
  }).setOrigin(0.5);
  root.add(header);

  const btnExpand = scene.add.text(w - 56, 12, 'â–¼', { fontFamily: FONT, fontSize: '22px', color: COL_TEXT })
    .setInteractive({ useHandCursor:true });
  const btnClose  = scene.add.text(w - 20, 12, 'âœ•', { fontFamily: FONT, fontSize: '22px', color: COL_TEXT })
    .setInteractive({ useHandCursor:true });
  root.add([btnExpand, btnClose]);

  const body = scene.add.container(0, headerH);
  root.add(body);

  let state: LbState = 'top';
  let rows: LbRow[] = [];

  function render() {
    const rowH = 34;
    body.removeAll(true);
    const max = state === 'hidden' ? 0 : state === 'top' ? Math.min(5, rows.length) : rows.length;

    for (let i = 0; i < max; i++) {
      const r = rows[i];
      const y = i * rowH + 8;
      const scoreTxt = r.score === 0 ? 'E' : (r.score > 0 ? `+${r.score}` : String(r.score));
      const color = r.isHuman ? '#9fe0ff' : COL_TEXT;
      body.add(scene.add.text(12, y, `#${r.rank}`, { fontFamily: FONT, fontSize: '18px', color: COL_TEXT_SUB }));
      body.add(scene.add.text(72, y, r.name, { fontFamily: FONT, fontSize: '18px', color }));
      body.add(scene.add.text(w - 16, y, `${scoreTxt}  (H${r.hole})`,
        { fontFamily: FONT, fontSize: '18px', color: COL_TEXT }).setOrigin(1, 0));
    }

    const targetH = headerH + (state === 'hidden' ? 0 : (max * rowH + 10));
    bg.clear();
    bg.fillStyle(COL_PANEL, 0.96).fillRoundedRect(0, 0, w, Math.max(headerH + 5, targetH), 16)
      .lineStyle(2, COL_FRAME).strokeRoundedRect(0, 0, w, Math.max(headerH + 5, targetH), 16);

    btnExpand.setText(state === 'full' ? 'â–²' : 'â–¼');
  }

  btnExpand.on('pointerdown', () => { state = state === 'top' ? 'full' : 'top'; render(); });
  btnClose.on('pointerdown', () => { state = state === 'hidden' ? 'top' : 'hidden'; render(); });

  function setRows(r: LbRow[]) { rows = r; render(); }
  function setState(s: LbState) { state = s; render(); }

  render();
  return { root, setRows, setState, get state(){return state;} };
}

