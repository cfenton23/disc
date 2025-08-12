import Phaser from 'phaser';
import { CourseHole } from './types';
import { SKY_TINT, FOG_ALPHA } from './config';

export function buildPlayfield(scene: Phaser.Scene, hole: CourseHole|undefined) {
  const { width: W, height: H } = scene.scale;
  const root = scene.add.container(0,0);

  // Sky
  const sky = scene.add.rectangle(W/2, H/2, W, H, SKY_TINT).setDepth(0); root.add(sky);
  root.add(scene.add.rectangle(W/2, H/2, W, H, 0x204031, 0.18).setDepth(1)); // tint

  // Sun shafts
  const sun = scene.add.container(0,0).setDepth(2);
  for (let i=0;i<5;i++){
    const g = scene.add.graphics({x: W*(0.15 + i*0.12), y:0});
    g.fillStyle(0xffffff, 0.040).fillTriangle(0,0,160,0,80,H*0.9);
    sun.add(g);
  }
  root.add(sun);

  // Tree bands with subtle per-hole palette differences
  const farC  = 0x274b3a;
  const midC  = 0x1f3b2e;
  const nearC = 0x183024;

  root.add(drawBand(scene, farC,  H*0.15, 0.45));
  root.add(drawBand(scene, midC,  H*0.10, 0.58));
  root.add(drawBand(scene, nearC, 0,      0.74));

  // Gentle sway
  root.iterate(c=>{
    if (c instanceof Phaser.GameObjects.Graphics || c instanceof Phaser.GameObjects.Container) {
      scene.tweens.add({ targets: c, x: {from:-6,to:6}, duration: 8000, ease: 'Sine.inOut', repeat:-1, yoyo:true });
    }
  });

  // Hazards â€“ water hint if present
  if ((hole?.hazards||[]).some(h=>h.startsWith('water'))) {
    const water = scene.add.graphics();
    water.fillStyle(0x1a4e4e, 0.45).fillRect(0, H*0.64, W, H*0.05);
    root.add(water);
  }

  // Fog
  root.add(scene.add.rectangle(W/2, H-120, W, H*0.6, 0x0e1b14, FOG_ALPHA).setDepth(6));

  // Tee box
  const tee = hole?.teePlacement ?? { x: 0.22, y: 0.70 };
  const teeX = W * tee.x, teeY = H * tee.y;
  const teeG = scene.add.graphics();
  teeG.fillStyle(0x2a4a3e, 1).fillRoundedRect(teeX-38, teeY+18, 76, 20, 6).lineStyle(2,0x112820).strokeRoundedRect(teeX-38, teeY+18, 76, 20, 6);
  root.add(teeG);

  return { root, tee: new Phaser.Math.Vector2(teeX, teeY) };
}

function drawBand(scene: Phaser.Scene, color:number, yOffset:number, scaleMul:number) {
  const { width: W, height: H } = scene.scale;
  const g = scene.add.graphics(); g.fillStyle(color,1);
  const baseY = H * (0.55 + yOffset / H);
  const step = 60;
  g.beginPath(); g.moveTo(0,H); g.lineTo(0,baseY);
  for (let x=0; x<=W+step; x+=step){
    const h = Phaser.Math.Between(50,140) * scaleMul;
    g.lineTo(x, baseY - h); g.lineTo(x+step*0.5, baseY - h*0.7); g.lineTo(x+step, baseY - h);
  }
  g.lineTo(W,H); g.closePath(); g.fillPath();

  for (let i=0;i<18;i++){
    const x = Phaser.Math.Between(0,W); const h = Phaser.Math.Between(120,260)*scaleMul;
    g.fillRect(x, baseY - h, 8*scaleMul, h);
  }
  return g;
}

