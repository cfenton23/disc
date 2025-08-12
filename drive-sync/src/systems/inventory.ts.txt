// src/systems/inventory.ts
import Phaser from 'phaser';
import { DiscSpec } from './types';

type CatalogDisc = {
  id: string;
  slot: string;
  name: string;
  rarity: string;
  class: string;
  stats: { speed:number; glide:number; turn:number; fade:number };
  bonuses: any[];
  sources: string[];
  textureKey: string;
  image: string;
};

type Catalog = { schemaVersion:number; discs: CatalogDisc[] };
type PlayerDiscs = {
  schemaVersion:number;
  owned: string[];
  bag: string[];
  preferredPutt?: string;
  preferred?: { driver?: string; mid?: string; putter?: string };
};

export function mapCatalog(catalog: Catalog) {
  const byId = new Map<string, CatalogDisc>();
  catalog.discs.forEach(d => byId.set(d.id, d));
  return byId;
}

export function buildBagSpecs(bagIds: string[], byId: Map<string, CatalogDisc>): DiscSpec[] {
  return bagIds
    .map(id => byId.get(id))
    .filter((c): c is CatalogDisc => !!c)
    .map(c => ({
      id: c.id,
      name: c.name,
      slot: c.slot as DiscSpec['slot'],
      speed: c.stats.speed,
      glide: c.stats.glide,
      turn:  c.stats.turn,
      fade:  c.stats.fade,
      stability: c.class,
      textureKey: c.textureKey,
      image: c.image
    }));
}

export function preloadOwnedTextures(scene: Phaser.Scene, player: PlayerDiscs, byId: Map<string, CatalogDisc>) {
  player.owned.forEach(id => {
    const c = byId.get(id);
    if (!c) return;
    if (!scene.textures.exists(c.textureKey)) {
      scene.load.image(c.textureKey, c.image);
    }
  });
}

/** Resolve preferred discs with graceful fallbacks to any owned of that slot. */
export function resolvePreferred(player: PlayerDiscs, byId: Map<string, CatalogDisc>) {
  const pref = player.preferred || {};
  const findOfSlot = (slot: string) =>
    player.owned.map(id => byId.get(id)).find(c => c?.slot === slot)?.id;

  const driver = pref.driver && byId.has(pref.driver) ? pref.driver : findOfSlot('driver');
  const mid    = pref.mid    && byId.has(pref.mid)    ? pref.mid    : findOfSlot('mid') || findOfSlot('midrange');
  const putter = (player.preferredPutt && byId.has(player.preferredPutt)) ? player.preferredPutt
                : pref.putter && byId.has(pref.putter) ? pref.putter
                : findOfSlot('putter');

  return { driver, mid, putter };
}

