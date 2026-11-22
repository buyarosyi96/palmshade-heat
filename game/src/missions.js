import { reportCrime, setWantedFloor, clearWantedLock } from './police.js';

export const EXTRA_MARKERS = {
  garage: null, // filled from city
  shore1: { id: 'shore1', name: 'Shore Checkpoint 1', x: 3270, y: 2440, doorX: 3270, doorY: 2440 },
  shore2: { id: 'shore2', name: 'Shore Checkpoint 2', x: 2120, y: 2440, doorX: 2120, doorY: 2440 },
  shore3: { id: 'shore3', name: 'Shore Checkpoint 3', x: 2680, y: 1980, doorX: 2680, doorY: 1980 },
};

export const MISSIONS = [
  {
    id: 'meet-rosa', title: 'Meet Rosa', reward: 25, grantsPistol: false,
    intro: ['Dante? You look broke, mijo.', 'I run the Palms Diner. I got work if you got nerve.', 'Come see me. First coffee is on me.'],
    outro: ['There he is. Palmshade still remembers you.', 'Small jobs first. Big money later.'],
    steps: [{ text: 'Go to the Palms Diner', at: 'diner', radius: 46 }],
  },
  {
    id: 'first-wheels', title: 'First Wheels', reward: 150, grantsPistol: false,
    intro: ['You cannot work Palmshade on foot, Dante.', 'Find a car. Any car. Then park it at my garage.'],
    outro: ['Not bad wheels. Keep them warm for me.'],
    steps: [
      { text: 'Steal any car (F near a car)', needCar: true, radius: 30 },
      { text: 'Deliver the car to the garage by the diner', at: 'garage', needCarHere: true, radius: 62 },
    ],
  },
  {
    id: 'hot-package', title: 'Hot Package', reward: 300, grantsPistol: true,
    intro: ['A package waits at Marina Azul. No questions.', 'Take it to Hotel Solano, fast. And Dante — take this pistol.'],
    outro: ['Delivered. You just earned real trust, and real money.'],
    steps: [
      { text: 'Pick up the package at Marina Azul', at: 'marina', radius: 48 },
      { text: 'Deliver to Hotel Solano — hurry!', at: 'hotel', radius: 52, timer: 150, armWanted: 2 },
    ],
  },
  {
    id: 'shore-run', title: 'Shore Run', reward: 250, grantsPistol: false,
    intro: ['My cousin needs a driver along the shore. Hit every checkpoint.', 'Finish at Club Sirena. Do not crawl.'],
    outro: ['Fast and clean. The club sends its thanks.'],
    steps: [
      { text: 'Hit the east shore checkpoint', at: 'shore1', needCarHere: true, radius: 58, timer: 115 },
      { text: 'Hit the west shore checkpoint', at: 'shore2', needCarHere: true, radius: 58 },
      { text: 'Hit the inland checkpoint', at: 'shore3', needCarHere: true, radius: 58 },
      { text: 'Finish at Club Sirena', at: 'club', needCarHere: true, radius: 56 },
    ],
  },
  {
    id: 'heat-wave', title: 'Heat Wave', reward: 500, grantsPistol: false,
    intro: ['You poked the whole city, Dante. Every cop is awake.', 'Get home. Your safehouse. NOW.'],
    outro: ['You made it home. Palmshade is yours again — for tonight.'],
    steps: [{ text: 'Lose yourself at your safehouse', at: 'safehouse', radius: 52, armWanted: 3 }],
  },
];

export function markerFor(city, step) {
  if (!step || !step.at) return null;
  if (step.at === 'garage') return city.garage;
  if (EXTRA_MARKERS[step.at]) return EXTRA_MARKERS[step.at];
  const lm = city.landmarks[step.at];
  if (lm) return { id: lm.id, name: lm.name, x: lm.doorX, y: lm.doorY, doorX: lm.doorX, doorY: lm.doorY };
  return null;
}

export function createMissionState(saved) {
  return { index: saved ? saved.missionIndex : 0, step: 0, active: false, done: !!(saved && saved.storyDone), dialog: [], dialogTimer: 0, timeLeft: null, offered: false, completedCount: saved ? (saved.missionsDone || 0) : 0 };
}

function pushDialog(ms, lines) { for (const l of lines) ms.dialog.push({ speaker: 'Rosa', text: l }); ms.dialogTimer = 3.6; }

export function maybeStartMission(state) {
  const ms = state.missions;
  if (ms.active || ms.done || ms.index >= MISSIONS.length) return false;
  const diner = state.city.landmarks.diner;
  const px = state.player.x, py = state.player.y;
  if (!state.player.car && Math.hypot(px - diner.doorX, py - diner.doorY) < 52) {
    startMission(state, ms.index);
    return true;
  }
  return false;
}

export function startMission(state, idx) {
  const ms = state.missions;
  const m = MISSIONS[idx];
  ms.active = true; ms.step = 0; ms.timeLeft = null;
  pushDialog(ms, m.intro);
  applyStep(state);
}

function applyStep(state) {
  const ms = state.missions;
  const m = MISSIONS[ms.index]; if (!m) return;
  const step = m.steps[ms.step]; if (!step) return;
  if (step.timer) ms.timeLeft = step.timer;
  if (step.armWanted) { setWantedFloor(state.wanted, step.armWanted); reportCrime(state.wanted, step.armWanted); }
}

