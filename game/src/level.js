// MIDNIGHT VAULT — the museum floor, designed by hand.
// One room the thief crosses: a west gallery, a central hall, a north
// gallery, a south store and the vault in the north-east corner. The
// partitions leave three ways through the building so a route can always
// be picked around a sweeping cone.
//
// Coordinates are in the 1280x800 logical field. The HUD occupies the top
// 56 px; the room itself runs from y=64 to y=792 inside a 12 px outer wall.

import { FIELD, HUD_HEIGHT, VAULT_VALUE } from './config.js';

const WALL = 12;
const TOP = HUD_HEIGHT + 8;
const BOTTOM = FIELD.height - WALL;
const LEFT = WALL;
const RIGHT = FIELD.width - WALL;

/** Every solid rectangle: walls and furniture alike block feet and sight. */
export function buildSolids() {
  const solids = [];
  const wall = (x, y, w, h) => solids.push({ x, y, w, h, kind: 'wall' });
  const cover = (x, y, w, h, label) => solids.push({ x, y, w, h, kind: 'cover', label });

  // Outer shell.
  wall(0, TOP - WALL, FIELD.width, WALL); // north
  wall(0, BOTTOM, FIELD.width, WALL); // south
  wall(0, TOP - WALL, WALL, BOTTOM - TOP + WALL * 2); // west
  wall(RIGHT, TOP - WALL, WALL, BOTTOM - TOP + WALL * 2); // east

  // West gallery partition: door gap y 400..500.
  wall(420, TOP, 16, 400 - TOP);
  wall(420, 500, 16, BOTTOM - 500);
  // North gallery partition: door gap x 700..800.
  wall(436, 300, 700 - 436, 16);
  wall(800, 300, 916 - 800, 16);
  // Vault west wall: door gap y 180..244.
  wall(900, TOP, 16, 180 - TOP);
  wall(900, 244, 16, 300 - 244);
  // Vault south wall (the vault room is x 916..1268, y 64..300).
  wall(900, 300, RIGHT - 900, 16);
  // South store partition: door gap x 300..400.
  wall(64, 560, 300 - 64, 16);
  wall(400, 560, 560 - 400, 16);

  // Furniture the thief hides behind. Display cases, pillars, tables.
  cover(150, 150, 180, 42, 'case'); // west gallery display case
  cover(150, 640, 180, 42, 'case'); // south-west display case
  cover(560, 620, 210, 48, 'table'); // central hall long table
  cover(950, 620, 52, 52, 'crate'); // east corridor crates
  cover(1014, 620, 52, 52, 'crate');
  cover(600, 180, 38, 38, 'pillar'); // hall pillars
  cover(760, 430, 38, 38, 'pillar');
  cover(600, 660, 38, 38, 'pillar');
  cover(250, 420, 44, 44, 'statue'); // west gallery statue plinth
  cover(1050, 430, 44, 44, 'statue'); // east corridor statue plinth
  return solids;
}

/** Loot on the floor: id, position, dollars, and what the renderer draws. */
export function buildLoot() {
  return [
    { id: 'gold-west', x: 360, y: 170, value: 250, kind: 'gold', label: 'Gold bars' },
    { id: 'gold-hall', x: 700, y: 700, value: 250, kind: 'gold', label: 'Gold bars' },
    { id: 'gold-east', x: 1080, y: 500, value: 250, kind: 'gold', label: 'Gold bars' },
    { id: 'art-south', x: 120, y: 700, value: 400, kind: 'art', label: 'Portrait' },
    { id: 'art-north', x: 850, y: 120, value: 400, kind: 'art', label: 'Portrait' },
    { id: 'gems', x: 620, y: 380, value: 800, kind: 'gems', label: 'Gem case' },
    { id: 'vault-gem', x: 1150, y: 165, value: VAULT_VALUE, kind: 'vault', label: 'Star Sapphire' },
  ];
}

/** Guards: name, patrol waypoints (a loop), and patrol speed factor. */
export function buildGuards() {
  return [
    {
      id: 'rook', name: 'Rook',
      waypoints: [
        { x: 520, y: 120 }, { x: 830, y: 120 }, { x: 830, y: 500 }, { x: 520, y: 500 },
      ],
      speedFactor: 1.0,
    },
    {
      id: 'bishop', name: 'Bishop',
      waypoints: [
        { x: 120, y: 120 }, { x: 280, y: 120 }, { x: 280,  y: 700 }, { x: 120, y: 700 },
      ],
      speedFactor: 0.95,
    },
    {
      id: 'knight', name: 'Knight',
      waypoints: [
        { x: 1000, y: 360 }, { x: 1000, y: 720 }, { x: 1200, y: 720 }, { x: 1200, y: 360 },
      ],
      speedFactor: 1.1,
    },
  ];
}

/** CCTV cameras: wall mount, resting aim, and which way they sweep. */
export function buildCameras() {
  return [
    { id: 'cam-north', x: 880, y: 72, baseAngle: Math.PI / 2, sweepAxis: 1 },
    { id: 'cam-east', x: 1264, y: 480, baseAngle: Math.PI, sweepAxis: -1 },
  ];
}

/** Where the thief slips in, and the door they must leave through. */
export const ENTRY = { x: 75, y: 742 };
export const EXIT = { x: 75, y: 770, w: 70, h: 22 };

/** The vault pedestal the Star Sapphire sits on. */
export const VAULT_PEDESTAL = { x: 1150, y: 165 };
