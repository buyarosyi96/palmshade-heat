import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { createMissionState, startMission, MISSIONS } from './missions.js';
import { setWantedFloor, reportCrime } from './police.js';
import { stepWorld as stepWorldImpl } from './world.js';

function stepMany(state, stepWorld, n, control) {
  const ctrl = control || { moveX: 0, moveY: 0, run: false, brake: false, mouseDown: false };
  for (let i = 0; i < n; i++) stepWorld(state, STEP, ctrl, 0);
}

export function stageShot(name, state, stepWorld) {
  stepWorld = stepWorld || stepWorldImpl;
  const city = state.city;
  const diner = city.landmarks.diner;
  if (name === 'cover') {
    // yellow parked car at the diner, player standing by it
    const car = createCar(state.random, diner.doorX + 46, diner.doorY + 18, 0.15, 'parked');
    car.color = '#f1c40f'; car.driver = false;
    state.cars.push(car);
    state.player.x = diner.doorX + 6; state.player.y = diner.doorY + 22;
    state.player.angle = 0.4; state.player.car = null;
    stepMany(state, stepWorld, 26, { moveX: 0, moveY: 0 });
    return 'title';
  }
  if (name === 'chase') {
    const car = createCar(state.random, 1560, 1400 + 27, 0, 'traffic');
    car.color = '#e74c3c'; car.speed = 190; car.driver = false; car.playerDriven = true;
    state.cars.push(car);
    state.player.car = car; state.player.x = car.x; state.player.y = car.y;
    setWantedFloor(state.wanted, 4); reportCrime(state.wanted, 10); state.wanted.stars = 4;
    const positions = [[1380, 1373], [1405, 1427], [1720, 1373]];
    for (const [x, y] of positions) { const pc = createCar(state.random, x, y, 0, 'police'); pc.speed = 170; state.cars.push(pc); }
    stepMany(state, stepWorld, 54, { moveX: 0, moveY: -1 });
    state.wanted.stars = 4; state.wanted.locked = 4;
    return 'play';
  }
  if (name === 'mission') {
    state.missions = createMissionState(null);
    state.missions.index = 2;
    startMission(state, 2);
    const marina = city.landmarks.marina;
    state.player.x = marina.doorX; state.player.y = marina.doorY + 6;
    state.player.car = null; state.player.hasPistol = true; state.player.ammo = 24;
    state.missions.dialog = [{ speaker: 'Rosa', text: MISSIONS[2].intro[0] }, { speaker: 'Rosa', text: MISSIONS[2].intro[1] }];
    state.missions.dialogTimer = 99;
    stepMany(state, stepWorld, 8, { moveX: 0, moveY: 0 });
    state.missions.dialogTimer = 99;
    return 'play';
  }
  if (name === 'drive') {
    state.missions = createMissionState(null);
    state.missions.index = 3;
    startMission(state, 3);
    state.missions.timeLeft = 115;
    const car = createCar(state.random, 1050, 2440 + 27, 0, 'traffic');
    car.color = '#3498db'; car.speed = 210; car.driver = false; car.playerDriven = true;
    state.cars.push(car);
    state.player.car = car; state.player.x = car.x; state.player.y = car.y;
    stepMany(state, stepWorld, 48, { moveX: 0, moveY: -1 });
    state.missions.timeLeft = 115;
    return 'play';
  }
  return 'title';
}
