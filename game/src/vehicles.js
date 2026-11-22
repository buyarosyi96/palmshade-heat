import { CAR, LANE, STREETS_X, AVENUES_Y, WORLD } from './config.js';
import { collideBuildings, clampWorld, ALL_X, ALL_Y } from './city.js';

export const CIVIL_COLORS = ['#e74c3c','#f1c40f','#3498db','#2ecc71','#e67e22','#ecf0f1','#9b59b6','#1abc9c','#fd79a8','#95a5a6','#f39c12','#00cec9'];

let nextId = 1;
export function createCar(random, x, y, angle, kind) {
  const color = kind === 'police' ? '#ecf0f1' : CIVIL_COLORS[Math.floor(random() * CIVIL_COLORS.length)];
  return { id: nextId++, x, y, angle: angle || 0, vx: 0, vy: 0, speed: 0, kind: kind || 'traffic', color, w: CAR.w, h: CAR.h, radius: CAR.radius, damage: 0, driver: true, steerVis: 0, targetX: x, targetY: y, stuck: 0, lastX: x, lastY: y, sirenPhase: Math.random() * 6 };
}

function nearestLine(lines, v, dir) {
  let best = null, bd = 1e9;
  for (const l of lines) { const d = (l - v) * dir; if (d > 30 && d < bd) { bd = d; best = l; } }
  if (best === null) { for (const l of lines) { const d = Math.abs(l - v); if (d < bd) { bd = d; best = l; } } }
  return best;
}

export function trafficControl(city, car, cars, dt, random) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const speed = car.speed;
  // decide target intersection ahead
  const horizontal = Math.abs(fx) > Math.abs(fy);
  let tx, ty;
  if (horizontal) {
    const dir = fx >= 0 ? 1 : -1;
    const nx = nearestLine(ALL_X, car.x, dir);
    tx = nx; ty = car.y;
    // lane offset: right-hand side
    ty = laneCenterY(car, dir);
    tx = nx;
  } else {
    const dir = fy >= 0 ? 1 : -1;
    const ny = nearestLine(ALL_Y, car.y, dir);
    ty = ny; tx = laneCenterX(car, dir);
  }
  // near intersection: maybe turn
  const distToTarget = Math.hypot(tx - car.x, ty - car.y);
  if (distToTarget < 60 && !car.turnCooldown) {
    car.turnCooldown = 2.5;
    if (random() < 0.38) car.turning = true; else car.turning = false;
  }
  if (car.turnCooldown) car.turnCooldown = Math.max(0, car.turnCooldown - dt);
  if (car.turning && distToTarget < 34) {
    // turn: aim perpendicular
    if (horizontal) { const dir = fy >= 0 ? 1 : -1; ty = nearestLine(ALL_Y, car.y, random() < 0.5 ? 1 : -1); tx = car.x; }
    else { tx = nearestLine(ALL_X, car.x, random() < 0.5 ? 1 : -1); ty = car.y; }
    if (distToTarget < 12) car.turning = false;
  }
  car.targetX = tx; car.targetY = ty;
  // slow for car ahead
  let throttle = 0.75;
  for (const o of cars) {
    if (o === car) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (ahead > 0 && ahead < 78 && side < 22) { throttle = ahead < 42 ? -0.4 : 0.15; break; }
  }
  // unstuck
  car.stuck += dt;
  if (car.stuck > 1.2) {
    const moved = Math.hypot(car.x - car.lastX, car.y - car.lastY);
    car.lastX = car.x; car.lastY = car.y; car.stuck = 0;
    if (moved < 4 && Math.abs(speed) > 1) car.unstick = 0.7;
    else if (moved < 2) car.unstick = (car.unstick || 0) > 0 ? car.unstick : 0.5;
  }
  if (car.unstick > 0) { car.unstick -= dt; return { throttle: -0.8, steer: 0.6, handbrake: false }; }
  const desired = Math.atan2(ty - car.y, tx - car.x);
  let diff = normAngle(desired - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  if (Math.abs(speed) > 150) throttle = Math.min(throttle, 0.25);
  return { throttle, steer, handbrake: false };
}

