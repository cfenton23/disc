import Phaser from 'phaser';

export default class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  // --- wind helpers (slightly toned down) ---
  gustySwayX(target, baseX, cfg = {}) {
    const { ampMin=7, ampMax=20, durMin=900, durMax=2100, pauseMin=120, pauseMax=300,
            easeList=['Sine.easeInOut','Quad.easeInOut','Cubic.easeInOut'] } = cfg;
    const run = () => {
      const amp  = Phaser.Math.Between(ampMin, ampMax);
      const dir  = Math.random() < 0.5 ? -1 : 1;
      const dur  = Phaser.Math.Between(durMin, durMax);
      const ease = Phaser.Utils.Array.GetRandom(easeList);
      this.tweens.add({
        targets: target, x: baseX + dir * amp, duration: dur, yoyo: true, ease,
        onComplete: () => this.time.delayedCall(Phaser.Math.Between(pauseMin, pauseMax), run)
      });
    }; run();
  }
  gustyBobY(target, baseY, cfg = {}) {
    const { ampMin=3, ampMax=8, durMin=950, durMax=1600 } = cfg;
    const run = () => {
      const amp = Phaser.Math.Between(ampMin, ampMax);
      const dur = Phaser.Math.Between(durMin, durMax);
      this.tweens.add({ targets: target, y: baseY + amp, duration: dur, yoyo: true,
        ease: 'Sine.easeInOut', onComplete: run });
    }; run();
  }
  gustyTilt(target, baseAngle=0, cfg={}) {
    const { amp=1.8, dur=1600 } = cfg;
    this.tweens.add({ targets: target, angle: {from: baseAngle-amp, to: baseAngle+amp},
      duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  preload() {
    this.load.image('ui_bg_trees', 'assets/ui/bg_trees.png');
    this.load.image('ui_logo',     'assets/ui/logo.png');
    this.load.image('ui_chains',   'assets/ui/chains.png');
    this.load.image('ui_disc',     'assets/ui/disc.png');

    // debug: surface any missing files in the console
    this.load.on('loaderror', (f) => console.warn('LOAD ERROR:', f?.key, f?.src));
  }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // Background (overscanned so sway never reveals edges)
    const OVERSCAN = 1.10;
    const bg = this.add.image(W/2, H/2, 'ui_bg_trees').setDepth(0);
    bg.setDisplaySize(W * OVERSCAN, H * OVERSCAN);
    const marginX = (W * (OVERSCAN - 1)) / 2;
    this.gustySwayX(bg, bg.x, {
      ampMin: Math.min(7, marginX * 0.55),
      ampMax: Math.min(20, marginX * 0.85),
      durMin: 900, durMax: 2100
    });

    // Logo (bigger cap so it fills the top more)
    const logo = this.add.image(W/2, H * 0.04, 'ui_logo').setOrigin(0.5, 0).setDepth(3);
    const MAX_LOGO_W = W * 0.8;
    const MAX_LOGO_H = H * 0.3;
    const scaleW = MAX_LOGO_W / logo.width;
    const scaleH = MAX_LOGO_H / logo.height;
    const scale = Math.min(1, scaleW, scaleH);
    if (scale < 1) logo.setScale(scale);
    this.gustySwayX(logo, logo.x, { ampMin: 2, ampMax: 5, durMin: 1400, durMax: 2400 });

    // Chains at top-right (above trees, below logo)
    const chainsY = logo.getBottomCenter().y + 30;
    const chains  = this.add.image(W - 160, chainsY, 'ui_chains').setDepth(2).setScale(0.9);
    this.gustyBobY(chains, chains.y, { ampMin: 3, ampMax: 8 });
    this.gustyTilt(chains, 0, { amp: 1.8, dur: 1600 });

    // Disc bottom-left (static)
    this.add.image(160, H - 120, 'ui_disc').setDepth(2).setScale(0.95);

    // Menu items
    const hasSave = !!localStorage.getItem('discLifeSaveV1');
    const items = [
      { label: 'Continue Career',           key: 'CareerScene', visible: hasSave },
      { label: 'New Career',                key: 'NewCareerScene' },
      { label: 'Play Random 18',            key: 'TournamentScene' },
      { label: 'Clubhouse',                 key: 'ClubhouseScene' },
      { label: 'Options',                   key: 'OptionsScene' },
      { label: 'Accessibility / Dev Mode',  key: 'DevScene' }
    ];
    const visible = items.filter(i => i.visible !== false);

    // Button block (fixed, centered, never overlaps logo)
    const BTN_W = Math.min(860, Math.max(660, W * 0.42));
    const BTN_H = 88;
    const SPACING = 20;
    const blockH = visible.length * BTN_H + (visible.length - 1) * SPACING;
    const top = Math.max(logo.getBottomCenter().y + 20, (H - blockH) * 0.5);

    visible.forEach((it, i) => {
      const y = top + i * (BTN_H + SPACING);
      this.createButton(W/2, y, BTN_W, BTN_H, it.label, () => this.go(it.key));
    });

    // Keep background filling when resized
    this.scale.on('resize', ({ width, height }) => {
      bg.setPosition(width/2, height/2).setDisplaySize(width * OVERSCAN, height * OVERSCAN);
    });
  }

  // Rock-solid button hit area (prevents intermittent hover/click issues)
  createButton(x, y, w, h, label, onClick) {
    // draw
    const g = this.add.graphics();
    const draw = (fill = 0x103d2a, stroke = 0xC3A46A) => {
      g.clear(); g.lineStyle(6, stroke, 1); g.fillStyle(fill, 1);
      g.fillRoundedRect(-w/2, -h/2, w, h, 16);
      g.strokeRoundedRect(-w/2, -h/2, w, h, 16);
    };
    draw();

    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '40px',
      color: '#F2F5F0'
    }).setOrigin(0.5);

    // dedicated invisible hit rect = most reliable interaction
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.0001)
      .setInteractive({ useHandCursor: true });

    const container = this.add.container(x, y, [g, text, hit]).setDepth(10);
    container.setSize(w, h);

    // events on the hit object (never blocked by redraw)
    hit.on('pointerover', () => draw(0x144a33));
    hit.on('pointerout',  () => draw());
    hit.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.985, scaleY: 0.985, yoyo: true, duration: 90 });
      onClick();
    });
    // Inside create() in mainMenuScene.ts

// Play Random 18 button
const playRandomButton = this.add.text(
    this.scale.width / 2,
    this.scale.height / 2 + 60,
    'Play Random 18',
    { fontSize: '32px', backgroundColor: '#004400', color: '#FFFFFF' }
)
.setOrigin(0.5)
.setPadding(20)
.setInteractive({ useHandCursor: true })
.on('pointerover', () => playRandomButton.setStyle({ backgroundColor: '#006600' }))
.on('pointerout', () => playRandomButton.setStyle({ backgroundColor: '#004400' }))
.on('pointerdown', () => {
    console.log('Starting random tournament...');
    this.scene.start('TournamentScene'); // 👈 This is where you start it
});

  }

  go(key) {
    if (this.scene.get(key)) this.scene.start(key);
    else {
      const t = this.add.text(this.scale.width/2, this.scale.height-32,
        `Scene "${key}" not implemented`,
        { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#E0B15B' })
        .setOrigin(0.5, 1).setDepth(20);
      this.time.delayedCall(1400, () => t.destroy());
    }
  }
}
