// MIDNIGHT VAULT — the screenshot scenes behind ?shot=cover|start|chase|win.
// Each one plays the real rules forward from a fresh world, steered by a
// small autopilot that walks a hand-set route and waits out any cone that
// covers its path, so the frame is what a real heist looks like and the
// same seed always gives the same frame.
//
// The routes thread the room's door gaps on purpose: the autopilot walks
// straight lines, so every leg is drawn with a clear line between its
// ends — a leg aimed straight at a wall would pin the thief against it.

import { CAMERA, GUARD, STEP, THIEF } from './config.js';
import { EVENT_OVER, EVENT_WIN, angleDiff } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Is point (x, y) inside watcher w's cone, with a clear line of sight? */
function pointInCone(world, watcher, x, y, range, halfAngle) {
  const dx = x - watcher.x;
  const dy = y - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), watcher.angle)) > halfAngle) return false;
  return world.hasLineOfSight(watcher.x, watcher.y, x, y);
}

/** True when no cone covers any sampled point on the walk to (tx, ty). */
function pathClear(world, tx, ty, sneak, ignoreCameras) {
  const thief = world.state.thief;
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    const x = thief.x + ((tx - thief.x) * i) / steps;
    const y = thief.y + ((ty - thief.y) * i) / steps;
    const guardRange = sneak ? GUARD.viewRange * THIEF.sneakRangeFactor : GUARD.viewRange;
    for (const guard of world.state.guards) {
      if (pointInCone(world, guard, x, y, guardRange, GUARD.viewHalfAngle)) return false;
    }
    if (ignoreCameras) continue;
    for (const camera of world.state.cameras) {
      if (pointInCone(world, camera, x, y, CAMERA.viewRange, CAMERA.viewHalfAngle)) return false;
    }
  }
  return true;
}

