import Phaser from "phaser";
import { EventBus } from "../core/EventBus";

type CourseHole = {
  recommendedLine?: "straight"|"hyzer"|"anhyzer"|"S-curve"|string;
  pinGuard?: "none"|"light"|"trees"|string;

  par?: number; lengthFt?: number | string; length?: number | string;
  tee?: { x:number; y:number } | [number,number];
  pin?: { x:number; y:number } | [number,number];
  elevation?: "uphill"|"downhill"|"flat"|string;
  fairwayWidth?: number|"narrow"|"medium"|"wide";
  hazards?: string[];
  widthProfile?: number[];
};
type Course = { id?:string; name?:string; holes: CourseHole[] };

type InitData = { course:Course; holeIndex:number; uiCourse:any; depths:{ terrain:number; fairway:number; markers:number; hud:number } };

export class CourseRenderSystem {
  private scene:Phaser.Scene; private bus:EventBus;
  private course!:Course; private holeIndex!:number; private ui:any={};

  private gTerrain!:Phaser.GameObjects.Graphics;
  private gFairway!:Phaser.GameObjects.Graphics;
  private hazards!:Phaser.GameObjects.Container;
  private markers!:Phaser.GameObjects.Container;
  private decor!:Phaser.GameObjects.Container;

  private teeIso!:Phaser.Math.Vector2; private pinIso!:Phaser.Math.Vector2;
  private cage?: Phaser.GameObjects.Triangle;
  private targetRadiusPx: number = 22;
  private _wiredTargetListener: boolean = false;


  constructor(scene:Phaser.Scene,bus:EventBus){ this.scene=scene; this.bus=bus; }

  init(data:InitData){
    this.course=data.course; this.holeIndex=data.holeIndex; this.ui=data.uiCourse||{};
    this.gTerrain=this.scene.add.graphics().setDepth(data.depths.terrain);
    this.gFairway=this.scene.add.graphics().setDepth(data.depths.fairway);
    this.hazards=this.scene.add.container(0,0).setDepth(data.depths.fairway+1);
    this.markers=this.scene.add.container(0,0).setDepth(data.depths.markers);
    this.decor=this.scene.add.container(0,0).setDepth(data.depths.terrain+1);
    this.drawHole();
      if (!this._wiredTargetListener) {
      this._wiredTargetListener = true;
      this.bus.on("THROW_RESOLVED", (ev:any) => {
        const ex = Number((ev && ev.x) ? ev.x : ((ev && ev.pos && ev.pos.x) ? ev.pos.x : 0));
        const ey = Number((ev && ev.y) ? ev.y : ((ev && ev.pos && ev.pos.y) ? ev.pos.y : 0));
        const p = new Phaser.Math.Vector2(ex, ey);
        if (this.isAtTarget(p, this.ui?.targetRadiusPx ?? this.targetRadiusPx)) {
          this.bus.emit("HOLE_END", { reason:"in_cage", holeIndex:this.holeIndex, at:{x:ex,y:ey} });
        }
      });
    }}

  setHole(holeIndex:number){ this.holeIndex=holeIndex; this.clear(); this.drawHole(); }
  update(_dt:number){}
  destroy(){ this.clear(); this.gTerrain?.destroy(); this.gFairway?.destroy(); this.hazards?.destroy(true); this.markers?.destroy(true); this.decor?.destroy(true); }

