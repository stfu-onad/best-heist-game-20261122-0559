// MIDNIGHT VAULT — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between five screens: title, play, paused, win
// and game over.
//
// ?seed=N is accepted for symmetry with the kit's starter (this level is
// hand-designed, so the seed changes nothing). ?shot=cover|start|chase|win
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_COIN, EVENT_LOOT, EVENT_OVER, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

// The renderer needs the solids to paint walls and furniture; the world
// owns them, so they are handed over once at boot.
window.__solids = world.solids;
// A hook for automated playtests: the live state, read-only from outside.
window.__heist = { state: world.state, world };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now() / 1000, world.solids);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepSoundAt = 0;
  let clickTarget = null;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    clickTarget = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce('Playing. Steal the Star Sapphire, then escape through the green door.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    const total = world.state.loot + (won ? world.state.winBonus : 0);
    if (total > best) {
      best = total;
      saveBest(best);
    }
    announce(won
      ? `Clean getaway. Loot ${world.state.loot}, time bonus ${world.state.winBonus}.`
      : `Busted. ${world.state.message}`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    // A key walk beats a click walk; a click sets a target only when no
    // key is held, and reaching it (or a wall stopping progress) clears it.
    const keys = input.direction();
    let move = keys;
    if (!move && clickTarget) {
      const dx = clickTarget.x - world.state.thief.x;
      const dy = clickTarget.y - world.state.thief.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        clickTarget = null;
        window.__walkTarget = null;
      } else {
        move = { x: dx / dist, y: dy / dist };
      }
    }
    if (keys) {
      clickTarget = null;
      window.__walkTarget = null;
    }
    const coinTarget = input.takeCoinTarget();
    const events = world.step(STEP, move, input.sneaking(), coinTarget);
    const thief = world.state.thief;
    if (thief.moving && performance.now() - stepSoundAt > 340) {
      stepSoundAt = performance.now();
      audio.step();
    }
    if (events & EVENT_LOOT) {
      if (world.state.loot >= 5000) audio.vault();
      else audio.pickup();
    }
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_CAUGHT) audio.caught();
    if (world.state.alarm > 60) audio.alarmLoop(true);
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_OVER) {
      audio.lose();
      endGame(false);
    } else if (events & EVENT_CAUGHT) {
      clickTarget = null;
      window.__walkTarget = null;
      announce(`Caught! ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left. Back to the door.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // A fresh click on the floor (not on a menu) becomes a walk target.
    const target = input.clickTarget();
    if (target && screen === SCREEN_PLAY) {
      clickTarget = target;
      window.__walkTarget = target;
      input.clearClickTarget();
    } else if (target) {
      input.clearClickTarget();
    }
    if (screen === SCREEN_TITLE) {
      // The title screen idles the patrols behind its panel.
      while (accumulator >= STEP) {
        world.idle(STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now / 1000, world.solids);
  }

  // Leaving the tab pauses a running game rather than letting the alarm
  // climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Midnight Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
