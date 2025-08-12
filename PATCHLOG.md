# Patch Log

## 0.0.1 â€“ Initial git version
- Add `VERSION` file and initialize to `0.0.1`.
- Add `PATCHLOG.md` (this file) to record future changes.
- Add `.gitattributes` to normalize line endings across OSes.
- No runtime code changes.



## 0.0.2  Menu hygiene + Throw System foundation
- Menu camera reset + shutdown cleanup (stops slip)
- ThrowSystem: aim, FH/BH, handedness dev toggle (H), fade, power meter w/ overcharge & ESC-cancel
- HoleResultOverlay (SPACE/), ShotHud (Remaining & Est. carry)
- Loads tuning_throw.json, discs.json (assets-first, root fallback), chains.mp3 SFX
- Scenes stay thin; systems own logic

## 0.0.3 – Throw polish + L?R course layout + menu disc

- Power meter now relaxes back to 0 when not held (linear).
- Auto-sink threshold set to 30 ft (temporary until putt mini-game is added).
- CourseRender: left?right framing, fairway width from JSON, hazards (trees/OB/water/bunker) via assets/json/ui_course.json.
- Shot HUD: clearer copy ("Remaining N ft  •  Est. carry M ft").
- Main menu: random /assets/discs/*.png each load; hover tooltip from discs.json; click opens lightweight Bag (WIP) overlay.
- ui_layout: buttons anchor/spacing honored; menu.* fallbacks supported.
### 0.0.4 â€” Scene wiring & overlay polish
- Wire BagSystem (1/2/3 = driver/mid/putter) into TournamentScene.
- ShotHud now receives uiCourse from scene; HUD text respects layout.
- Load ui_course.json, tuning_throw.json, discs.json in scene.
- Overlay: shadowed panel + better X button position/spacing.
- Reset camera/FX on scene enter to prevent menu slip.
## 0.0.5 â€“ Render polish groundwork
- CourseRender: tree scale knob, oval fairway capsule, distinct tee pad, woods fill.
- ShotHud: stacked text spacing; end-hole title + running total.
- Throw tunables centralized in tuning_throw.json; kept linear meter + 30ft auto-sink.
