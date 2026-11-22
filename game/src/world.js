import { STREETS_X, AVENUES_Y } from './config.js';
import { buildCity, onRoad } from './city.js';
import { createCar, trafficControl, driveCar, moveCar, collideCars } from './vehicles.js';
import { createPed, updatePed, movePlayerOnFoot, knockDown } from './people.js';
import { createWanted, updateWanted, updatePolice, updateBust, reportCrime } from './police.js';
import { punch, shoot, updateBullets, runOverCheck } from './combat.js';
import { createMissionState, updateMissions, createTaxiState, updateTaxi } from './missions.js';
import { ACTION_ENTER_CAR, ACTION_PUNCH } from './input.js';
import { atSavePoint, storeSave } from './save.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

export function createWorld(random, saved) {
  const city = buildCity(random);
  const diner = city.landmarks.diner;
  const player = {
    x: saved && saved.x ? saved.x : diner.doorX, y: saved && saved.y ? saved.y : diner.doorY + 10,
    angle: -Math.PI / 2, health: 100, money: saved ? saved.money : 20,
    car: null, hasPistol: saved ? !!saved.hasPistol : false, ammo: saved ? (saved.ammo || 0) : 0,
    moving: false, punchCd: 0, shootCd: 0, taxiFares: saved ? (saved.taxiFares || 0) : 0, name: 'Dante Marlowe',
  };
  const cars = [];
  // 17 traffic cars on random roads
  for (let i = 0; i < 17; i++) {
    const vertical = random() < 0.5;
    let x, y, angle;
    if (vertical) { x = STREETS_X[Math.floor(random() * STREETS_X.length)] + (random() < 0.5 ? -27 : 27); y = 120 + random() * 2300; angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; if (x % 1 === 0) {} }
    else { y = AVENUES_Y[Math.floor(random() * AVENUES_Y.length)] + (random() < 0.5 ? -27 : 27); x = 120 + random() * 3360; angle = random() < 0.5 ? 0 : Math.PI; }
    // correct lane side roughly: keep as placed
    cars.push(createCar(random, x, y, angle, 'traffic'));
  }
  // parked cars in lots
  for (const lot of city.lots) {
    for (const bay of lot.bays) {
      if (random() < 0.42) { const c = createCar(random, bay.x + 24, bay.y + 11, 0, 'parked'); c.driver = false; cars.push(c); }
    }
  }
  // parked on streets
  for (let i = 0; i < 12; i++) {
    const sx = STREETS_X[Math.floor(random() * STREETS_X.length)];
    const c = createCar(random, sx + (random() < 0.5 ? -44 : 44), 140 + random() * 2200, Math.PI / 2, 'parked');
    c.driver = false; cars.push(c);
  }
  const peds = [];
  for (let i = 0; i < 44; i++) {
    let x, y;
    if (i < 10 && city.parks.length) { const p = city.parks[i % city.parks.length]; x = p.x + 30 + random() * (p.w - 60); y = p.y + 30 + random() * (p.h - 60); }
    else { x = 60 + random() * 3480; y = 60 + random() * 2380; if (onRoad(city, x, y)) { x += 70; } }
    peds.push(createPed(random, x, y));
  }
  const state = {
    city, player, cars, peds, bullets: [], effects: [],
    wanted: createWanted(), missions: createMissionState(saved), taxi: createTaxiState(),
    time: 0, bustProgress: 0, copNear: false, savedFlash: 0, random, audio: null, hasSave: !!saved,
    saveCooldown: 0,
  };
  return state;
}

function nearestCar(state, maxDist) {
  let best = null, bd = maxDist;
  for (const c of state.cars) { const d = Math.hypot(c.x - state.player.x, c.y - state.player.y); if (d < bd) { bd = d; best = c; } }
  return best;
}