  private drawHole(){
    const hole=this.safeHole(); const tee=this.pt(hole.tee)??{x:160,y:160}; const pin=this.pt(hole.pin)??{x:1000,y:520};
    const iso=this.ui?.isometric||{}; const yScale=iso.yScale??0.78; const ySkew=iso.ySkew??-0.18;
    const toIso=(p:{x:number;y:number})=> new Phaser.Math.Vector2(p.x + p.y*ySkew, p.y*yScale);
    let teeIso=toIso(tee), pinIso=toIso(pin);
    if(teeIso.x>pinIso.x){ const mid=(teeIso.x+pinIso.x)/2; teeIso.x=mid-(teeIso.x-mid); pinIso.x=mid-(pinIso.x-mid); }

    const screen={w:this.scene.scale.width,h:this.scene.scale.height};
    const leftX=screen.w*0.18, rightX=screen.w*0.82; const span=Math.max(80,rightX-leftX);
    const currentSpan=Math.max(1,Math.abs(pinIso.x-teeIso.x)); const scale=span/currentSpan;
    const offsetX=leftX - teeIso.x*scale; const offsetY=screen.h*0.18 - Math.min(teeIso.y,pinIso.y)*scale;

    this.teeIso=new Phaser.Math.Vector2(teeIso.x*scale+offsetX, teeIso.y*scale+offsetY);
    this.pinIso=new Phaser.Math.Vector2(pinIso.x*scale+offsetX, pinIso.y*scale+offsetY);

    this.drawTerrainPanel();

    const widths=this.ui?.fairwayWidth||{narrow:32,medium:48,wide:64};
    const fw= typeof hole.fairwayWidth==="number"? hole.fairwayWidth : (widths[String(hole.fairwayWidth||"medium")]??widths.medium);
    this.drawFairway(this.teeIso,this.pinIso,fw);
    (hole.hazards||[]).forEach(h=>this.drawHazard(h,this.teeIso,this.pinIso,fw));
    this.drawMarkers(this.teeIso,this.pinIso);

    // Trees border to remove empty margins
    this.scatterForestBorder();
  }

