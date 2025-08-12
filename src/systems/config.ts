// All tunables here. //NOTE heavily for later balance

// --- WORLD / CAMERA ---
export const SKY_TINT = 0x7fae9a;   // //NOTE base sky color
export const FOG_ALPHA = 0.18;      // //NOTE foreground fog opacity

// --- METER LIMITS ---
export const MAX_NOSE_DEG = 30;     // //NOTE left/right nose angle clamp (A/D)
export const PUTTER_MAX_FT = 50;    // //NOTE putt minigame distance threshold (feet)
export const PUTT_PERFECT_WINDOW = 0.05; // //NOTE Â±5% of target power to sink
export const PUTT_MISS_CUTOFF = 0.18;    // //NOTE if off by >18% it's always a miss

// --- POWER CHARGE ---
export const POWER_CHARGE_RATE = 0.0014; // //NOTE power per ms while holding Space

// --- PERSPECTIVE SCALE (monotonic shrinking) ---
export const DISC_SCALE_NEAR = 0.85;     // //NOTE at t=0
export const DISC_SCALE_FAR  = 0.35;     // //NOTE at t=1 (smaller = further)

// --- WIND ---
export const WIND_STRENGTH_BASE = 1.0;   // //NOTE baseline, multiplied by course+hole
export const WIND_TO_FEET = 6;           // //NOTE ft gained/lost per 1.0 tail/head factor

// --- THROW PHYSICS (very light model) ---
export const SPEED_TO_FT = 38;           // //NOTE ft per speed at full power
export const GLIDE_TO_FT = 12;           // //NOTE ft per glide at full power
export const CURVE_TO_FT = 1.2;          // //NOTE ft penalty per deg of |nose|
export const RATING_POWER_BONUS = 0.08;  // //NOTE rating (0..1) adds to power

// --- LEADERBOARD PACING ---
export const AI_THROW_INTERVAL_MIN_MS = 1600;  // //NOTE AI cadence window
export const AI_THROW_INTERVAL_MAX_MS = 2200;

// --- UI COLORS ---
export const COL_TEXT = '#e8fff3';
export const COL_TEXT_SUB = '#cdeacc';
export const COL_FRAME = 0x3c624f;
export const COL_PANEL = 0x0c1e14;
export const COL_BAR_BG = 0x183325;
export const FONT = 'Arial';

// ---- Round flow ----
export const ROUND_END_DELAY_MS = 800;     // small pause before scorecard
