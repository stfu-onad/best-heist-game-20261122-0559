// MIDNIGHT VAULT — everything the eye sees, painted on one canvas.
// The room is drawn in a fixed 1280x800 logical space and scaled to the
// window. Vision cones are painted under the walls, so a wall reads as
// cutting a cone off; loot glints, the vault gem glows, and the HUD keeps
// loot, alarm, time and lives in one bar across the top.

import { FIELD, FONT, FONT_UI, GUARD, HUD_HEIGHT, PALETTE, VAULT_CRACK_SECONDS } from './config.js';
import { EXIT, VAULT_PEDESTAL } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function money(value) {
  return `$${value.toLocaleString('en-US')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(w / FIELD.width, h / FIELD.height) * dpr;
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    return { w, h, scale: scale / dpr };
  }

  function drawFloor(t) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const tile = 64;
    for (let y = HUD_HEIGHT + 8; y < FIELD.height; y += tile) {
      for (let x = 0; x < FIELD.width; x += tile) {
        const even = ((x / tile) + (y / tile)) % 2 === 0;
        ctx.fillStyle = even ? PALETTE.floorDark : PALETTE.floorLight;
        ctx.fillRect(x, y, tile, tile);
      }
    }
    // Gold trim lines down the hall's spine and across the gallery doors.
    ctx.strokeStyle = PALETTE.floorTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 400); ctx.lineTo(420, 400);
    ctx.moveTo(436, 640); ctx.lineTo(1280, 640);
    ctx.stroke();
    // A deep red carpet from the door to the vault corridor.
    ctx.fillStyle = 'rgba(122, 32, 48, 0.55)';
    ctx.fillRect(40, 700, 40, 88);
    ctx.fillRect(40, 400, 380, 40);
    ctx.fillRect(880, 400, 40, 240);
  }

  function drawCone(x, y, angle, range, halfAngle, fill, edge) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
    ctx.stroke();
  }

  function drawWalls(solids) {
    for (const solid of solids) {
      if (solid.kind === 'wall') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(solid.x, solid.y, solid.w, Math.min(4, solid.h));
        ctx.strokeStyle = PALETTE.wallEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(solid.x + 0.5, solid.y + 0.5, solid.w - 1, solid.h - 1);
      }
    }
    // The vault door: gold bars across the vault room's entrance gap.
    ctx.fillStyle = PALETTE.goldDim;
    ctx.fillRect(900, 180, 16, 64);
    ctx.fillStyle = PALETTE.gold;
    for (let i = 0; i < 4; i += 1) ctx.fillRect(902, 186 + i * 15, 12, 5);
  }

  function drawCover(solids, t) {
    for (const solid of solids) {
      if (solid.kind !== 'cover') continue;
      ctx.fillStyle = PALETTE.cover;
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
      ctx.fillStyle = PALETTE.coverTop;
      ctx.fillRect(solid.x, solid.y, solid.w, 5);
      ctx.strokeStyle = PALETTE.coverEdge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(solid.x + 0.5, solid.y + 0.5, solid.w - 1, solid.h - 1);
      if (solid.label === 'case') {
        // Glass glint across the display case.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(solid.x + 12, solid.y + solid.h - 6);
        ctx.lineTo(solid.x + solid.w - 30, solid.y + 6);
        ctx.stroke();
      } else if (solid.label === 'statue') {
        ctx.fillStyle = PALETTE.goldDim;
        ctx.beginPath();
        ctx.arc(solid.x + solid.w / 2, solid.y + solid.h / 2, 9, 0, TAU);
        ctx.fill();
      } else if (solid.label === 'pillar') {
        ctx.fillStyle = PALETTE.wallTop;
        ctx.beginPath();
        ctx.arc(solid.x + solid.w / 2, solid.y + solid.h / 2, 13, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawLoot(state, t) {
    for (const item of state.lootItems) {
      if (item.taken) continue;
      const glint = 0.55 + 0.45 * Math.sin(t * 3 + item.x);
      if (item.kind === 'gold') {
        ctx.fillStyle = PALETTE.gold;
        for (let i = 0; i < 3; i += 1) {
          ctx.fillRect(item.x - 14 + i * 5, item.y - 6 - i * 5, 18, 8);
        }
        ctx.fillStyle = `rgba(255, 240, 180, ${glint})`;
        ctx.beginPath();
        ctx.arc(item.x, item.y - 12, 4 + 3 * glint, 0, TAU);
        ctx.fill();
      } else if (item.kind === 'art') {
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(item.x - 20, item.y - 14, 40, 28);
        ctx.fillStyle = '#3f6d8e';
        ctx.fillRect(item.x - 16, item.y - 10, 32, 14);
        ctx.fillStyle = '#c9a86a';
        ctx.fillRect(item.x - 16, item.y + 4, 32, 6);
        ctx.fillStyle = `rgba(255, 240, 180, ${glint})`;
        ctx.fillRect(item.x - 16, item.y - 10, 32, 2);
      } else if (item.kind === 'gems') {
        ctx.fillStyle = PALETTE.lootGem;
        for (const [dx, dy, r] of [[-10, 4, 6], [8, 5, 7], [0, -7, 8]]) {
          ctx.beginPath();
          ctx.moveTo(item.x + dx, item.y + dy - r);
          ctx.lineTo(item.x + dx + r, item.y + dy);
          ctx.lineTo(item.x + dx, item.y + dy + r);
          ctx.lineTo(item.x + dx - r, item.y + dy);
          ctx.closePath();
          ctx.fill();
        }
      } else if (item.kind === 'vault') {
        const pulse = 1 + 0.12 * Math.sin(t * 4);
        ctx.save();
        ctx.shadowColor = '#7df9ff';
        ctx.shadowBlur = 26;
        ctx.fillStyle = PALETTE.lootGem;
        ctx.beginPath();
        ctx.moveTo(VAULT_PEDESTAL.x, VAULT_PEDESTAL.y - 22 * pulse);
        ctx.lineTo(VAULT_PEDESTAL.x + 15 * pulse, VAULT_PEDESTAL.y);
        ctx.lineTo(VAULT_PEDESTAL.x, VAULT_PEDESTAL.y + 22 * pulse);
        ctx.lineTo(VAULT_PEDESTAL.x - 15 * pulse, VAULT_PEDESTAL.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Value tag under every loot piece.
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 12px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText(money(item.value), item.x, item.y + 30);
    }
    // The pedestal the Star Sapphire sits on.
    ctx.strokeStyle = PALETTE.goldDim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(VAULT_PEDESTAL.x, VAULT_PEDESTAL.y, 30, 0, TAU);
    ctx.stroke();
    if (state.vaultProgress > 0 && state.vaultProgress < VAULT_CRACK_SECONDS) {
      const frac = state.vaultProgress / VAULT_CRACK_SECONDS;
      ctx.strokeStyle = PALETTE.lootGem;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(VAULT_PEDESTAL.x, VAULT_PEDESTAL.y, 38, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
      ctx.stroke();
      ctx.fillStyle = PALETTE.lootGem;
      ctx.font = `600 13px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('CRACKING…', VAULT_PEDESTAL.x, VAULT_PEDESTAL.y - 46);
    }
  }

  function drawExit(t) {
    const glow = 0.5 + 0.3 * Math.sin(t * 2.5);
    ctx.fillStyle = `rgba(88, 214, 141, ${glow})`;
    ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    ctx.fillStyle = '#0c2b18';
    ctx.font = `700 13px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', EXIT.x + EXIT.w / 2, EXIT.y + 16);
    ctx.strokeStyle = PALETTE.exit;
    ctx.lineWidth = 2;
    ctx.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  }

  function drawThief(thief, t, invulnerable) {
    if (invulnerable > 0 && Math.floor(t * 10) % 2 === 0) return; // blink while safe
    ctx.save();
    ctx.translate(thief.x, thief.y);
    ctx.rotate(thief.angle);
    ctx.fillStyle = PALETTE.thiefDark;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.thief;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    // Hood point and mask band, facing the walk direction.
    ctx.fillStyle = PALETTE.thiefDark;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(2, -7);
    ctx.lineTo(2, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(4, -6, 4, 12);
    ctx.restore();
    if (thief.sneaking) {
      ctx.strokeStyle = 'rgba(57, 208, 196, 0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(thief.x, thief.y, 20, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Walk target marker, drawn by main through window state.
    const target = window.__walkTarget;
    if (target) {
      ctx.strokeStyle = 'rgba(242, 234, 216, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 6, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(target.x - 9, target.y);
      ctx.lineTo(target.x + 9, target.y);
      ctx.moveTo(target.x, target.y - 9);
      ctx.lineTo(target.x, target.y + 9);
      ctx.stroke();
    }
  }

  function drawCoins(state) {
    for (const coin of state.coins) {
      if (coin.ring <= 0) continue;
      ctx.strokeStyle = `rgba(232, 182, 76, ${coin.ring})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, (0.9 - coin.ring) * 90 + 8, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 5, 0, TAU);
      ctx.fill();
    }
  }

  function drawHud(state, screen, best) {
    ctx.fillStyle = '#0d0d18';
    ctx.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 24px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('MIDNIGHT VAULT', 16, 36);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillText('a one-room heist', 16, 50);

    // Loot.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.fillText(`LOOT  ${money(state.loot)}`, 300, 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillText(`best ${money(best)}`, 300, 48);

    // Alarm meter.
    const ax = 520;
    const aw = 230;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', ax, 22);
    ctx.fillStyle = '#262636';
    ctx.fillRect(ax, 28, aw, 14);
    const frac = state.alarm / 100;
    ctx.fillStyle = frac < 0.4 ? PALETTE.alarmLow : frac < 0.75 ? PALETTE.alarmMid : PALETTE.alarmHigh;
    ctx.fillRect(ax, 28, aw * frac, 14);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(ax + 0.5, 28.5, aw, 14);
    if (state.lockdown > 0) {
      ctx.fillStyle = PALETTE.alarmHigh;
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('LOCKDOWN!', ax + aw + 10, 41);
    }

    // Timer and lives.
    const timeText = formatTime(state.timeLeft);
    ctx.fillStyle = state.timeLeft < 60 ? PALETTE.alarmHigh : PALETTE.text;
    ctx.font = `700 22px ${FONT_UI}`;
    ctx.textAlign = 'right';
    ctx.fillText(timeText, 1000, 32);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillText('until dawn', 1000, 48);
    ctx.fillStyle = PALETTE.thief;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('◆'.repeat(Math.max(0, state.lives)), 1030, 34);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillText('lives', 1030, 48);

    // Coin hint.
    ctx.fillStyle = state.coinCooldown > 0 || state.loot < 50 ? PALETTE.muted : PALETTE.gold;
    ctx.font = `600 12px ${FONT_UI}`;
    ctx.textAlign = 'right';
    ctx.fillText(state.coinCooldown > 0 ? `coin ${Math.ceil(state.coinCooldown)}s` : 'Q: toss coin −$50', 1264, 32);
    ctx.fillText('Shift: sneak', 1264, 48);

    // Objective line under the bar.
    if (screen === SCREEN_PLAY) {
      const vault = state.lootItems.find((item) => item.kind === 'vault');
      const objective = vault && vault.taken
        ? 'Sapphire secured — reach the green EXIT door!'
        : 'Steal the Star Sapphire from the vault, then escape.';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `600 14px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText(objective, FIELD.width / 2, HUD_HEIGHT + 26);
    }
  }

  function drawBanner(text, sub, color) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = color;
    ctx.font = `700 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 20px ${FONT_UI}`;
    ctx.fillText(sub, FIELD.width / 2, 380);
  }

  function drawTitle(state, best, t) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(240, 150, 800, 480);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 58px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('MIDNIGHT VAULT', 640, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 19px ${FONT_UI}`;
    ctx.fillText('One room. Three guards. Two cameras. One sapphire.', 640, 292);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 16px ${FONT_UI}`;
    const lines = [
      'Slip past the patrols — their amber cones are their eyes.',
      'CCTV sweeps red cones across the hall. Do not linger in them.',
      'Grab loot on the way, crack the vault unseen, then reach the EXIT.',
      'Seen? The alarm climbs. Full alarm means lockdown and a chase.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 640, 340 + i * 28));
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 16px ${FONT_UI}`;
    ctx.fillText('WASD / arrows — move      Shift — sneak      Q — toss a coin (−$50)', 640, 480);
    ctx.fillText('Click the floor to walk there      P — pause', 640, 508);
    const blink = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.fillStyle = `rgba(232, 182, 76, ${blink})`;
    ctx.font = `700 22px ${FONT_UI}`;
    ctx.fillText('Press SPACE or click to start', 640, 570);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 14px ${FONT_UI}`;
      ctx.fillText(`Best loot so far: ${money(best)}`, 640, 606);
    }
  }

  function draw(state, screen, best, t, solids) {
    const { scale } = fit();
    void scale;
    drawFloor(t);
    // Cones live under the walls so a wall reads as blocking sight.
    for (const guard of state.guards) {
      drawCone(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle,
        PALETTE.guardCone, PALETTE.guardConeEdge);
    }
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, 305, 0.5, PALETTE.cameraCone, PALETTE.cameraConeEdge);
    }
    drawWalls(solids);
    drawCover(solids, t);
    drawExit(t);
    drawLoot(state, t);
    drawCoins(state);
    // Guards and cameras again for bodies and lenses (cones already painted).
    for (const guard of state.guards) {
      const sees = state.seenByGuard && Math.hypot(guard.x - state.thief.x, guard.y - state.thief.y) < GUARD.viewRange;
      if (sees) {
        ctx.strokeStyle = 'rgba(255, 90, 90, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(state.thief.x, state.thief.y);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(guard.x, guard.y);
      ctx.rotate(guard.angle);
      ctx.fillStyle = PALETTE.guardDark;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#eef1f5';
      ctx.beginPath();
      ctx.arc(9, 0, 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PALETTE.guardDark;
      ctx.fillRect(6, -9, 8, 18);
      ctx.restore();
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      if (guard.mode === 'chase') {
        ctx.fillStyle = '#ff5a5a';
        ctx.fillText('!', guard.x, guard.y - 24);
      } else if (guard.mode === 'watch' || guard.mode === 'inspect') {
        ctx.fillStyle = PALETTE.gold;
        ctx.fillText('?', guard.x, guard.y - 24);
      }
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 11px ${FONT_UI}`;
      ctx.fillText(guard.name, guard.x, guard.y + 28);
    }
    for (const camera of state.cameras) {
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.rotate(camera.angle);
      ctx.fillStyle = '#20242e';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#e05252';
      ctx.beginPath();
      ctx.arc(6, 0, 4, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#e05252';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('●', camera.x, camera.y - 12);
    }
    drawThief(state.thief, t, state.invulnerable);
    // Red vignette while spotted.
    if (state.seenByGuard || state.seenByCamera) {
      ctx.strokeStyle = 'rgba(224, 62, 62, 0.55)';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, HUD_HEIGHT + 5, FIELD.width - 10, FIELD.height - HUD_HEIGHT - 10);
      ctx.fillStyle = '#ff5a5a';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED!', FIELD.width / 2, 120);
    }
    if (state.spottedFlash > 0) {
      ctx.fillStyle = `rgba(224, 62, 62, ${state.spottedFlash * 0.18})`;
      ctx.fillRect(0, HUD_HEIGHT, FIELD.width, FIELD.height - HUD_HEIGHT);
    }
    drawHud(state, screen, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best, t);
    else if (screen === SCREEN_PAUSED) drawBanner('PAUSED', 'Press P or Space to keep stealing.', PALETTE.text);
    else if (screen === SCREEN_WIN) {
      drawBanner('CLEAN GETAWAY', `Loot ${money(state.loot)}  +  time bonus ${money(state.winBonus)}  =  ${money(state.loot + state.winBonus)}`, PALETTE.exit);
    } else if (screen === SCREEN_OVER) {
      drawBanner('BUSTED', `${state.message}  Loot kept: ${money(state.loot)}. Press Space to try again.`, PALETTE.alarmHigh);
    }
  }

  return { draw };
}