  private drawTerrainPanel(){
    const w=this.scene.scale.width,h=this.scene.scale.height,pad=48, r=18;
    const bg=Phaser.Display.Color.HexStringToColor(this.ui?.colors?.terrain??"#e9e7db").color;
    const border=Phaser.Display.Color.HexStringToColor(this.ui?.colors?.border??"#0b1a10").color;
    this.gTerrain.clear(); this.gTerrain.fillStyle(bg,1); this.gTerrain.fillRoundedRect(pad,pad,w-pad*2,h-pad*2,r);
    this.gTerrain.lineStyle(2,border,0.15); this.gTerrain.strokeRoundedRect(pad,pad,w-pad*2,h-pad*2,r);
  }
  // PATCH curved-fairway BEGIN (2025-08-12)
  private drawFairway(tee: Phaser.Math.Vector2, pin: Phaser.Math.Vector2, widthPx: number) {
    const selfAny = (this as any);
    const hole = typeof selfAny.safeHole === "function" ? selfAny.safeHole() : ({} as any);
    const ui = selfAny.ui || {};
    const uiColors = ui.colors || {};
    const fairwayHex = uiColors.fairway || "#4a8c5a";
    const edgeHex = uiColors.fairwayEdge || "#2f6c45";
    const col = Phaser.Display.Color.HexStringToColor(fairwayHex).color;
    const edge = Phaser.Display.Color.HexStringToColor(edgeHex).color;
    const style = String(hole.recommendedLine || "straight");
    const segs = 22;
    const pts: Phaser.Math.Vector2[] = [];
    const base = pin.clone().subtract(tee);
    const len = base.length();
    const dir = base.clone().normalize();
    const perp = new Phaser.Math.Vector2(-dir.y, dir.x);
    let amp = widthPx * 0.55;
    if (style === "S-curve") { amp = widthPx * 0.35; }
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      let off = 0;
      if (style === "hyzer") {
        off = -Math.sin(t * Math.PI) * amp;
      } else if (style === "anhyzer") {
        off = Math.sin(t * Math.PI) * amp;
      } else if (style === "S-curve") {
        off = Math.sin(t * Math.PI * 2) * (amp * 0.6);
      }
      const p = new Phaser.Math.Vector2(
        tee.x + dir.x * (len * t) + perp.x * off,
        tee.y + dir.y * (len * t) + perp.y * off
      );
      pts.push(p);
    }
    const profile: number[] = Array.isArray(hole.widthProfile) ? hole.widthProfile : [];
    const { left, right } = this.buildFairwayPath(pts, widthPx, profile);
    this.renderFairwayShape(left, right, col, edge, widthPx, hole, pts);
    (this as any)._fairwayPath = pts;
  }

  private buildFairwayPath(pts: Phaser.Math.Vector2[], widthPx: number, profile: number[]) {
    const left: Phaser.Math.Vector2[] = [];
    const right: Phaser.Math.Vector2[] = [];
    const last = Math.max(profile.length - 1, 0);
    for (let i = 0; i < pts.length; i++) {
      let ia = i - 1; if (ia < 0) { ia = 0; }
      let ib = i + 1; if (ib > pts.length - 1) { ib = pts.length - 1; }
      const a = pts[ia];
      const b = pts[ib];
      const tangent = b.clone().subtract(a).normalize();
      const normal = new Phaser.Math.Vector2(-tangent.y, tangent.x);
      let mult = 1;
      if (profile.length > 0) {
        const t = i / (pts.length - 1);
        const f = t * last;
        const i0 = Math.floor(f);
        const i1 = Math.min(i0 + 1, last);
        const frac = f - i0;
        const m0 = profile[i0] ?? 1;
        const m1 = profile[i1] ?? m0;
        mult = m0 + (m1 - m0) * frac;
      }
      const half = widthPx * 0.5 * mult;
      left.push(pts[i].clone().add(normal.clone().scale(-half)));
      right.push(pts[i].clone().add(normal.clone().scale(half)));
    }
    return { left, right };
  }

  private renderFairwayShape(left: Phaser.Math.Vector2[], right: Phaser.Math.Vector2[], col: number, edge: number, widthPx: number, hole: CourseHole, pts: Phaser.Math.Vector2[]) {
    this.gFairway.clear();
    this.gFairway.fillStyle(col, 0.78);
    this.gFairway.beginPath();
    this.gFairway.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) { this.gFairway.lineTo(left[i].x, left[i].y); }
    for (let i = right.length - 1; i >= 0; i--) { this.gFairway.lineTo(right[i].x, right[i].y); }
    this.gFairway.closePath();
    this.gFairway.fillPath();
    this.gFairway.lineStyle(2, edge, 0.9);
    this.gFairway.strokePath();
    if (String(hole.elevation || "flat") !== "flat") {
      let shade = 0x5aa66a;
      if (hole.elevation === "uphill") { shade = 0x3a6b4a; }
      const bands = 6;
      for (let i = 1; i <= bands; i++) {
        const t0 = i / (bands + 1);
        const p = pts[Math.floor(t0 * (pts.length - 1))];
        this.gFairway.fillStyle(shade, 0.12);
        this.gFairway.fillCircle(p.x, p.y, widthPx * 0.45 * (1 - i * 0.08));
      }
    }
  }
  // PATCH curved-fairway END

  private drawHazard(kind:string,tee:Phaser.Math.Vector2,pin:Phaser.Math.Vector2,fw:number){    // 0.0.6: hazards that depend on fairway path
    if (kind === "tight_gap") {
      const pts = (this as any)._fairwayPath || [];
      this.drawTightGap(pts, fw);
      return;
    }
    if (kind === "pin_guard" || kind === "pinGuard") {
      const hole = this.safeHole();
      const pg = String(hole.pinGuard || "none");
      if (pg !== "none") { this.drawPinGuard(pg, pin, 1); }
      return;
    }

    const hzCfg=this.ui?.hazards||{}; const dir=pin.clone().subtract(tee).normalize(); const perp=new Phaser.Math.Vector2(-dir.y,dir.x); const length=pin.distance(tee);

    if(kind==="trees_right"||kind==="trees_left"||kind==="trees_both"){
      const side=kind==="trees_left" ? -1 : 1; const both=kind==="trees_both";
      const col=Phaser.Display.Color.HexStringToColor(hzCfg?.trees?.tint??"#3a6b2f").color;
      const density=hzCfg?.trees?.density??7; const offset=(hzCfg?.trees?.offset??24)+fw*0.6; const count=Math.max(3,Math.floor(length/120)+density);
      for(let i=0;i<count;i++){ const t=i/(count-1); const base=new Phaser.Math.Vector2(tee.x+dir.x*(length*t), tee.y+dir.y*(length*t));
        const off=perp.clone().scale(offset*(both?(i%2===0?1:-1):side)); const p=base.add(off);
        const r=this.scene.add.rectangle(p.x,p.y,6,18, col,0.85).setOrigin(0.5,1); this.hazards.add(r); }
      return;
    }
    if(kind==="OB_path"){
      const col=Phaser.Display.Color.HexStringToColor(hzCfg?.ob?.color??"#d3b98b").color;
      const offset=(hzCfg?.ob?.offset ?? (fw+20))*1.2; const start=tee.clone().add(perp.clone().scale(offset)); const end=pin.clone().add(perp.clone().scale(offset));
      const g=this.scene.add.graphics().setAlpha(0.8); g.lineStyle(6,col,1).beginPath().moveTo(start.x,start.y).lineTo(end.x,end.y).strokePath();
      g.lineStyle(1,0x000000,0.25);
      for(let i=0;i<16;i++){ const t0=i/16,t1=(i+0.5)/16; const a=new Phaser.Math.Vector2(Phaser.Math.Linear(start.x,end.x,t0),Phaser.Math.Linear(start.y,end.y,t0));
        const b=new Phaser.Math.Vector2(Phaser.Math.Linear(start.x,end.x,t1),Phaser.Math.Linear(start.y,end.y,t1));
        g.beginPath().moveTo(a.x,a.y).lineTo(b.x,b.y).strokePath(); }
      this.hazards.add(g); return;
    }
    if(kind==="water_short"||kind==="water_long"){
      const col=Phaser.Display.Color.HexStringToColor(hzCfg?.water?.color??"#4db2ff").color;
      const ahead= kind==="water_long" ? 0.75 : 0.25; const width=(hzCfg?.water?.width ?? 84)+fw*0.2;
      const mid=new Phaser.Math.Vector2(tee.x+dir.x*(length*ahead), tee.y+dir.y*(length*ahead));
      const left=mid.clone().add(perp.clone().scale(width)); const right=mid.clone().add(perp.clone().scale(-width));
      const g=this.scene.add.graphics().setAlpha(0.6); g.fillStyle(col,0.8); g.fillTriangle(mid.x,mid.y,left.x,left.y,right.x,right.y); this.hazards.add(g); return;
    }
    if(kind==="bunker_mound"){
      const col=Phaser.Display.Color.HexStringToColor(hzCfg?.bunker?.color??"#dab27a").color;
      const near=new Phaser.Math.Vector2(tee.x+dir.x*(length*0.55), tee.y+dir.y*(length*0.55));
      const g=this.scene.add.graphics().setAlpha(0.85); g.fillStyle(col,1).fillEllipse(near.x,near.y, fw*0.9, fw*0.5); this.hazards.add(g); return;
    }
  }

    private drawMarkers(tee:Phaser.Math.Vector2,pin:Phaser.Math.Vector2){
    this.markers.removeAll(true);
    const teeDot=this.scene.add.circle(tee.x,tee.y,6,0x2da5ff,1);
    const pinTri=this.scene.add.triangle(pin.x,pin.y,0,16,-10,-8,10,-8,0xffd23c,1);
    ;(pinTri as any).name = "cage";
    pinTri.setData && pinTri.setData("tag","cage");
    this.cage = pinTri;
    this.markers.add([teeDot,pinTri]);
  }

  private scatterForestBorder(){
    this.decor.removeAll(true);
    const cfg=this.ui?.hazards?.treesBorder||{};
    const dens=cfg.density ?? 0.0016; const jitter=cfg.jitterPx ?? 22;
    const tint=Phaser.Display.Color.HexStringToColor(cfg.tint ?? "#325a2a").color;

    const pad=48; const w=this.scene.scale.width - pad*2; const h=this.scene.scale.height - pad*2;
    const area=w*h; const count=Math.max(12, Math.floor(area*dens));
    for(let i=0;i<count;i++){
      const x=pad + Math.random()*w; const y=pad + Math.random()*h;
      // keep out of the mid diagonal corridor a bit to emphasize island look (cheap mask)
      const t=(x-pad)/w; const corridorY=Phaser.Math.Linear(this.teeIso.y,this.pinIso.y,t); const dist=Math.abs(y-corridorY);
      if(dist<70) continue;
      const r=this.scene.add.image(x + Phaser.Math.Between(-jitter,jitter), y+Phaser.Math.Between(-jitter,jitter), ["tree1","tree2","tree3"][i%3] || "tree1");
      r.setTint(tint).setAlpha(0.7).setScale(0.9+Math.random()*0.25).setDepth(this.gTerrain.depth+1);
      this.decor.add(r);
    }
  }
