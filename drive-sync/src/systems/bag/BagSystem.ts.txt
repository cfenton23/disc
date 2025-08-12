import Phaser from "phaser";
import { EventBus } from "../core/EventBus";

type Disc = { id:string; slot?: "driver"|"midrange"|"putter"; name?:string; speed?:number; glide?:number; turn?:number; fade?:number };

export class BagSystem {
  private scene: Phaser.Scene;
  private bus: EventBus;
  private discs: Disc[] = [];
  private active?: Disc;
  private key1?: Phaser.Input.Keyboard.Key;
  private key2?: Phaser.Input.Keyboard.Key;
  private key3?: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, bus: EventBus) { this.scene = scene; this.bus = bus; }

  init(discsJson: any) {
    this.discs = Array.isArray(discsJson?.discs) ? discsJson.discs : (Array.isArray(discsJson) ? discsJson : []);
    // default active = first driver, else mid, else putter, else first
    this.active = this.findBySlot("driver") || this.findBySlot("midrange") || this.findBySlot("putter") || this.discs[0];
    this.wireKeys();
    this.emitChange();
  }

  private findBySlot(slot:"driver"|"midrange"|"putter"){ return this.discs.find(d => (d.slot||"").toLowerCase()===slot); }

  private wireKeys(){
    const KB = Phaser.Input.Keyboard.KeyCodes;
    this.key1 = this.scene.input.keyboard!.addKey(KB.ONE);
    this.key2 = this.scene.input.keyboard!.addKey(KB.TWO);
    this.key3 = this.scene.input.keyboard!.addKey(KB.THREE);

    this.key1.on("down", ()=>{ const d=this.findBySlot("driver"); if(d){this.active=d; this.emitChange();}});
    this.key2.on("down", ()=>{ const d=this.findBySlot("midrange"); if(d){this.active=d; this.emitChange();}});
    this.key3.on("down", ()=>{ const d=this.findBySlot("putter"); if(d){this.active=d; this.emitChange();}});
  }

  getActive(){ return this.active; }
  getAll(){ return this.discs; }

  private emitChange(){
    if(!this.active) return;
    this.bus.emit("BAG_CHANGED",{ disc:this.active });
  }

  destroy(){
    [this.key1,this.key2,this.key3].forEach(k=>{k?.removeAllListeners();k?.destroy();});
  }
}