function completeMission(state) {
  const ms = state.missions;
  const m = MISSIONS[ms.index];
  state.player.money += m.reward;
  state.effects.push({ type: 'text', x: state.player.x, y: state.player.y - 24, t: 0, life: 1.4, text: '+$' + m.reward });
  if (state.audio) state.audio.cash();
  if (m.grantsPistol) { state.player.hasPistol = true; state.player.ammo = (state.player.ammo || 0) + 24; }
  pushDialog(ms, m.outro);
  ms.completedCount++;
  ms.index++; ms.step = 0; ms.active = false; ms.timeLeft = null;
  clearWantedLock(state.wanted);
  if (ms.index >= MISSIONS.length) ms.done = true;
}

function failMission(state, why) {
  const ms = state.missions;
  ms.active = false; ms.step = 0; ms.timeLeft = null;
  clearWantedLock(state.wanted);
  ms.dialog.push({ speaker: 'Rosa', text: why || 'That job fell apart. Come back to the diner and we try again.' });
  ms.dialogTimer = 3.6;
}

export function updateMissions(state, dt) {
  const ms = state.missions;
  if (ms.dialog.length) { ms.dialogTimer -= dt; if (ms.dialogTimer <= 0) { ms.dialog.shift(); ms.dialogTimer = 3.6; } }
  if (!ms.active) { maybeStartMission(state); return; }
  const m = MISSIONS[ms.index]; if (!m) return;
  const step = m.steps[ms.step]; if (!step) { completeMission(state); return; }
  if (step.timer || ms.timeLeft !== null) {
    if (ms.timeLeft !== null) { ms.timeLeft -= dt; if (ms.timeLeft <= 0) { failMission(state, 'Too slow, Dante. The job is dead.'); return; } }
  }
  let satisfied = false;
  if (step.needCar && !step.at) satisfied = !!state.player.car;
  else if (step.at) {
    const mk = markerFor(state.city, step);
    if (mk) {
      const obj = state.player.car && step.needCarHere ? state.player.car : state.player;
      const inObj = step.needCarHere ? state.player.car : obj;
      if (step.needCarHere && !state.player.car) satisfied = false;
      else satisfied = Math.hypot(obj.x - mk.doorX, obj.y - mk.doorY) < (step.radius || 48);
    }
  }
  if (satisfied) {
    ms.step++;
    if (ms.step >= m.steps.length) completeMission(state);
    else applyStep(state);
  }
}

export function currentStep(state) {
  const ms = state.missions;
  if (!ms.active) return null;
  const m = MISSIONS[ms.index];
  return m ? m.steps[ms.step] : null;
}
export function currentMission(state) {
  const ms = state.missions;
  return ms.active ? MISSIONS[ms.index] : null;
}

// Taxi jobs
export function createTaxiState() { return { phase: 'idle', ped: null, fare: 0, dest: null, timer: 0 }; }

export function maybeStartTaxi(state, random) {
  const taxi = state.taxi;
  if (taxi.phase !== 'idle' || !state.player.car || Math.abs(state.player.car.speed || 0) > 25) return;
  if (state.missions.active) return;
  for (const ped of state.peds) {
    if (ped.state === 'walk' && Math.hypot(ped.x - state.player.car.x, ped.y - state.player.car.y) < 90) {
      ped.state = 'hail'; taxi.phase = 'hail'; taxi.ped = ped;
      taxi.timer = 12;
      return;
    }
  }
}

export function updateTaxi(state, dt, random) {
  const taxi = state.taxi;
  maybeStartTaxi(state, random);
  if (taxi.phase === 'hail') {
    taxi.timer -= dt;
    if (taxi.timer <= 0 || !taxi.ped) { if (taxi.ped && taxi.ped.state === 'hail') taxi.ped.state = 'walk'; taxi.phase = 'idle'; taxi.ped = null; return; }
    if (state.player.car && Math.abs(state.player.car.speed || 0) < 12 && Math.hypot(taxi.ped.x - state.player.car.x, taxi.ped.y - state.player.car.y) < 44) {
      taxi.ped.state = 'riding'; taxi.phase = 'ride';
      const ids = Object.keys(state.city.landmarks);
      const destId = ids[Math.floor(random() * ids.length)];
      const lm = state.city.landmarks[destId];
      taxi.dest = { id: destId, name: lm.name, x: lm.doorX, y: lm.doorY };
      const dist = Math.hypot(taxi.dest.x - taxi.ped.x, taxi.dest.y - taxi.ped.y);
      taxi.fare = Math.round(30 + dist / 38);
    }
  } else if (taxi.phase === 'ride') {
    if (!state.player.car) { // passenger bails if you exit
      if (taxi.ped) { taxi.ped.state = 'walk'; taxi.ped.x = state.player.x + 20; taxi.ped.y = state.player.y + 10; }
      taxi.phase = 'idle'; taxi.ped = null; taxi.dest = null; return;
    }
    taxi.ped.x = state.player.car.x; taxi.ped.y = state.player.car.y;
    if (Math.abs(state.player.car.speed || 0) < 12 && Math.hypot(state.player.car.x - taxi.dest.x, state.player.car.y - taxi.dest.y) < 58) {
      state.player.money += taxi.fare;
      state.player.taxiFares = (state.player.taxiFares || 0) + 1;
      state.effects.push({ type: 'text', x: state.player.car.x, y: state.player.car.y - 24, t: 0, life: 1.3, text: 'Fare +$' + taxi.fare });
      if (state.audio) state.audio.cash();
      taxi.ped.state = 'walk'; taxi.ped.x = taxi.dest.x + 16; taxi.ped.y = taxi.dest.y + 8;
      taxi.phase = 'idle'; taxi.ped = null; taxi.dest = null;
    }
  }
}
