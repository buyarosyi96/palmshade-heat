import { WORLD, STREETS_X, AVENUES_Y, WATER_Y } from './config.js';
import { currentMission, currentStep } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

export function objectiveText(state) {
  if (state.taxi && state.taxi.phase === 'ride' && state.taxi.dest) return 'Taxi: drive your fare to ' + state.taxi.dest.name + ' — $' + state.taxi.fare;
  if (state.taxi && state.taxi.phase === 'hail') return 'Taxi: stop close to the hailing passenger';
  const m = currentMission(state), step = currentStep(state);
  if (m && step) return m.title + ': ' + step.text;
  if (state.missions && state.missions.done) return 'Free roam — taxi fares, Turbo Detail ($80 clears heat), the beach is yours';
  return 'Go to the Palms Diner and see Rosa for work';
}

export function drawHud(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const p = state.player;
  // top-left health
  panel(ctx, 14, 12, 218, 52);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('DANTE MARLOWE', 24, 32);
  ctx.fillStyle = '#3a3f45'; ctx.fillRect(24, 40, 180, 12);
  ctx.fillStyle = p.health > 30 ? '#e23b2e' : '#ff7b2e';
  ctx.fillRect(24, 40, 180 * Math.max(0, p.health) / 100, 12);
  // top-right money + stars
  panel(ctx, W - 244, 12, 230, 52);
  ctx.fillStyle = '#7dff8a'; ctx.font = 'bold 19px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('$' + Math.floor(p.money), W - 24, 36);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted.stars ? '★' : '☆';
  const flash = state.wanted.stars >= 4 && Math.floor(state.time * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#ff4444' : '#ffd94d'; ctx.font = 'bold 17px sans-serif';
  ctx.fillText(stars, W - 24, 57);
  // objective
  ctx.fillStyle = 'rgba(10,14,18,0.72)'; ctx.fillRect(W / 2 - 330, 12, 660, 30);
  ctx.fillStyle = '#ffe9a8'; ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(objectiveText(state), W / 2, 32);
  // timer
  if (state.missions && state.missions.timeLeft !== null && state.missions.active) {
    ctx.fillStyle = state.missions.timeLeft < 20 ? '#ff5544' : '#fff';
    ctx.font = 'bold 20px sans-serif'; ctx.fillText(Math.ceil(state.missions.timeLeft) + 's', W / 2, 66);
  }
  // speed / weapon bottom-right
  ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
  if (p.car) ctx.fillText(Math.round(Math.abs(p.car.speed || 0) * 0.36) + ' km/h', W - 18, H - 18);
  else if (p.hasPistol) ctx.fillText('Pistol · ' + (p.ammo || 0), W - 18, H - 18);
  // bust bar
  if (state.bustProgress > 0.05) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 110, H - 110, 220, 20);
    ctx.fillStyle = '#ff4444'; ctx.fillRect(W / 2 - 106, H - 106, 212 * Math.min(1, state.bustProgress / 1.1), 12);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BUSTED?', W / 2, H - 116);
  }
  // saved flash
  if (state.savedFlash && state.savedFlash > 0) { ctx.fillStyle = '#7dff8a'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Saved ✓', W / 2, 92); }
  drawMinimap(ctx, state);
  // dialog
  const dlg = state.missions && state.missions.dialog[0];
  if (dlg) {
    ctx.fillStyle = 'rgba(12,16,22,0.88)'; ctx.fillRect(W / 2 - 300, H - 96, 600, 62);
    ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 300, H - 96, 600, 62);
    ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('ROSA DELGADO', W / 2 - 284, H - 72);
    ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.fillText(dlg.text, W / 2 - 284, H - 48);
  }
}
function panel(ctx, x, y, w, h) { ctx.fillStyle = 'rgba(10,14,18,0.68)'; ctx.fillRect(x, y, w, h); }

