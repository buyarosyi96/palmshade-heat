import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.money !== 'number') return null;
    return d;
  } catch (e) { return null; }
}

export function storeSave(state) {
  try {
    const p = state.player;
    const data = { money: p.money, missionIndex: state.missions.index, storyDone: state.missions.done, hasPistol: !!p.hasPistol, ammo: p.ammo || 0, x: p.x, y: p.y, missionsDone: state.missions.completedCount || 0, taxiFares: p.taxiFares || 0 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

export function atSavePoint(state) {
  if (state.player.car) return false;
  const sh = state.city.landmarks.safehouse;
  if (!sh) return false;
  return Math.hypot(state.player.x - sh.doorX, state.player.y - sh.doorY) < 44;
}