function laneCenterY(car, dirX) {
  // find nearest avenue centre, offset to right side of travel
  let best = AVENUES_Y[0], bd = 1e9;
  for (const y of [...AVENUES_Y, 2548]) { const d = Math.abs(y - car.y); if (d < bd) { bd = d; best = y; } }
  return best + (dirX > 0 ? LANE : -LANE);
}
function laneCenterX(car, dirY) {
  let best = STREETS_X[0], bd = 1e9;
  for (const x of STREETS_X) { const d = Math.abs(x - car.x); if (d < bd) { bd = d; best = x; } }
  return best + (dirY > 0 ? -LANE : LANE);
}

export function policeControl(city, car, player, dt) {
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const pvx = player.car ? player.car.vx : 0, pvy = player.car ? player.car.vy : 0;
  const tx = px + pvx * 0.45, ty = py + pvy * 0.45;
  car.targetX = tx; car.targetY = ty;
  car.stuck += dt;
  if (car.stuck > 1.1) {
    const moved = Math.hypot(car.x - car.lastX, car.y - car.lastY);
    car.lastX = car.x; car.lastY = car.y; car.stuck = 0;
    if (moved < 5) car.unstick = 0.65;
  }
  if (car.unstick > 0) { car.unstick -= dt; return { throttle: -1, steer: -0.7, handbrake: false }; }
  const desired = Math.atan2(ty - car.y, tx - car.x);
  let diff = normAngle(desired - car.angle);
  let throttle = 1;
  if (Math.abs(diff) > 2.4) throttle = -0.7;
  const dist = Math.hypot(tx - car.x, ty - car.y);
  if (dist < 46 && !player.car) throttle = 0.1;
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.4)), handbrake: false };
}

export function normAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export function driveCar(city, car, input, dt) {
  const throttle = input.throttle || 0, steer = input.steer || 0;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let speed = car.speed || 0;
  if (throttle > 0) speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (speed > 8) speed -= CAR.brake * dt;
    else speed = Math.max(-CAR.reverseMax, speed + CAR.accel * throttle * dt * 0.8);
  }
  if (input.handbrake) speed -= speed * 3.2 * dt;
  speed -= speed * CAR.drag * dt;
  if (!throttle) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 28 * dt);
  const maxF = car.kind === 'police' ? 335 : 265;
  speed = Math.max(-CAR.reverseMax, Math.min(maxF, speed));
  const steerAuthority = Math.min(1, Math.abs(speed) / 55) * (speed < 0 ? -1 : 1);
  car.angle += steer * 1.95 * steerAuthority * dt * (car.kind === 'police' ? 1.15 : 1);
  car.steerVis = steer;
  car.speed = speed;
  car.vx = Math.cos(car.angle) * speed; car.vy = Math.sin(car.angle) * speed;
  car.x += car.vx * dt; car.y += car.vy * dt;
}

export function moveCar(city, car) {
  const p = collideBuildings(city, car.x, car.y, car.radius);
  if (p.x !== car.x || p.y !== car.y) { car.speed *= 0.55; car.damage = Math.min(100, car.damage + 1); }
  car.x = p.x; car.y = p.y;
  const c = clampWorld(car.x, car.y, car.radius);
  car.x = c.x; car.y = c.y;
}

export function collideCars(cars, effects) {
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy), min = a.radius + b.radius;
    if (d > 0 && d < min) {
      const push = (min - d) / 2, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      const impact = Math.abs((a.speed || 0) - (b.speed || 0));
      if (impact > 55) {
        a.damage = Math.min(100, a.damage + 4); b.damage = Math.min(100, b.damage + 4);
        effects.push({ type: 'spark', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, life: 0.28 });
        const s = (a.speed || 0); a.speed = (b.speed || 0) * 0.6; b.speed = s * 0.6;
      }
    }
  }
}