export function stepWorld(state, dt, control, actions) {
  state.time += dt;
  const p = state.player;
  if (state.savedFlash > 0) state.savedFlash -= dt;
  if (state.saveCooldown > 0) state.saveCooldown -= dt;

  // enter / exit car
  if (actions & ACTION_ENTER_CAR) {
    if (p.car) {
      const car = p.car;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 28; p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 28;
      p.car = null;
    } else {
      const car = nearestCar(state, 46);
      if (car && car.kind !== 'police') {
        const wasTraffic = car.kind === 'traffic' && car.driver;
        p.car = car; car.kind = car.kind === 'parked' ? 'parked' : 'traffic'; car.playerDriven = true;
        if (wasTraffic) {
          car.driver = false;
          const driver = createPed(state.random, car.x + 26, car.y + 10);
          driver.state = 'flee'; state.peds.push(driver);
          reportCrime(state.wanted, 1);
          if (state.audio) state.audio.blip(220);
        }
      }
    }
  }

  // player movement
  if (p.car) {
    const car = p.car;
    const ctrl = { throttle: control.throttle !== undefined ? control.throttle : -control.moveY, steer: control.steer !== undefined && (control.moveX || control.steer) ? (control.moveX || control.steer) : 0, handbrake: !!control.brake };
    // steer comes from moveX
    ctrl.steer = control.moveX || 0;
    ctrl.throttle = -(control.moveY || 0);
    driveCar(state.city, car, ctrl, dt);
    moveCar(state.city, car);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    runOverCheck(state);
  } else {
    movePlayerOnFoot(state.city, p, control.moveX || 0, control.moveY || 0, !!control.run, dt);
    if (actions & ACTION_PUNCH) {
      if (p.hasPistol && control.mouseDown) shoot(state, state.bullets, state.effects, control.aimX ?? (p.x + Math.cos(p.angle) * 80), control.aimY ?? (p.y + Math.sin(p.angle) * 80));
      else if (control.mouseDown && p.hasPistol) shoot(state, state.bullets, state.effects, control.aimX ?? p.x + 80, control.aimY ?? p.y);
      else punch(state, state.effects);
    }
    // if mouse held and pistol, continuous shooting handled via punch action each click; also allow held
    if (control.mouseDown && p.hasPistol && !(actions & ACTION_PUNCH)) {
      shoot(state, state.bullets, state.effects, control.aimX ?? p.x + 80, control.aimY ?? p.y);
    }
  }

  // traffic AI
  for (const car of state.cars) {
    if (car === p.car || car.kind === 'police' || car.kind === 'parked') continue;
    if (!car.driver && car.kind === 'traffic' && !car.playerDriven) continue;
    if (car.kind === 'traffic') {
      const ctrl = trafficControl(state.city, car, state.cars, dt, state.random);
      driveCar(state.city, car, ctrl, dt);
      moveCar(state.city, car);
      // traffic hitting player on foot
      if (!p.car && Math.abs(car.speed || 0) > 60 && Math.hypot(car.x - p.x, car.y - p.y) < car.radius + 12) {
        p.health -= 22 * dt * 8; car.speed *= 0.7;
        state.effects.push({ type: 'spark', x: p.x, y: p.y, t: 0, life: 0.25 });
      }
    }
  }
  collideCars(state.cars, state.effects);
  // police & wanted
  const anyNear = updatePolice(state, dt, state.random);
  updateWanted(state.wanted, dt, anyNear);
  // peds
  const danger = p.car && Math.abs(p.car.speed || 0) > 90 ? p.car : (state.wanted.stars > 0 ? null : null);
  for (let i = state.peds.length - 1; i >= 0; i--) {
    const ped = state.peds[i];
    updatePed(state.city, ped, dt, state.random, danger || (p.car ? p.car : null));
    if (state.peds.length > 70 && ped.state === 'flee' && Math.hypot(ped.x - p.x, ped.y - p.y) > 700) state.peds.splice(i, 1);
  }
  updateBullets(state, dt);
  // effects tick
  for (let i = state.effects.length - 1; i >= 0; i--) { const e = state.effects[i]; e.t += dt; if (e.t >= e.life) state.effects.splice(i, 1); }
  updateMissions(state, dt);
  updateTaxi(state, dt, state.random);
  // Turbo Detail
  const detail = state.city.landmarks.detail;
  if (detail && p.car && !state.missions.active && state.wanted.stars > 0 && Math.hypot(p.car.x - detail.doorX, p.car.y - detail.doorY) < 52 && Math.abs(p.car.speed || 0) < 10) {
    if (p.money >= 80) {
      p.money -= 80; state.wanted.stars = 0; state.wanted.heat = 0; state.wanted.locked = 0;
      state.cars = state.cars.filter(c => c.kind !== 'police');
      state.effects.push({ type: 'text', x: p.car.x, y: p.car.y - 26, t: 0, life: 1.2, text: 'Heat cleared -$80' });
    }
  }
  // safehouse autosave
  if (atSavePoint(state) && state.saveCooldown <= 0) {
    if (storeSave(state)) { state.savedFlash = 1.6; state.saveCooldown = 4; state.hasSave = true; }
  }
  // health regen
  if (p.health < 100 && p.health > 0) p.health = Math.min(100, p.health + dt * 1.6);
  // bust / wasted
  if (updateBust(state, dt)) return EVENT_BUSTED;
  if (p.health <= 0) return EVENT_WASTED;
  return EVENT_NONE;
}

export function respawn(state, busted) {
  const p = state.player;
  let fine;
  if (busted) fine = Math.max(25, Math.round(p.money * 0.15));
  else fine = 40;
  fine = Math.min(fine, p.money);
  p.money -= fine;
  p.car = null;
  const sh = state.city.landmarks.safehouse;
  p.x = sh.doorX; p.y = sh.doorY + 8; p.health = 100; p.angle = Math.PI / 2;
  state.wanted.stars = 0; state.wanted.heat = 0; state.wanted.locked = 0; state.wanted.quietTime = 0;
  state.cars = state.cars.filter(c => c.kind !== 'police');
  state.bustProgress = 0;
  state.bullets = [];
  return fine;
}
