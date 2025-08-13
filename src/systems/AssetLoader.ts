// src/systems/AssetLoader.ts
// Simple, robust asset loader with automatic DEV placeholders.
// Usage example (in a Phaser.Scene):
//   import { AssetLoader } from './AssetLoader';
//   const loader = new AssetLoader(this);
//   loader.loadWithFallback('minimap:lakeview_pines_47291:01', 'assets/minimaps/lakeview_pines_47291_h01.png', 'minimap');
//   await loader.start();
//   this.add.image(0, 0, loader.getTextureKey('minimap:lakeview_pines_47291:01', 'minimap')).setOrigin(0);

import Phaser from 'phaser';
import { PlaceholderFactory } from './PlaceholderFactory';

export type AssetKind = 'minimap' | 'disc' | 'buff' | 'rival' | 'generic';

/** Default placeholder canvas sizes per asset kind (you can tweak anytime). */
const PLACEHOLDER_SPECS: Record<AssetKind, { w: number; h: number; key: string }> = {
  minimap: { w: 1600, h: 900, key: 'dev-missing-minimap' },
  disc:    { w: 256,  h: 256, key: 'dev-missing-disc' },
  buff:    { w: 128,  h: 128, key: 'dev-missing-buff' },
  rival:   { w: 512,  h: 512, key: 'dev-missing-rival' },
  generic: { w: 256,  h: 256, key: 'dev-missing-generic' }
};

/**
 * AssetLoader
 * - Queues image loads.
 * - On missing/failed images, provides a dev placeholder at render time.
 * - Never throws on missing files â€” your scene can keep rendering.
 */
export class AssetLoader {
  private scene: Phaser.Scene;
  /** Keys we asked Phaser to load (maps to intended kind) */
  private queued = new Map<string, AssetKind>();
  /** Keys that failed to load (so getTextureKey can redirect to placeholder) */
  private failed = new Set<string>();
  /** Whether a load is currently running */
  private loading = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Queue an image to load. If it already exists in the Texture Manager, we skip.
   */
  loadWithFallback(key: string, url: string, kind: AssetKind = 'generic') {
    if (!key || !url) return;
    if (this.scene.textures.exists(key)) return; // already loaded previously

    // Track this request so we know which placeholder to use if it fails.
    this.queued.set(key, kind);

    // Use Phaser's image loader. We'll detect failures after the load completes.
    this.scene.load.image(key, url);
  }

  /**
   * Starts the Phaser loader and resolves when all queued files finish (success or fail).
   * Safe to call multiple times; it will only kick off when there is work to do.
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      if (this.loading) {
        // If a load is already running, wait for that cycle.
        this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        return;
      }

      // If nothing queued, resolve immediately.
      if (this.scene.load.totalToLoad === 0) {
        resolve();
        return;
      }

      this.loading = true;

      // When each file finishes, check if it actually landed in textures; if not, mark failed.
      this.scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, (fileKey: string) => {
        // Successful files will exist in the texture manager.
        if (!this.scene.textures.exists(fileKey)) {
          this.failed.add(fileKey);
        }
      });

      // For hard errors (404), Loader emits FILE_LOAD_ERROR; track those too.
      this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: any) => {
        if (file && file.key) this.failed.add(file.key);
      });

      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.loading = false;
        resolve();
      });

      this.scene.load.start();
    });
  }

  /**
   * Returns a texture key that is guaranteed to exist:
   * - the real key if it loaded, otherwise
   * - a dev placeholder key sized for the given kind.
   *
   * You can call this any time after `await start()`.
   */
  getTextureKey(requestedKey: string, kind: AssetKind = 'generic'): string {
    if (this.scene.textures.exists(requestedKey)) return requestedKey;

    // If it failed or was never queued, fall back to the kind's placeholder.
    const effectiveKind = this.queued.get(requestedKey) ?? kind;
    const spec = PLACEHOLDER_SPECS[effectiveKind];

    // Ensure a placeholder texture exists (drawn on a canvas at runtime).
    PlaceholderFactory.ensure(this.scene, spec.key, spec.w, spec.h, this.placeholderLabelFor(effectiveKind));

    return spec.key;
  }

  /** Returns the number of assets that failed (useful for a small DEV badge). */
  countMissing(): number {
    return this.failed.size;
  }

  /** Get a list of missing asset keys (for logging/exporting a checklist). */
  listMissing(): string[] {
    return Array.from(this.failed);
  }

  /** Simple label helper for generated placeholders. */
  private placeholderLabelFor(kind: AssetKind): string {
    return kind.toUpperCase();
  }
}

