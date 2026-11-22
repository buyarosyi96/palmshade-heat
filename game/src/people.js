import { PLAYER } from './config.js';
import { collideBuildings, clampWorld, onRoad } from './city.js';

const SHIRTS = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#e67e22','#ecf0f1','#9b59b6','#fd79a8'];
const PANTS = ['#2c3e50','#34495e','#7f8c8d','#5d4037','#1a237e'];
let nextId = 1;

export function createPed(random, x, y) {
  return { id: nextId++, x, y, angle: random() * Math.PI * 2, state: 'walk', shirt: SHIRTS[Math.floor(random() * SHIRTS.length)], pants: PANTS[Math.floor(random() * PANTS.length)], cash: 4 + Math.floor(random() * 22), targetX: x, targetY: y, wait: 0, downTime: 0, speed: 52 + random() * 34, hailFor: null };
}

export function knockDown(ped) {
  if (ped.state === 'down') return 0;
  ped.state = 'down'; ped.downTime = 5;
  const cash = ped.cash; ped.cash = 0;
  return cash;
}

export function updatePed(city, ped, dt, random, danger) {
  if (ped.state === 'down') { ped.downTime -= dt; if (ped.downTime <= 0) { ped.state = 'walk'; ped.cash = 2 + Math.floor(random() * 6); } return; }
  if (ped.state === 'riding') return;
  if (danger && Math.hypot(ped.x - danger.x, ped.y - danger.y) < 150) ped.state = 'flee';
  if (ped.state === 'hail') return;
  let tx, ty, spd = ped.speed;
  if (ped.state === 'flee') {
    const dx = ped.x - danger.x, dy = ped.y - danger.y; const d = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / d) * 120; ty = ped.y + (dy / d) * 120; spd = 148;
    if (d > 190) ped.state = 'walk';
  } else {
    if (Math.hypot(ped.targetX - ped.x, ped.targetY - ped.y) < 12 || ped.wait > 6) {
      ped.wait = 0;
      // stroll to a block corner / park-ish point nearby
      ped.targetX = Math.max(30, Math.min(3570, ped.x + (random() - 0.5) * 520));
      ped.targetY = Math.max(30, Math.min(2520, ped.y + (random() - 0.5) * 520));
    }
    ped.wait += dt;
    tx = ped.targetX; ty = ped.targetY;
  }
  const dx = tx - ped.x, dy = ty - ped.y; const d = Math.hypot(dx, dy);
  if (d > 2) {
    ped.angle = Math.atan2(dy, dx);
    let nx = ped.x + (dx / d) * spd * dt, ny = ped.y + (dy / d) * spd * dt;
    const p = collideBuildings(city, nx, ny, 11); nx = p.x; ny = p.y;
    const c = clampWorld(nx, ny, 11); ped.x = c.x; ped.y = c.y;
  }
}

export function movePlayerOnFoot(city, player, moveX, moveY, run, dt) {
  const mag = Math.hypot(moveX, moveY);
  if (mag > 0.01) {
    const spd = run ? PLAYER.run : PLAYER.walk;
    player.angle = Math.atan2(moveY, moveX);
    let nx = player.x + (moveX / mag) * spd * dt;
    let ny = player.y + (moveY / mag) * spd * dt;
    const p = collideBuildings(city, nx, ny, PLAYER.radius); nx = p.x; ny = p.y;
    const c = clampWorld(nx, ny, PLAYER.radius); player.x = c.x; player.y = c.y;
    player.moving = true;
  } else player.moving = false;
}
export { onRoad };
