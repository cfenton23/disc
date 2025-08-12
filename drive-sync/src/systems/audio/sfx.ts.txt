import Phaser from 'phaser';

/**
 * Tiny safe SFX helper. Plays only if the audio key exists.
 * MP3s should live under /assets/sounds/.
 *  - sfx_throw  -> assets/sounds/throw.mp3   (optional, TODO)
 *  - sfx_chains -> assets/sounds/chains.mp3  (present)
 */
export function playSfx(scene: Phaser.Scene, key: string, config?: Phaser.Types.Sound.SoundConfig) {
  const audioCache: any = (scene.cache as any).audio;
  const exists = audioCache && typeof audioCache.exists === 'function' ? audioCache.exists(key) : false;
  if (!exists) return;
  try { scene.sound.play(key, config); } catch (e) { /* no-op */ }
}

export const SFX_KEYS = {
  THROW: 'sfx_throw',     // TODO: add /assets/sounds/throw.mp3
  CHAINS: 'sfx_chains',   // already provided as chains.mp3
} as const;

