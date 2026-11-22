import { POLICE_BY_WANTED, WANTED_DECAY_SECONDS, WORLD } from './config.js';
import { createCar, driveCar, moveCar, policeControl } from './vehicles.js';

export function createWanted() { return { stars: 0, heat: 0, quietTime: 0, locked: 0 }; }

export function reportCrime(wanted, severity) {
  wanted.heat += severity;
  wanted.quietTime = 0;
  let s = wanted.stars;
  if (wanted.heat >= 1) s = Math.max(s, 1);
  if (wanted.heat >= 3) s = Math.max(s, 2);
  if (wanted.heat >= 6) s = Math.max(s, 3);
  if (wanted.heat >= 10) s = Math.max(s, 4);
  if (wanted.heat >= 15) s = Math.max(s, 5);
  wanted.stars = Math.min(5, Math.max(s, wanted.locked));
}

export function setWantedFloor(wanted, floor) {
  wanted.locked = Math.max(wanted.locked, floor);
  wanted.stars = Math.max(wanted.stars, floor);
  if (floor > 0 && wanted.heat < floor) wanted.heat = floor;
}
export function clearWantedLock(wanted) { wanted.locked = 0; }

export function updateWanted(wanted, dt, anyCopNear) {
  if (anyCopNear) { wanted.quietTime = 0; return; }
  wanted.quietTime += dt;
  if (wanted.stars > wanted.locked && wanted.quietTime > WANTED_DECAY_SECONDS / Math.max(1, wanted.stars)) {
    wanted.stars -= 1; wanted.heat = Math.max(0, wanted.heat - 2); wanted.quietTime = 0;
    if (wanted.stars === 0) wanted.heat = 0;
  }
  if (wanted.stars <= wanted.locked) wanted.stars = wanted.locked;
}

export function updatePolice(state, dt, random) {
  const want = POLICE_BY_WANTED[state.wanted.stars] || 0;
  let cops = state.cars.filter(c => c.kind === 'police');
  // remove far cops when wanted drops
  if (cops.length > want) {
    const px = state.player.car ? state.player.car.x : state.player.x;
    const py = state.player.car ? state.player.car.y : state.player.y;
    cops.sort((a, b) => Math.hypot(b.x - px, b.y - py) - Math.hypot(a.x - px, a.y - py));
    const remove = cops.slice(0, cops.length - want);
    state.cars = state.cars.filter(c => !remove.includes(c));
    cops = state.cars.filter(c => c.kind === 'police');
  }
  while (cops.length < want) {
    const station = state.city.landmarks.station;
    let x, y;
    if (cops.length === 0 && station) { x = station.doorX; y = station.doorY + 20; }
    else {
      const edge = Math.floor(random() * 4);
      const px = state.player.x, py = state.player.y;
      if (edge === 0) { x = Math.max(40, px - 620); y = py + (random() - 0.5) * 400; }
      else if (edge === 1) { x = Math.min(WORLD.w - 40, px + 620); y = py + (random() - 0.5) * 400; }
      else if (edge === 2) { x = px + (random() - 0.5) * 400; y = Math.max(40, py - 620); }
      else { x = px + (random() - 0.5) * 400; y = Math.min(WORLD.h - 40, py + 620); }
    }
    const car = createCar(random, x, y, random() * Math.PI * 2, 'police');
    state.cars.push(car); cops.push(car);
  }
  let anyNear = false;
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  for (const cop of cops) {
    const ctrl = policeControl(state.city, cop, state.player, dt);
    driveCar(state.city, cop, ctrl, dt);
    moveCar(state.city, cop);
    if (Math.hypot(cop.x - px, cop.y - py) < 340) anyNear = true;
  }
  state.copNear = anyNear;
  return anyNear;
}

export function updateBust(state, dt) {
  const p = state.player;
  if (p.car || state.wanted.stars === 0) { state.bustProgress = 0; return false; }
  let close = false;
  for (const c of state.cars) if (c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 62 && Math.abs(c.speed || 0) < 55) close = true;
  if (close) {
    state.bustProgress = (state.bustProgress || 0) + dt;
    if (state.bustProgress >= 1.1) return true;
  } else state.bustProgress = Math.max(0, (state.bustProgress || 0) - dt * 1.5);
  return false;
}