function runSteps(world, seconds, drive) {
  const total = Math.round(seconds / STEP);
  let events = 0;
  for (let i = 0; i < total; i += 1) {
    events = world.step(STEP, drive(world), true, null);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return events;
}

/** True when no cone covers the point right now (full ranges: margin). */
function pointSafe(world, x, y) {
  for (const guard of world.state.guards) {
    if (pointInCone(world, guard, x, y, GUARD.viewRange, GUARD.viewHalfAngle)) return false;
  }
  for (const camera of world.state.cameras) {
    if (pointInCone(world, camera, x, y, CAMERA.viewRange, CAMERA.viewHalfAngle)) return false;
  }
  return true;
}

/**
 * Walk a route of short hops, waiting out cones, until the last is
 * reached. Each hop is committed once its whole line is clear: the thief
 * waits at the hop's start — a waypoint picked off every patrol line —
 * and then walks it through without stopping, because stopping mid-hop
 * is how a thief ends up waiting on a guard's patrol line. When seen
 * mid-hop it runs for the nearest safe waypoint it already passed and
 * tries the hop again. A catch respawns the thief at the door, so the
 * route restarts from its first hop.
 *
 * Two walls can meet in a concave corner that pins a thief pushing
 * straight at its target (the pushes cancel): if the thief is commanded
 * to move but barely budges for half a second, it backs off toward its
 * safe point for a second instead of grinding the corner.
 */
function walkRoute(world, route, capSeconds, ignoreCameras = false) {
  const total = Math.round(capSeconds / STEP);
  const ENTRY_POINT = { x: 75, y: 742 };
  const toward = (x, y) => {
    const thief = world.state.thief;
    const dx = x - thief.x;
    const dy = y - thief.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return { x: 0, y: 0 };
    return { x: dx / dist, y: dy / dist };
  };
  let leg = 0;
  let lives = world.state.lives;
  let visited = [];
  let unstick = 0;
  let checkAt = 30;
  let checkPos = { x: world.state.thief.x, y: world.state.thief.y };
  let committed = false;
  for (let i = 0; i < total; i += 1) {
    if (leg >= route.length) return true;
    if (world.state.lives < lives) {
      lives = world.state.lives;
      leg = 0;
      visited = [];
      unstick = 0;
      committed = false;
    }
    const target = route[leg];
    let retreat = ENTRY_POINT;
    // Fall back only to the west side of the hall: the east corridor's
    // waypoints sit beside Rook's column and are no refuge at all.
    for (let v = visited.length - 1; v >= 0; v -= 1) {
      if (visited[v].x <= 800 && pointSafe(world, visited[v].x, visited[v].y)) {
        retreat = visited[v];
        break;
      }
    }
    // Run when spotted or hot, sneak when the coast looks clear. A committed
    // hop is run, not sneaked: speed is what gets the thief through a
    // camera's sweep before it closes. Only a guard's eyes make the thief
    // flee — a camera only taxes the alarm, and fleeing from it aborts
    // every hop through its sweep.
    let sneak = !(world.state.seenByGuard || world.state.seenByCamera || world.state.alarm > 40);
    if (committed) sneak = false;
    const seen = world.state.seenByGuard;
    let move;
    if (unstick > 0) {
      unstick -= 1;
      move = toward(retreat.x, retreat.y);
    } else if (seen) {
      committed = false;
      move = toward(retreat.x, retreat.y);
    } else if (committed) {
      move = toward(target.x, target.y);
    } else if (pathClear(world, target.x, target.y, sneak, ignoreCameras)) {
      committed = true;
      move = toward(target.x, target.y);
    } else {
      move = { x: 0, y: 0 };
    }
    const events = world.step(STEP, move, sneak, null);
    if (events & (EVENT_OVER | EVENT_WIN)) return false;
    if (i === checkAt) {
      const moved = Math.hypot(world.state.thief.x - checkPos.x, world.state.thief.y - checkPos.y);
      if (move.x !== 0 || move.y !== 0) {
        if (moved < 2) unstick = 60;
      }
      checkPos = { x: world.state.thief.x, y: world.state.thief.y };
      checkAt = i + 30;
    }
    if (Math.hypot(world.state.thief.x - target.x, world.state.thief.y - target.y) < 10) {
      visited.push(target);
      leg += 1;
      committed = false;
    }
  }
  return leg >= route.length;
}

// Door gaps the routes thread: south partition (350), west partition
// (428, 450), north partition (750), vault door (908, 212). Every hop is
// short enough to commit to once clear, and every hop start sits off
// every patrol line, so the thief never waits on a guard's path.
const COVER_ROUTE = [
  { x: 350, y: 700 }, // south corridor
  { x: 350, y: 590 },
  { x: 350, y: 480 }, // through the south gap
  { x: 355, y: 320 },
  { x: 360, y: 170 }, // gold bars in the west gallery
  { x: 370, y: 310 },
  { x: 380, y: 450 }, // back south, west of the partition
  { x: 560, y: 420 }, // hop across the hall
  { x: 750, y: 380 }, // into the hall
  { x: 620, y: 380 }, // the gem case, mid-room
  { x: 700, y: 470 }, // open floor, cones crossing nearby
];

const WIN_ROUTE_IN_A = [
  { x: 350, y: 700 },
  { x: 350, y: 590 },
  { x: 350, y: 480 },
  { x: 355, y: 320 },
  { x: 360, y: 170 }, // west gallery gold
  { x: 370, y: 310 },
  { x: 380, y: 450 },
  { x: 560, y: 420 }, // hop across the hall
  { x: 750, y: 380 },
  { x: 620, y: 380 }, // central gem case
  { x: 800, y: 420 }, // hop east
  { x: 950, y: 460 }, // just outside the east camera's reach
  { x: 1080, y: 500 }, // east corridor gold
  { x: 950, y: 460 }, // back west
  { x: 880, y: 340 }, // shielded from the north camera by the partition
  { x: 750, y: 340 },
  { x: 750, y: 260 }, // through the north gap
];

// The vault approach crosses Rook's column, so it runs after a coin
// has pulled him west (see crossWithCoin below).
const WIN_ROUTE_IN_B = [
  { x: 880, y: 235 }, // east of Rook's column, off its cone's axis
  { x: 950, y: 212 }, // through the vault door gap
  { x: 1150, y: 165 }, // the pedestal: stand and crack
];

const WIN_ROUTE_OUT_A = [
  { x: 950, y: 212 }, // back through the vault door gap
  { x: 880, y: 235 },
];

const WIN_ROUTE_OUT_B = [
  { x: 750, y: 260 },
  { x: 750, y: 380 }, // through the north gap
  { x: 600, y: 410 },
  { x: 490, y: 430 },
  { x: 380, y: 450 }, // through the west gap
  { x: 350, y: 480 },
  { x: 350, y: 590 },
  { x: 350, y: 700 }, // through the south gap
  { x: 75, y: 770 }, // the EXIT door
];

/**
 * Before crossing Rook's column, toss a coin to the south-west when he is
 * near the crossing: he walks over to inspect the clink, and the thief
 * slips across behind him. The coin lands at (600, 450), inside every
 * point of Rook's loop, so he always takes the bait — and his walk there
 * stays south of the thief's waiting spot, so he never strolls through it.
 */
function crossWithCoin(world) {
  const rook = world.state.guards[0];
  const crossing = { x: 830, y: 248 };
  const near = Math.hypot(rook.x - crossing.x, rook.y - crossing.y) < 280;
  if (!near || world.state.loot < 50) return;
  world.step(STEP, { x: 0, y: 0 }, true, { x: 600, y: 450 });
  const wait = Math.round(2.5 / STEP);
  for (let i = 0; i < wait; i += 1) {
    const events = world.step(STEP, { x: 0, y: 0 }, true, null);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it
 * and the best loot to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'start') {
    runSteps(world, 5, () => ({ x: 0, y: 0 }));
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'chase') {
    // Stand in Rook's patrol lane: he starts at (520, 120) walking east,
    // so his cone finds the thief within a second and the chase begins.
    // Freeze the frame the moment the alarm is hot and he is closing in.
    world.state.thief.x = 675;
    world.state.thief.y = 120;
    const total = Math.round(30 / STEP);
    for (let i = 0; i < total; i += 1) {
      const events = world.step(STEP, { x: 0, y: 0 }, false, null);
      const guard = world.state.guards[0];
      const dist = Math.hypot(guard.x - world.state.thief.x, guard.y - world.state.thief.y);
      if (world.state.alarm >= 60 && dist < 190) break;
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: world.state.status === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: world.state.loot };
  }
  if (name === 'win') {
    walkRoute(world, WIN_ROUTE_IN_A, 150);
    crossWithCoin(world);
    // The vault approach ignores the cameras: Rook is busy with the coin,
    // and a camera only taxes the alarm for the half-second crossing.
    walkRoute(world, WIN_ROUTE_IN_B, 120, true);
    // Stand at the pedestal until the gem cracks free.
    const crackTotal = Math.round(60 / STEP);
    for (let i = 0; i < crackTotal; i += 1) {
      const vault = world.state.lootItems.find((item) => item.kind === 'vault');
      if (vault && vault.taken) break;
      const events = world.step(STEP, { x: 0, y: 0 }, true, null);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    // Toss the second coin while still safe inside the vault, then slip
    // out the way they came in and leave through the door.
    crossWithCoin(world);
    walkRoute(world, WIN_ROUTE_OUT_A, 90, true);
    walkRoute(world, WIN_ROUTE_OUT_B, 120);
    return {
      screen: world.state.status === 'win' ? SCREEN_WIN : SCREEN_PLAY,
      best: world.state.loot,
    };
  }
  // Default: the cover — a mid-heist frame, loot in hand, cones sweeping.
  walkRoute(world, COVER_ROUTE, 120);
  return { screen: SCREEN_PLAY, best: world.state.loot };
}