private pointToSegmentDistance(p: Phaser.Math.Vector2, a: Phaser.Math.Vector2, b: Phaser.Math.Vector2) {
  const ab = b.clone().subtract(a);
  const t = Phaser.Math.Clamp(p.clone().subtract(a).dot(ab) / ab.lengthSq(), 0, 1);
  const proj = a.clone().add(ab.scale(t));
  return Phaser.Math.Distance.Between(p.x, p.y, proj.x, proj.y);
}

  private clear(){ this.gTerrain?.clear(); this.gFairway?.clear(); this.hazards?.removeAll(true); this.markers?.removeAll(true); this.decor?.removeAll(true); }
  private safeHole():CourseHole{ const holes=this.course?.holes??[]; return holes[this.holeIndex] ?? {par:3,lengthFt:320,tee:[160,160],pin:[1000,520]}; }
  private pt(p:any):{x:number;y:number}|null{ if(!p) return null; if(Array.isArray(p)&&p.length>=2) return {x:Number(p[0])||0,y:Number(p[1])||0}; if(typeof p==="object"&&p.x!=null&&p.y!=null) return {x:Number(p.x)||0,y:Number(p.y)||0}; return null; }

  public isAtTarget(p: Phaser.Math.Vector2, radiusPx?: number): boolean {
    const r = Number(radiusPx ?? (this.ui?.targetRadiusPx ?? this.targetRadiusPx));
    const pin = this.pinIso || new Phaser.Math.Vector2(0,0);
    return Phaser.Math.Distance.Between(p.x,p.y,pin.x,pin.y) <= r;
  }
  public getPinIso(): Phaser.Math.Vector2 { return this.pinIso?.clone() || new Phaser.Math.Vector2(0,0); }
  public getCage(): Phaser.GameObjects.Triangle | undefined { return this.cage; }
  private drawTightGap(pts: Phaser.Math.Vector2[], widthPx: number){
    if (!pts || pts.length < 3) { return }
    const i = Math.floor(pts.length * 0.7);
    const center = pts[i];
    const a = pts[Math.max(0,i-1)], b = pts[Math.min(pts.length-1,i+1)];
    const tangent = b.clone().subtract(a).normalize();
    const normal  = new Phaser.Math.Vector2(-tangent.y, tangent.x);
    const gap = widthPx * 0.32;
    const tint = Phaser.Display.Color.HexStringToColor(this.ui?.hazards?.trees?.tint || "#3a6b2f").color;
    const left  = this.scene.add.rectangle(center.x + normal.x*(-gap), center.y + normal.y*(-gap), 10, 26, tint, 0.9).setOrigin(0.5,1);
    const right = this.scene.add.rectangle(center.x + normal.x*(+gap), center.y + normal.y*(+gap), 10, 26, tint, 0.9).setOrigin(0.5,1);
    this.hazards.add(left); this.hazards.add(right);
  }
  private drawPinGuard(kind: string, pin: Phaser.Math.Vector2, scale=1){
    if (kind === "trees"){
      const tint = Phaser.Display.Color.HexStringToColor(this.ui?.hazards?.trees?.tint || "#3a6b2f").color;
      const r = 44*scale, n=4;
      for(let i=0;i<n;i++){
        const ang = (i*Math.PI*2)/n;
        const x = pin.x + Math.cos(ang)*r, y = pin.y + Math.sin(ang)*r;
        const t = this.scene.add.rectangle(x,y, 10,26, tint, 0.9).setOrigin(0.5,1);
        this.hazards.add(t);
      }
    } else if (kind === "light"){
      const col = 0x4a6b3a;
      this.hazards.add(this.scene.add.circle(pin.x-25, pin.y-15, 8*scale, col, 0.85));
      this.hazards.add(this.scene.add.circle(pin.x+25, pin.y+15, 8*scale, col, 0.85));
    }
  }
}
