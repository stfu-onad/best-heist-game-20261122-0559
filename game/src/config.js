// MIDNIGHT VAULT — tuning numbers and colours in one place.
// The playfield is a fixed 1280x800 logical area; the renderer scales it
// to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 800 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The HUD bar across the top; the room itself starts below it. */
export const HUD_HEIGHT = 56;

/** Seconds on the clock when a heist starts. */
export const TIME_LIMIT = 300;

/** The vault gem is worth this; the other loot is pocket money beside it. */
export const VAULT_VALUE = 5000;

/** Loot dollars a thief must already hold before the vault gem counts. */
export const VAULT_MIN_LOOT = 0;

export const THIEF = {
  radius: 14,
  speed: 205,
  sneakSpeed: 115,
  /** While sneaking a guard's eyes reach only this far, times their range. */
  sneakRangeFactor: 0.62,
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 68,
  chaseSpeed: 168,
  /** Seconds a guard keeps hunting the last seen spot before giving up. */
  huntTime: 9,
  /** Catch distance: a guard this close to the thief ends the run's life. */
  catchDistance: 27,
  /** How far a guard can see, in pixels, and how wide its cone is. */
  viewRange: 265,
  viewHalfAngle: 0.62,
  /** Alarm points a second while a guard has the thief in its cone. */
  spotRate: 48,
  /** Below this alarm a guard only turns and watches; above it, it chases. */
  chaseAlarm: 55,
};

export const CAMERA = {
  viewRange: 305,
  viewHalfAngle: 0.5,
  spotRate: 32,
  /** Degrees each way the camera sweeps from its resting angle. */
  sweepHalfAngle: 0.9,
  /** Seconds for one full sweep out and back. */
  sweepPeriod: 7,
};

export const ALARM = {
  max: 100,
  /** Alarm points a second the meter falls while nobody sees the thief. */
  decayRate: 9,
  /** When the meter fills, every guard hunts for this long. */
  lockdownSeconds: 7,
};

export const LIVES = 3;

/** A thrown coin costs this many dollars of loot and buys a distraction. */
export const COIN_COST = 50;
export const COIN_COOLDOWN = 5;
/** How far a coin's clink carries; a guard inside it walks over to look. */
export const COIN_RADIUS = 430;
/** Seconds a distracted guard inspects the coin before resuming patrol. */
export const COIN_INSPECT = 3.5;

/** Seconds of standing at the vault pedestal to crack the gem free. */
export const VAULT_CRACK_SECONDS = 3;
/** How close the thief must stand to the pedestal to crack it. */
export const VAULT_CRACK_RANGE = 64;

export const PALETTE = {
  backdrop: '#0a0a12',
  floorDark: '#171824',
  floorLight: '#1d1e2e',
  floorTrim: '#2c2d42',
  gold: '#e8b64c',
  goldDim: '#9a7a33',
  wall: '#3a2f4d',
  wallTop: '#54486e',
  wallEdge: '#6b5b8a',
  cover: '#232742',
  coverTop: '#2f3457',
  coverEdge: '#4a4f7d',
  thief: '#39d0c4',
  thiefDark: '#1d7f78',
  guard: '#7d8db3',
  guardDark: '#4a5878',
  guardCone: 'rgba(232, 182, 76, 0.20)',
  guardConeEdge: 'rgba(232, 182, 76, 0.55)',
  cameraCone: 'rgba(224, 62, 62, 0.16)',
  cameraConeEdge: 'rgba(224, 62, 62, 0.5)',
  loot: '#ffd76a',
  lootGem: '#7df9ff',
  exit: '#58d68d',
  alarmLow: '#58d68d',
  alarmMid: '#e8b64c',
  alarmHigh: '#e05252',
  text: '#f2ead8',
  muted: '#9a94a8',
  panel: 'rgba(10, 10, 20, 0.82)',
  panelEdge: '#6b5b8a',
};

export const FONT = 'Georgia, "Times New Roman", serif';
export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best loot is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-vault.best';
