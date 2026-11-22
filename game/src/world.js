// MIDNIGHT VAULT — the simulation: feet, eyes, alarm and loot.
// Guards patrol hand-set waypoints and watch a cone; a camera sweeps its
// own cone. Being seen fills the alarm meter; a full meter locks the
// museum down and every guard hunts. The thief wins by cracking the vault
// gem free and leaving through the entry door.

import {
  ALARM, CAMERA, COIN_COOLDOWN, COIN_COST, COIN_INSPECT, COIN_RADIUS,
  FIELD, GUARD, LIVES, STEP, THIEF, TIME_LIMIT, VAULT_CRACK_RANGE,
  VAULT_CRACK_SECONDS,
} from './config.js';
import { buildCameras, buildGuards, buildLoot, buildSolids, ENTRY, EXIT, VAULT_PEDESTAL } from './level.js';

export const EVENT_NONE = 0;
export const EVENT_LOOT = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_OVER = 16;
export const EVENT_ALARM = 32;
export const EVENT_COIN = 64;

const TAU = Math.PI * 2;

/** Smallest signed turn between two angles, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** True when the segment a->b crosses rectangle r (Liang-Barsky clip). */
export function segmentHitsRect(ax, ay, bx, by, r) {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, ax - r.x],
    [dx, r.x + r.w - ax],
    [-dy, ay - r.y],
    [dy, r.y + r.h - ay],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

/** True when nothing solid stands between the two points. */
export function hasLineOfSight(ax, ay, bx, by, solids) {
  for (const solid of solids) {
    if (segmentHitsRect(ax, ay, bx, by, solid)) return false;
  }
  return true;
}

/** Push a circle out of every solid it overlaps; returns true on a bump. */
export function resolveSolids(body, solids) {
  let bumped = false;
  for (const solid of solids) {
    const cx = Math.max(solid.x, Math.min(body.x, solid.x + solid.w));
    const cy = Math.max(solid.y, Math.min(body.y, solid.y + solid.h));
    let dx = body.x - cx;
    let dy = body.y - cy;
    let dist = Math.hypot(dx, dy);
    if (dist >= body.radius) continue;
    bumped = true;
    if (dist === 0) {
      // Centre inside the rectangle: shove out along the shallowest side.
      const left = body.x - solid.x;
      const right = solid.x + solid.w - body.x;
      const top = body.y - solid.y;
      const bottom = solid.y + solid.h - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) { body.x = solid.x - body.radius; }
      else if (min === right) { body.x = solid.x + solid.w + body.radius; }
      else if (min === top) { body.y = solid.y - body.radius; }
      else { body.y = solid.y + solid.h + body.radius; }
      continue;
    }
    dx /= dist;
    dy /= dist;
    body.x = cx + dx * body.radius;
    body.y = cy + dy * body.radius;
  }
  return bumped;
}