function drawMinimap(ctx, state) {
  const mw = 188, mh = 142, x0 = 14, y0 = ctx.canvas.height - mh - 14;
  const sx = (x) => x0 + (x / WORLD.w) * mw, sy = (y) => y0 + (y / WORLD.h) * mh;
  ctx.fillStyle = '#79a95c'; ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#1668a0'; ctx.fillRect(x0, sy(WATER_Y), mw, mh - (sy(WATER_Y) - y0));
  ctx.fillStyle = '#ecd28a'; ctx.fillRect(x0, sy(2548), mw, sy(WATER_Y) - sy(2548));
  ctx.strokeStyle = '#3c4147'; ctx.lineWidth = 2;
  for (const x of STREETS_X) { ctx.beginPath(); ctx.moveTo(sx(x), y0); ctx.lineTo(sx(x), y0 + mh); ctx.stroke(); }
  for (const y of AVENUES_Y) { ctx.beginPath(); ctx.moveTo(x0, sy(y)); ctx.lineTo(x0 + mw, sy(y)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(60,40,30,0.7)';
  for (const b of state.city.buildings) ctx.fillRect(sx(b.x), sy(b.y), Math.max(2, b.w / WORLD.w * mw), Math.max(2, b.h / WORLD.h * mh));
  // police blips
  const blink = Math.floor(state.time * 3) % 2 === 0;
  for (const c of state.cars) if (c.kind === 'police') { ctx.fillStyle = blink ? '#ff2222' : '#2255ff'; ctx.beginPath(); ctx.arc(sx(c.x), sy(c.y), 3, 0, 7); ctx.fill(); }
  // mission marker
  const step = currentStep(state);
  if (step && step.at) {
    let mx = null, my = null;
    const lm = state.city.landmarks[step.at];
    if (lm) { mx = lm.doorX; my = lm.doorY; }
    else if (step.at === 'garage') { mx = state.city.garage.x; my = state.city.garage.y; }
    else { const extra = { shore1: [3270, 2440], shore2: [2120, 2440], shore3: [2680, 1980] }[step.at]; if (extra) { mx = extra[0]; my = extra[1]; } }
    if (mx !== null) { const pr = 4 + Math.sin(state.time * 5) * 1.4; ctx.fillStyle = '#ffd94d'; ctx.beginPath(); ctx.arc(sx(mx), sy(my), pr, 0, 7); ctx.fill(); }
  }
  if (state.taxi && state.taxi.phase === 'ride' && state.taxi.dest) { ctx.fillStyle = '#ff9f2e'; ctx.beginPath(); ctx.arc(sx(state.taxi.dest.x), sy(state.taxi.dest.y), 4, 0, 7); ctx.fill(); }
  // player arrow
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  const ang = state.player.car ? state.player.car.angle : state.player.angle;
  ctx.save(); ctx.translate(sx(px), sy(py)); ctx.rotate(ang);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, mw, mh);
}

export function drawScreen(canvas, state, screen, fine) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(8,10,16,0.62)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  if (screen === SCREEN_TITLE) {
    ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('PALMSHADE HEAT', W / 2, H / 2 - 120);
    ctx.fillStyle = '#fff'; ctx.font = '19px sans-serif';
    ctx.fillText('Dante Marlowe came home to Palmshade City with empty pockets.', W / 2, H / 2 - 76);
    ctx.fillText('Rosa at the Palms Diner has work. The city has cars. The cops have opinions.', W / 2, H / 2 - 50);
    ctx.fillStyle = '#7dff8a'; ctx.font = 'bold 21px sans-serif';
    ctx.fillText(state.hasSave ? 'Press Enter to continue · N for a new game' : 'Press Enter to start', W / 2, H / 2 + 6);
    ctx.fillStyle = '#dfe6ec'; ctx.font = '16px sans-serif';
    const lines = ['WASD / Arrows — move & drive    Shift — run    Space — handbrake', 'F — enter / exit car    J or Click — punch / shoot (aim with mouse)', 'P / Esc — pause    M — mute    E — talk / confirm', 'Save at Dante\'s Safehouse, north-west corner'];
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 48 + i * 24));
    ctx.fillStyle = '#9fb3c8'; ctx.font = '13px sans-serif';
    ctx.fillText('An original game: every name, place and line in Palmshade City was invented for this game.', W / 2, H - 28);
  } else if (screen === SCREEN_PAUSED) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.fillText('PAUSED', W / 2, H / 2 - 10);
    ctx.font = '17px sans-serif'; ctx.fillText('Press P or Esc to keep playing', W / 2, H / 2 + 26);
  } else if (screen === SCREEN_BUSTED) {
    ctx.fillStyle = '#4d7dff'; ctx.font = 'bold 58px sans-serif'; ctx.fillText('BUSTED', W / 2, H / 2 - 20);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText('The Palmshade PD took a fine of $' + (fine || 0) + '. You wake at the safehouse.', W / 2, H / 2 + 18);
    ctx.fillText('Press Enter to continue', W / 2, H / 2 + 50);
  } else if (screen === SCREEN_WASTED) {
    ctx.fillStyle = '#e23b2e'; ctx.font = 'bold 58px sans-serif'; ctx.fillText('WASTED', W / 2, H / 2 - 20);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText('Hospital bill: $' + (fine || 0) + '. You wake at the safehouse.', W / 2, H / 2 + 18);
    ctx.fillText('Press Enter to continue', W / 2, H / 2 + 50);
  }
}
