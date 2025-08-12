# PATCH 1: Fix HUD Distance Calculation + Add Live Display
# 0.0.6 "Initial Claude" - Run from /disc/ root directory

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "dev\backups\$timestamp"
New-Item -ItemType Directory -Path $backupPath -Force

# Backup original file
$sourceFile = "src\systems\hud\hudsystem.ts"
$backupFile = Join-Path $backupPath "hudsystem.ts"
Copy-Item $sourceFile $backupFile -Force
Write-Host "Backed up: $sourceFile -> $backupFile"

# Read file content
$content = Get-Content $sourceFile -Raw

# Fix 1: Add throwSystem parameter to constructor
$oldConstructor = "constructor(scene: Phaser.Scene, bus: EventBus) {
    this.scene = scene;
    this.bus = bus;
  }"

$newConstructor = "constructor(scene: Phaser.Scene, bus: EventBus, throwSystem?: any) {
    this.scene = scene;
    this.bus = bus;
    this.throwSystem = throwSystem;
  }"

$content = $content -replace [regex]::Escape($oldConstructor), $newConstructor

# Fix 2: Add throwSystem and uiCourse properties after bus
$oldProps = "private scene: Phaser.Scene;
  private bus: EventBus;
  private course!: Course;"

$newProps = "private scene: Phaser.Scene;
  private bus: EventBus;
  private throwSystem?: any;
  private uiCourse: any = {};
  private course!: Course;"

$content = $content -replace [regex]::Escape($oldProps), $newProps

# Fix 3: Store uiCourse in init method
$oldInit = "init(data: InitData) {
    this.course = data.course;
    this.holeIndex = data.holeIndex;"

$newInit = "init(data: InitData) {
    this.course = data.course;
    this.holeIndex = data.holeIndex;
    this.uiCourse = data.uiCourse || {};"

$content = $content -replace [regex]::Escape($oldInit), $newInit

# Fix 4: Replace refresh method to show live distance
$oldRefresh = "private refresh() {
    const hole = this.safeHole();
    const par = typeof hole.par === 'number' ? hole.par : 3;

    const courseName = this.course?.name || this.course?.id || 'Course';
    const holeNo = this.holeIndex + 1;

    const dist = this.resolveDistanceFt(hole);
    const distText = dist ? `Distance: ${dist} ft  â€¢  ` : '';

    this.holeText.setText(`${courseName} â€" Hole ${holeNo} (Par ${par})`);
    this.infoText.setText(`${distText}SPACE = Next Hole  â€¢  ESC = Menu`);
  }"

$newRefresh = "private refresh() {
    const hole = this.safeHole();
    const par = typeof hole.par === 'number' ? hole.par : 3;

    const courseName = this.course?.name || this.course?.id || 'Course';
    const holeNo = this.holeIndex + 1;

    // Get live remaining distance from ThrowSystem
    const remaining = this.throwSystem?.getRemainingFeet?.() || 0;
    const remainingText = remaining > 0 ? `Remaining: ${Math.round(remaining)} ft  â€¢  ` : '';
    
    // Get estimated carry from ThrowSystem
    const carry = this.throwSystem?.estimateCarryFeet?.() || 0;
    const carryText = carry > 0 ? `Est. carry: ${Math.round(carry)} ft  â€¢  ` : '';

    this.holeText.setText(`${courseName} â€" Hole ${holeNo} (Par ${par})`);
    this.infoText.setText(`${remainingText}${carryText}SPACE = Power  â€¢  ESC = Menu`);
  }"

$content = $content -replace [regex]::Escape($oldRefresh), $newRefresh

# Fix 5: Replace hardcoded 0.6 conversion with config value
$oldConversion = "const px = Phaser.Math.Distance.Between(tee.x, tee.y, pin.x, pin.y);
      return Math.round(px * 0.6);"

$newConversion = "const px = Phaser.Math.Distance.Between(tee.x, tee.y, pin.x, pin.y);
      const feetPerPx = this.uiCourse?.feetPerPx || 0.6;
      return Math.round(px * feetPerPx);"

$content = $content -replace [regex]::Escape($oldConversion), $newConversion

# Write updated content back
Set-Content $sourceFile $content -NoNewline
Write-Host ""
Write-Host "✅ PATCH 1 COMPLETE: HUD System Fixed" -ForegroundColor Green
Write-Host ""
Write-Host "Changes made to $sourceFile:"
Write-Host "  ✅ Added throwSystem parameter to constructor"
Write-Host "  ✅ Added throwSystem and uiCourse properties"  
Write-Host "  ✅ Fixed hardcoded 0.6 conversion to use feetPerPx config"
Write-Host "  ✅ Added live 'Remaining X ft' display from ThrowSystem"
Write-Host "  ✅ Added live 'Est. carry X ft' display"
Write-Host "  ✅ Updated control hints to show SPACE = Power"
Write-Host ""
Write-Host "Next: Run PATCH 2 to connect ThrowSystem to HUD in TournamentScene"