export function createWorld() {
  const solids = buildSolids();
  const state = freshState();
  let elapsed = 0;

  function freshState() {
    return {
      status: 'play',
      timeLeft: TIME_LIMIT,
      lives: LIVES,
      loot: 0,
      alarm: 0,
      lockdown: 0,
      vaultProgress: 0,
      coinCooldown: 0,
      invulnerable: 0,
      seenByGuard: false,
      seenByCamera: false,
      spottedFlash: 0,
      winBonus: 0,
      thief: { x: ENTRY.x, y: ENTRY.y, angle: -Math.PI / 2, moving: false, sneaking: false, radius: THIEF.radius },
      guards: buildGuards().map((g) => ({
        id: g.id, name: g.name,
        x: g.waypoints[0].x, y: g.waypoints[0].y,
        angle: 0, waypoint: 1, speedFactor: g.speedFactor, radius: GUARD.radius,
        mode: 'patrol', modeTime: 0, hold: 0, lastSeen: null, inspect: null,
        waypoints: g.waypoints,
      })),
      cameras: buildCameras().map((c) => ({ ...c, angle: c.baseAngle })),
      lootItems: buildLoot().map((item) => ({ ...item, taken: false })),
      coins: [],
      message: '',
    };
  }

  function reset() {
    const next = freshState();
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
    elapsed = 0;
  }

  /** Can this watcher see the thief right now? */
  function canSee(watcher, range, halfAngle) {
    const thief = state.thief;
    const dx = thief.x - watcher.x;
    const dy = thief.y - watcher.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return false;
    if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), watcher.angle)) > halfAngle) return false;
    return hasLineOfSight(watcher.x, watcher.y, thief.x, thief.y, solids);
  }

  function moveBody(body, vx, vy, dt) {
    body.x += vx * dt;
    body.y += vy * dt;
    body.x = Math.max(body.radius, Math.min(FIELD.width - body.radius, body.x));
    body.y = Math.max(64 + body.radius, Math.min(FIELD.height - body.radius, body.y));
    resolveSolids(body, solids);
  }

  function moveToward(body, tx, ty, speed, dt) {
    const dx = tx - body.x;
    const dy = ty - body.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const step = Math.min(dist, speed * dt);
    moveBody(body, (dx / dist) * step / dt, (dy / dist) * step / dt, dt);
    body.angle = Math.atan2(dy, dx);
    return dist <= step + 0.5;
  }

  function throwCoin(mx, my) {
    if (state.coinCooldown > 0 || state.loot < COIN_COST || state.status !== 'play') return false;
    state.loot -= COIN_COST;
    state.coinCooldown = COIN_COOLDOWN;
    const coin = { x: mx, y: my, ring: 0.9 };
    state.coins.push(coin);
    for (const guard of state.guards) {
      if (Math.hypot(guard.x - coin.x, guard.y - coin.y) <= COIN_RADIUS) {
        guard.mode = 'inspect';
        guard.modeTime = 0;
        guard.inspect = { x: coin.x, y: coin.y };
        guard.lastSeen = null;
      }
    }
    return true;
  }

  /** Advance the world one fixed step. `move` is {x, y} or null; `sneak` a bool. */
  function step(dt, move, sneak, coinTarget) {
    if (state.status !== 'play') return EVENT_NONE;
    let events = EVENT_NONE;
    elapsed += dt;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.status = 'over';
      state.message = 'Dawn broke — the vault sealed with you inside.';
      return EVENT_OVER;
    }
    if (state.coinCooldown > 0) state.coinCooldown -= dt;
    if (state.invulnerable > 0) state.invulnerable -= dt;
    if (state.spottedFlash > 0) state.spottedFlash -= dt;
    for (const coin of state.coins) coin.ring = Math.max(0, coin.ring - dt);

    // --- the thief -------------------------------------------------------
    const thief = state.thief;
    thief.sneaking = !!sneak;
    const speed = sneak ? THIEF.sneakSpeed : THIEF.speed;
    thief.moving = false;
    if (move && (move.x !== 0 || move.y !== 0)) {
      const len = Math.hypot(move.x, move.y);
      const before = { x: thief.x, y: thief.y };
      moveBody(thief, (move.x / len) * speed, (move.y / len) * speed, dt);
      thief.moving = Math.hypot(thief.x - before.x, thief.y - before.y) > 0.01;
      if (thief.moving) thief.angle = Math.atan2(move.y, move.x);
    }
    if (coinTarget) {
      if (throwCoin(coinTarget.x, coinTarget.y)) events |= EVENT_COIN;
    }

    // --- cameras sweep ----------------------------------------------------
    for (const camera of state.cameras) {
      camera.angle = camera.baseAngle
        + camera.sweepAxis * CAMERA.sweepHalfAngle * Math.sin((TAU * elapsed) / CAMERA.sweepPeriod);
    }

    // --- who sees the thief? ----------------------------------------------
    const range = thief.sneaking ? GUARD.viewRange * THIEF.sneakRangeFactor : GUARD.viewRange;
    let seenGuard = false;
    let seenCamera = false;
    for (const guard of state.guards) {
      if (canSee(guard, range, GUARD.viewHalfAngle)) seenGuard = true;
    }
    for (const camera of state.cameras) {
      if (canSee(camera, CAMERA.viewRange, CAMERA.viewHalfAngle)) seenCamera = true;
    }
    const wasSeen = state.seenByGuard || state.seenByCamera;
    state.seenByGuard = seenGuard;
    state.seenByCamera = seenCamera;
    if ((seenGuard || seenCamera) && !wasSeen) {
      state.spottedFlash = 0.6;
      events |= EVENT_SPOTTED;
    }

    // --- alarm ------------------------------------------------------------
    if (state.lockdown > 0) {
      state.lockdown -= dt;
      state.alarm = ALARM.max;
      if (state.lockdown <= 0) state.alarm = 50;
    } else if (seenGuard) {
      state.alarm = Math.min(ALARM.max, state.alarm + GUARD.spotRate * dt);
    } else if (seenCamera) {
      state.alarm = Math.min(ALARM.max, state.alarm + CAMERA.spotRate * dt);
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.decayRate * dt);
    }
    if (state.alarm >= ALARM.max && state.lockdown <= 0) {
      state.lockdown = ALARM.lockdownSeconds;
      events |= EVENT_ALARM;
      for (const guard of state.guards) {
        guard.mode = 'chase';
        guard.modeTime = 0;
        guard.lastSeen = { x: thief.x, y: thief.y };
      }
    }

    // --- guards think ------------------------------------------------------
    for (const guard of state.guards) {
      guard.modeTime += dt;
      const sees = canSee(guard, range, GUARD.viewHalfAngle);
      if (sees) {
        guard.lastSeen = { x: thief.x, y: thief.y };
        if (guard.mode !== 'chase' && state.alarm >= GUARD.chaseAlarm) {
          guard.mode = 'chase';
          guard.modeTime = 0;
        } else if (guard.mode === 'patrol') {
          guard.mode = 'watch';
          guard.modeTime = 0;
        }
      }
      if (guard.mode === 'patrol') {
        const target = guard.waypoints[guard.waypoint];
        if (moveToward(guard, target.x, target.y, GUARD.patrolSpeed * guard.speedFactor, dt)) {
          guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
        }
      } else if (guard.mode === 'watch') {
        guard.angle = Math.atan2(thief.y - guard.y, thief.x - guard.x);
        if (guard.hold > 0) {
          guard.hold -= dt;
        } else if (!sees && guard.modeTime > 1.2) {
          guard.mode = 'patrol';
          guard.modeTime = 0;
        } else if (sees && state.alarm >= GUARD.chaseAlarm) {
          guard.mode = 'chase';
          guard.modeTime = 0;
        }
      } else if (guard.mode === 'chase') {
        const target = guard.lastSeen ?? { x: thief.x, y: thief.y };
        moveToward(guard, target.x, target.y, GUARD.chaseSpeed, dt);
        if (!sees && guard.modeTime > GUARD.huntTime) {
          guard.mode = 'patrol';
          guard.modeTime = 0;
          guard.lastSeen = null;
        }
      } else if (guard.mode === 'inspect' && guard.inspect) {
        if (moveToward(guard, guard.inspect.x, guard.inspect.y, GUARD.patrolSpeed * 1.4, dt)) {
          guard.mode = 'watch';
          guard.modeTime = 0;
          guard.hold = COIN_INSPECT;
          guard.inspect = null;
        }
        if (sees && state.alarm >= GUARD.chaseAlarm) {
          guard.mode = 'chase';
          guard.modeTime = 0;
        }
      }
      // A guard close enough catches the thief, unless freshly respawned.
      if (state.invulnerable <= 0 && Math.hypot(guard.x - thief.x, guard.y - thief.y) < GUARD.catchDistance) {
        state.lives -= 1;
        events |= EVENT_CAUGHT;
        if (state.lives <= 0) {
          state.status = 'over';
          state.message = 'Caught red-handed under the skylight.';
          return events | EVENT_OVER;
        }
        thief.x = ENTRY.x;
        thief.y = ENTRY.y;
        state.invulnerable = 2.5;
        state.alarm = 40;
        state.lockdown = 0;
        state.vaultProgress = 0;
        for (const other of state.guards) {
          other.mode = 'patrol';
          other.modeTime = 0;
          other.lastSeen = null;
          other.inspect = null;
          other.x = other.waypoints[0].x;
          other.y = other.waypoints[0].y;
          other.waypoint = 1;
        }
        return events;
      }
    }

    // --- loot ---------------------------------------------------------------
    for (const item of state.lootItems) {
      if (item.taken || item.kind === 'vault') continue;
      if (Math.hypot(item.x - thief.x, item.y - thief.y) < 34) {
        item.taken = true;
        state.loot += item.value;
        events |= EVENT_LOOT;
      }
    }

    // --- the vault gem: crack it standing close, unseen ----------------------
    const vault = state.lootItems.find((item) => item.kind === 'vault');
    if (vault && !vault.taken) {
      const near = Math.hypot(VAULT_PEDESTAL.x - thief.x, VAULT_PEDESTAL.y - thief.y) < VAULT_CRACK_RANGE;
      if (near && !seenGuard && !seenCamera) {
        state.vaultProgress += dt;
        if (state.vaultProgress >= VAULT_CRACK_SECONDS) {
          vault.taken = true;
          state.loot += vault.value;
          state.vaultProgress = VAULT_CRACK_SECONDS;
          events |= EVENT_LOOT;
        }
      } else if (state.vaultProgress > 0) {
        state.vaultProgress = Math.max(0, state.vaultProgress - dt * 0.5);
      }
    }

    // --- escape ---------------------------------------------------------------
    if (vault && vault.taken
      && thief.x > EXIT.x - 10 && thief.x < EXIT.x + EXIT.w + 10
      && thief.y > EXIT.y - 14 && thief.y < EXIT.y + EXIT.h + 14) {
      state.status = 'win';
      state.winBonus = Math.round(state.timeLeft) * 10;
      state.message = 'Clean getaway.';
      return events | EVENT_WIN;
    }
    return events;
  }

  /**
   * Idle motion behind the title screen: cameras sweep and guards walk
   * their patrols, but the clock, the alarm and the loot never move.
   */
  function idle(dt) {
    elapsed += dt;
    for (const camera of state.cameras) {
      camera.angle = camera.baseAngle
        + camera.sweepAxis * CAMERA.sweepHalfAngle * Math.sin((TAU * elapsed) / CAMERA.sweepPeriod);
    }
    for (const guard of state.guards) {
      if (guard.mode !== 'patrol') continue;
      const target = guard.waypoints[guard.waypoint];
      if (moveToward(guard, target.x, target.y, GUARD.patrolSpeed * guard.speedFactor, dt)) {
        guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
      }
    }
  }

  return { state, solids, reset, step, idle, throwCoin, hasLineOfSight: (ax, ay, bx, by) => hasLineOfSight(ax, ay, bx, by, solids) };
}
