import Phaser from 'phaser';
import { MAX_NOSE_DEG, POWER_CHARGE_RATE, COL_BAR_BG, COL_FRAME, COL_TEXT, FONT } from './config';

export interface Meters {
  root: Phaser.GameObjects.Container;
  getNose(): number; setNose(v:number): void;
  getPower(): number; setPower(v:number): void;
  setPuttTarget(ratio:number|undefined): void;
  setForehand(isFH:boolean): void;
  attachInput(): void;
}

export function createMeters(scene: Phaser.Scene): Meters {
  const w = 900, h = 110, pad = 16;
  const root = scene.add.container(0,0);

  const bg = scene.add.graphics();
  bg.fillStyle(0x0c1e14,0.96).fillRoundedRect(0,0,w,h,18).lineStyle(2,COL_FRAME).strokeRoundedRect(0,0,w,h,18);
  root.add(bg);

  const title = scene.add.text(pad, pad -2, 'NOSE ANGLE', {fontFamily:FONT,fontSize:'16px',color:COL_TEXT,fontStyle:'bold'});
  const hand = scene.add.text(pad+140, pad -2, '(BH)', {fontFamily:FONT,fontSize:'16px',color:COL_TEXT});
  root.add([title,hand]);

  // Curve bar
  const curveW = w*0.55, curveH = h - pad*2 - 30;
  const curveBox = scene.add.graphics();
  curveBox.fillStyle(COL_BAR_BG,1).fillRoundedRect(0,0,curveW,curveH,12).lineStyle(2,COL_FRAME).strokeRoundedRect(0,0,curveW,curveH,12);
  const zeroX = curveW * (0 + MAX_NOSE_DEG) / (MAX_NOSE_DEG*2);
  root.add(curveBox);
  root.add(scene.add.rectangle(zeroX, curveH/2, 2, curveH-8, 0x335d4a).setOrigin(0.5));
  const tickY = 46 + 6; // 6px lower than top of box

  const curveFill = scene.add.graphics(); root.add(curveFill);

  // Power bar
  const pLabel = scene.add.text(w*0.60, pad+2, 'POWER', {fontFamily:FONT,fontSize:'16px',color:COL_TEXT});
  root.add(pLabel);
  const powerW = w*0.35, powerH = curveH;
  const powerBox = scene.add.graphics();
  powerBox.fillStyle(COL_BAR_BG,1).fillRoundedRect(0,0,powerW,powerH,12).lineStyle(2,COL_FRAME).strokeRoundedRect(0,0,powerW,powerH,12);
  root.add(powerBox);
  for (let i=1;i<10;i++) root.add(scene.add.rectangle((powerW*i)/10, powerH-6, 2, 8, 0x335d4a).setOrigin(0.5,1));
  const powerFill = scene.add.graphics(); root.add(powerFill);
  const targetMarker = scene.add.rectangle(0,powerH/2,3,powerH-6,0x7fe6b5).setOrigin(0.5).setAlpha(0); root.add(targetMarker);

  curveBox.setPosition(pad,46);
  curveFill.setPosition(pad,46);
  powerBox.setPosition(w*0.60,46);
  powerFill.setPosition(w*0.60,46);
  targetMarker.setPosition(w*0.60,46 + powerH/2);

  let nose = 0, power = 0, powerDir:1|-1 = 1, powerActive = false, isFH=false;
  let puttTarget: number | undefined;

  // Left & Right extreme shakes (direction-aware)
  let shaking = false;
  function shake(dir: 'left'|'right') {
    if (shaking) return; shaking = true;
    const dx = dir === 'left' ? -8 : 8;
    scene.tweens.add({
      targets: curveBox, x: curveBox.x + dx, duration: 60, yoyo: true, repeat: 1,
      onComplete: ()=>{ curveBox.x -= dx; shaking=false; }
    });
  }

  function updateCurve() {
    const min=-MAX_NOSE_DEG, max= MAX_NOSE_DEG;
    const v = Phaser.Math.Clamp(nose, min, max);
    const norm = (v - min) / (max - min);
    const w = Math.max(0, curveW * norm);
    const sev = Math.abs(v) / max;
    let color = 0x74e39d; if (sev>=0.25) color=0xe0c24d; if (sev>=0.5) color=0xe88a3a; if (sev>=0.75) color=0xd24f4f;
    curveFill.clear().fillStyle(color,1).fillRoundedRect(2,2, Math.max(0,w-4), curveH-4, 10);

    if (sev>=0.75) shake(v<0 ? 'left' : 'right');
  }

  function updatePower() {
    const v = Phaser.Math.Clamp(power, 0, 1);
    const w = Math.max(0, powerW * v);
    powerFill.clear().fillStyle(0xd8c07a,1).fillRoundedRect(2,2, Math.max(0,w-4), powerH-4, 10);
    if (puttTarget !== undefined) {
      targetMarker.setAlpha(1);
      targetMarker.x = w*0 + (w - w) + (powerW - 4) * Phaser.Math.Clamp(puttTarget,0,1) + powerBox.x + 2;
    } else {
      targetMarker.setAlpha(0);
    }
  }

  // Power animator (we'll self-update by subscribing to scene.events.on('update'))
  scene.events.on('update', (_t, dt:number)=>{
    if (powerActive) {
      power += POWER_CHARGE_RATE * dt * powerDir;
      if (power >= 1) { power = 1; powerDir = -1; }
      if (power <= 0) { power = 0; powerDir = 1; }
      updatePower();
    }
  });

  function attachInput() {
    const kb = scene.input.keyboard!;
    kb.on('keydown-A', ()=>{ setNose(nose - 2.5); });
    kb.on('keydown-D', ()=>{ setNose(nose + 2.5); });
    kb.on('keydown-F', ()=>{ isFH = !isFH; hand.setText(isFH?'(FH)':'(BH)'); });
    kb.on('keydown-SPACE', ()=>{ powerActive = true; powerDir = 1; });
    kb.on('keyup-SPACE',  ()=>{ powerActive = false; scene.events.emit('meters:released'); });
  }

  function setPuttTarget(r:number|undefined){ puttTarget = r; updatePower(); }
  function setNose(v:number){ nose = Phaser.Math.Clamp(v, -MAX_NOSE_DEG, MAX_NOSE_DEG); updateCurve(); }
  function setPower(v:number){ power = Phaser.Math.Clamp(v, 0, 1); updatePower(); }

  // Initial paint
  updateCurve(); updatePower();

  return {
    root,
    getNose: ()=>nose, setNose,
    getPower: ()=>power, setPower,
    setPuttTarget,
    setForehand: (fh:boolean)=>{ isFH = fh; hand.setText(isFH?'(FH)':'(BH)'); },
    attachInput
  };
}

