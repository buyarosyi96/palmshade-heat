import { WORLD, ROAD_W, STREETS_X, AVENUES_Y, BEACH_Y, WATER_Y } from './config.js';

export const ALL_X = [64, ...STREETS_X, 3536];
export const ALL_Y = [64, ...AVENUES_Y, 2548];

const ROOFS = [['#c96f4a','#8a4a32'],['#d9a441','#9a742e'],['#7fb3b0','#527a78'],['#b85c5c','#7e3c3c'],['#e0d6c2','#a89a80'],['#6a8caf','#46617e'],['#c2b280','#8f835e'],['#9b7eb8','#6b5484']];
const WALLS = ['#e8dcc8','#d8c8ae','#f0e6d2','#cbbfa5'];

function intervals(centers, max) {
  const out = [];
  let start = 0;
  for (const c of centers) { out.push([start, c - ROAD_W / 2]); start = c + ROAD_W / 2; }
  out.push([start, max]);
  return out;
}

const LANDMARK_DEFS = [
  ['safehouse', 0, 0, "Dante's Safehouse"],
  ['hotel', 3, 0, 'Hotel Solano'],
  ['diner', 1, 1, 'Palms Diner'],
  ['bank', 2, 1, 'Banco Palmshade'],
  ['station', 0, 2, 'Palmshade PD'],
  ['gallery', 2, 2, 'Solano Gallery'],
  ['club', 4, 2, 'Club Sirena'],
  ['marina', 4, 3, 'Marina Azul'],
  ['detail', 3, 3, 'Turbo Detail'],
];

export function buildCity(random) {
  const xInts = intervals(STREETS_X, WORLD.w);
  const yInts = intervals(AVENUES_Y, WORLD.h);
  const buildings = [];
  const blocks = [];
  const parks = [];
  const lots = [];
  const landmarkMap = {};
  for (const [id, col, row, name] of LANDMARK_DEFS) landmarkMap[col + ',' + row] = { id, name };
  const parkKeys = new Set(['5,1', '1,3']);
  const lotKeys = new Set(['4,1', '0,3', '5,3']);
  let bid = 0;
  for (let row = 0; row < yInts.length; row++) {
    for (let col = 0; col < xInts.length; col++) {
      const [x0, x1] = xInts[col]; const [y0, y1] = yInts[row];
      const key = col + ',' + row;
      const block = { col, row, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      blocks.push(block);
      if (row >= 5) continue; // beach strip handled separately
      if (parkKeys.has(key)) { parks.push({ ...block, trees: [] }); continue; }
      if (lotKeys.has(key)) { lots.push({ ...block, bays: [] }); continue; }
      const inset = 20;
      const bx = x0 + inset, by = y0 + inset, bw = (x1 - x0) - inset * 2, bh = (y1 - y0) - inset * 2;
      if (bw < 60 || bh < 60) continue;
      const lm = landmarkMap[key];
      if (lm) {
        const w = Math.min(bw * 0.72, 300), h = Math.min(bh * 0.62, 190);
        const b = { id: bid++, x: bx + (bw - w) / 2, y: by + (bh - h) / 2, w, h, roof: ROOFS[bid % ROOFS.length][0], roofDark: ROOFS[bid % ROOFS.length][1], wall: WALLS[bid % WALLS.length], landmark: lm.id, name: lm.name, ac: 2 };
        b.doorX = b.x + b.w / 2; b.doorY = b.y + b.h + 16;
        buildings.push(b);
      } else {
        const n = 1 + Math.floor(random() * 4);
        const cols = n <= 2 ? n : 2, rows = n <= 2 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const cw = bw / cols, ch = bh / rows;
          const cx = bx + (i % cols) * cw, cy = by + Math.floor(i / cols) * ch;
          const pad = 10;
          const pal = ROOFS[Math.floor(random() * ROOFS.length)];
          buildings.push({ id: bid++, x: cx + pad, y: cy + pad, w: cw - pad * 2, h: ch - pad * 2, roof: pal[0], roofDark: pal[1], wall: WALLS[Math.floor(random() * WALLS.length)], landmark: null, name: null, ac: Math.floor(random() * 3) });
        }
      }
    }
  }
  // parks trees
  for (const p of parks) {
    for (let i = 0; i < 10; i++) p.trees.push({ x: p.x + 30 + random() * (p.w - 60), y: p.y + 30 + random() * (p.h - 60), r: 12 + random() * 10 });
  }
  for (const l of lots) {
    for (let x = l.x + 28; x < l.x + l.w - 40; x += 58) for (let y = l.y + 24; y < l.y + l.h - 30; y += 44) l.bays.push({ x, y });
  }
  // beach huts and palms south of Shore Drive
  const beach = { y: BEACH_Y, waterY: WATER_Y, huts: [], palms: [] };
  for (let x = 160; x < WORLD.w - 100; x += 260) beach.huts.push({ x: x + random() * 60, y: BEACH_Y + 14 + random() * 30, w: 54, h: 34 });
  for (let i = 0; i < 46; i++) beach.palms.push({ x: 40 + random() * (WORLD.w - 80), y: 2460 + random() * 170, s: 0.8 + random() * 0.5 });
  // scattered palms in city
  const palms = [];
  for (let i = 0; i < 40; i++) palms.push({ x: 40 + random() * (WORLD.w - 80), y: 40 + random() * 2350, s: 0.7 + random() * 0.5 });
  const landmarks = {};
  for (const b of buildings) if (b.landmark) landmarks[b.landmark] = { id: b.landmark, name: b.name, x: b.x + b.w / 2, y: b.y + b.h / 2, doorX: b.doorX, doorY: b.doorY, building: b };
  const diner = landmarks.diner;
  const garage = { id: 'garage', name: 'Garage', x: diner.doorX + 150, y: diner.doorY + 30, doorX: diner.doorX + 150, doorY: diner.doorY + 30 };
  return { buildings, blocks, parks, lots, beach, palms, landmarks, garage, xInts, yInts };
}

export function onRoad(city, x, y) {
  for (const sx of STREETS_X) if (Math.abs(x - sx) < ROAD_W / 2) return true;
  for (const ay of AVENUES_Y) if (Math.abs(y - ay) < ROAD_W / 2) return true;
  if (x < ROAD_W / 2 || x > WORLD.w - ROAD_W / 2 || y < ROAD_W / 2) return true;
  if (Math.abs(y - 2548) < ROAD_W / 2) return true;
  return false;
}

export function collideBuildings(city, x, y, r) {
  let px = x, py = y;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(px, b.x + b.w));
    const ny = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - nx, dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.001) { const d = Math.sqrt(d2); px = nx + (dx / d) * r; py = ny + (dy / d) * r; }
      else { // inside: push out nearest side
        const left = px - b.x, right = b.x + b.w - px, top = py - b.y, bot = b.y + b.h - py;
        const m = Math.min(left, right, top, bot);
        if (m === left) px = b.x - r; else if (m === right) px = b.x + b.w + r; else if (m === top) py = b.y - r; else py = b.y + b.h + r;
      }
    }
  }
  return { x: px, y: py };
}

export function clampWorld(x, y, r) {
  return { x: Math.max(r, Math.min(WORLD.w - r, x)), y: Math.max(r, Math.min(WORLD.h - r, y)) };
}

export function intersections() {
  const out = [];
  for (const x of STREETS_X) for (const y of AVENUES_Y) out.push({ x, y });
  return out;
}
