import Phaser from "phaser";
import uiButtons from "../../ui_buttons.json";
import uiLayout from "../../ui_layout.json";
import { buildBackground, resizeBackground } from "../ui/buildBackground";
import { makeUIButton } from "../ui/makeUIButton";

// Build-time grab of all /assets/discs/*.png
const discMap = (import.meta as any).glob("../../assets/discs/*.png", { eager: true, as: "url" }) as Record<string, string>;
const discEntries = Object.entries(discMap);

type ButtonRoute = { scene: string | null; data?: Record<string, unknown> };
const DEPTH = { LOGO: 10, UI: 20, FORE: 30, TOAST: 40, OVERLAY: 200 };

export default class MainMenuScene extends Phaser.Scene {
  private bg!: ReturnType<typeof buildBackground>;
  private logo!: Phaser.GameObjects.Image;
  private disc!: Phaser.GameObjects.Image;
  private toast!: Phaser.GameObjects.Text;
  private buttons: { label: string; container: Phaser.GameObjects.Container }[] = [];
  private hoverTip?: Phaser.GameObjects.Text;
  private bagOverlay?: Phaser.GameObjects.Container;

  constructor() { super("MainMenuScene"); }

  init() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tweens.killAll();
      (this as any).bgRoot?.destroy(true);
      (this as any).motionRoot?.destroy(true);
      (this as any).uiRoot?.destroy(true);
      this.logo?.destroy();
      this.disc?.destroy();
      this.toast?.destroy();
      this.hoverTip?.destroy();
      this.bagOverlay?.destroy(true);
      this.buttons.forEach(b => b.container?.destroy());
      this.buttons = [];
    });
  }

  preload() {
    this.load.image("bg_trees", "assets/ui/bg_trees.png");
    this.load.image("logo", "assets/ui/logo.png");
    // Random disc each time the menu is entered
    if (discEntries.length > 0) {
      const pick = discEntries[Math.floor(Math.random() * discEntries.length)];
      const [path, url] = pick;
      this.registry.set("menu_disc_filename", path.replace(/^.*\//, "").replace(/\.png$/i, ""));
      this.load.image("menu_disc_random", url as any);
    } else {
      this.load.image("disc", "assets/ui/disc.png");
    }
    // Disc catalog metadata (optional; used for hover text if ids match)
    if (!this.cache.json.exists("discs")) {
      this.load.json("discs", "assets/json/discs.json");
    }
  }

  create() {
    this.cameras.main.resetFX();
    this.cameras.main.setAlpha(1);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setZoom(1);
    this.cameras.main.setRotation(0);

    this.bg = buildBackground(this);

    const { width, height } = this.scale;
    this.logo = this.add.image(width * 0.5, height * 0.10, "logo").setOrigin(0.5).setDepth(DEPTH.LOGO);
    this.fitLogo();

    // Corner disc (random or fallback)
    const discKey = this.textures.exists("menu_disc_random") ? "menu_disc_random" : "disc";
    this.disc = this.add.image(width * 0.12, height * 0.86, discKey).setOrigin(0.5).setDepth(DEPTH.FORE).setInteractive({ useHandCursor: true });

    // Hover tooltip (uses discs.json if id matches filename)
    const discId = (this.registry.get("menu_disc_filename") as string) || "";
    const discsMeta: any = this.cache.json.get("discs") || {};
    const metaList = Array.isArray(discsMeta?.discs) ? discsMeta.discs : discsMeta;
    const meta = Array.isArray(metaList) ? metaList.find((d: any) => (d?.id || "").toLowerCase() === discId.toLowerCase()) : null;

    this.hoverTip = this.add.text(this.disc.x + 80, this.disc.y, "", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      color: "#F2F5F0",
      backgroundColor: "rgba(0,0,0,0.45)",
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setDepth(DEPTH.TOAST).setAlpha(0).setOrigin(0, 0.5);

    this.disc.on("pointerover", () => {
      const text = meta
        ? `${meta.name || meta.id}\nSpeed ${meta.speed ?? "-"} • Glide ${meta.glide ?? "-"} • Turn ${meta.turn ?? "-"} • Fade ${meta.fade ?? "-"}`
        : discId ? discId : "Disc";
      this.hoverTip!.setText(text);
      this.hoverTip!.setAlpha(1);
    });
    this.disc.on("pointerout", () => this.hoverTip!.setAlpha(0));
    this.disc.on("pointerup", () => this.openBagOverlay(meta, discKey));

    // Buttons
    const order: string[] = (uiButtons as any).order ?? [];
    const routes: Record<string, ButtonRoute> = (uiButtons as any).routes ?? {};
    const maxW = Math.min((uiButtons as any)?.layout?.maxWidth ?? 520, 720);
    const rowH = ((uiButtons as any)?.layout?.rowHeight ?? 48) - 6;

    order.forEach(label => {
      const route = routes[label] ?? { scene: null };
      const onClick = () => route.scene ? this.scene.start(route.scene, route.data ?? {}) : this.showToast("Not yet implemented");
      const { container } = makeUIButton(this, label, onClick, maxW, rowH);
      this.buttons.push({ label, container });
    });

    this.toast = this.add.text(width / 2, height - 28, "", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "16px",
      color: "#F2F5F0",
      align: "center"
    }).setOrigin(0.5).setDepth(DEPTH.TOAST).setAlpha(0);

    this.layoutButtonsCenteredAnchor();

    // Resize
    this.scale.on("resize", () => {
      resizeBackground(this.bg, this);
      this.fitLogo();
      this.layoutButtonsCenteredAnchor();
      this.disc.setPosition(this.scale.width * 0.12, this.scale.height * 0.86);
      this.hoverTip?.setPosition(this.disc.x + 80, this.disc.y);
    });

    // Keyboard primary
    const primaryIndex = Math.max(0, (order ?? []).indexOf("Play Random 18"));
    this.input.keyboard?.on("keydown-ENTER", () => this.buttons[primaryIndex]?.container.emit("button:activate"));
    this.input.keyboard?.on("keydown-SPACE", () => this.buttons[primaryIndex]?.container.emit("button:activate"));
  }

  private openBagOverlay(meta: any, discKey: string) {
    // minimal, non-blocking overlay to preview "bag" (WIP)
    if (this.bagOverlay) { this.bagOverlay.destroy(true); this.bagOverlay = undefined; }

    const w = 420, h = 260;
    const cx = this.scale.width / 2, cy = this.scale.height / 2;
    const dim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.45).setOrigin(0);
    const panel = this.add.rectangle(cx, cy, w, h, 0x1b2a17, 0.95).setStrokeStyle(3, 0xffffff, 0.6);
    const title = this.add.text(cx, cy - 92, "Bag (WIP)", { fontFamily: "Arial", fontSize: "20px", color: "#ffffff" }).setOrigin(0.5);
    const xBtn = this.add.text(cx + w/2 - 18, cy - h/2 + 10, "✕", { fontFamily: "Arial", fontSize: "18px", color: "#ffffff" })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    const discImg = this.add.image(cx - 120, cy + 20, discKey).setScale(0.9);
    const desc = meta
      ? `${meta.name || meta.id}\n\nSpeed ${meta.speed ?? "-"}  Glide ${meta.glide ?? "-"}\nTurn ${meta.turn ?? "-"}  Fade ${meta.fade ?? "-"}`
      : "Selected Disc\n\n(Details coming soon)";
    const text = this.add.text(cx - 40, cy - 20, desc, { fontFamily: "Inter, system-ui, sans-serif", fontSize: "16px", color: "#e6ffe6" })
      .setOrigin(0, 0);

    this.bagOverlay = this.add.container(0, 0, [dim, panel, title, xBtn, discImg, text]).setDepth(DEPTH.OVERLAY);
    dim.setInteractive().on("pointerup", () => this.bagOverlay?.destroy(true));
    xBtn.on("pointerup", () => this.bagOverlay?.destroy(true));
  }

  private fitLogo() {
    const { width, height } = this.scale;
    const cfg: any = (uiLayout as any)?.logo ?? {};
    const topPad = cfg.topPad ?? 12;
    const maxW = width  * (cfg.maxWidthPct  ?? 0.40);
    const maxH = height * (cfg.maxHeightPct ?? 0.26);
    const sx = maxW / this.logo.width;
    const sy = maxH / this.logo.height;
    const s  = Math.min(sx, sy);
    this.logo.setScale(s).setPosition(width * 0.5, topPad + (this.logo.displayHeight / 2));
  }

  private layoutButtonsCenteredAnchor() {
    const { width, height } = this.scale;
    const layout: any = (uiLayout as any)?.buttons ?? {};
    const menuRoot: any = (uiLayout as any)?.menu ?? {};
    const spacing = (layout.spacing ?? menuRoot.spacing) ?? 12;
    const anchorYPct = (layout.anchorYPct ?? menuRoot.anchorYPct) ?? 0.68; // fallback if buttons.* not present
    const startY = height * Phaser.Math.Clamp(anchorYPct, 0.30, 0.85);

    const avgH = this.buttons.length > 0
      ? this.buttons.reduce((acc, b) => acc + (b.container.height || 44), 0) / this.buttons.length
      : 44;

    let y = startY;
    this.buttons.forEach(({ container }) => {
      container.setDepth(DEPTH.UI);
      container.setPosition(width / 2, y);
      y += (avgH + spacing);
    });
  }

  private showToast(msg: string) {
    if (!this.toast) return;
    this.toast.setText(msg);
    this.tweens.killTweensOf(this.toast);
    this.toast.setAlpha(0);
    this.tweens.add({ targets: this.toast, alpha: 1, duration: 160, yoyo: true, hold: 1400, ease: "Quad.easeOut" });
  }
}

