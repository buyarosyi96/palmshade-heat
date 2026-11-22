import { createRandom } from './random.js';
import { STEP } from './config.js';
import { createWorld, stepWorld, respawn, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { createRenderer } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE } from './input.js';
import { drawHud, drawScreen, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261122', 10) || 20261122;
const shot = params.get('shot');

function announce(text) { if (statusEl) statusEl.textContent = text; }

if (shot) {
  const random = createRandom(seed);
  const state = createWorld(random, null);
  state.audio = null;
  const screen = stageShot(shot, state);
  const renderer = createRenderer(canvas);
  renderer.draw(state, state.player);
  if (screen === 'title') drawScreen(canvas, state, SCREEN_TITLE, 0);
  else drawHud(canvas, state);
  // paint twice for stability
  renderer.draw(state, state.player);
  if (screen === 'title') drawScreen(canvas, state, SCREEN_TITLE, 0);
  else drawHud(canvas, state);
  window.__shotReady = true;
  try {
    const a = document.createElement('a');
    a.download = 'palmshade-' + shot + '.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
  } catch (e) {}
} else {
  boot();
}

function boot() {
  const audio = createAudio();
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  let saved = loadSave();
  let state = createWorld(createRandom(seed), saved);
  state.audio = audio; state.hasSave = !!saved;
  let screen = SCREEN_TITLE;
  let fine = 0;
  let lastScreen = '';
  announce('Palmshade Heat title screen');

  let last = performance.now(), acc = 0;
  let pausedByHide = false;
  document.addEventListener('visibilitychange', () => { if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; pausedByHide = true; } });

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    const snap = input.snapshot();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (snap.moveX === 0 && window.__wantNew) {}
        screen = SCREEN_PLAY; announce('Playing Palmshade Heat');
      }
      // N for new game
      if (input.held.has('KeyN') && state.hasSave) {
        clearSave(); saved = null;
        state = createWorld(createRandom(seed), null); state.audio = audio; state.hasSave = false;
        audio.unlock(); screen = SCREEN_PLAY; announce('New game started');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PLAY; announce('Resumed'); }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) { screen = SCREEN_PLAY; announce('Back in Palmshade'); }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PAUSED; announce('Paused'); }
      else {
        acc += dt;
        const aimX = renderer.camera.x + snap.mouseX;
        const aimY = renderer.camera.y + snap.mouseY;
        const control = { ...snap, aimX, aimY };
        while (acc >= STEP) {
          const ev = stepWorld(state, STEP, control, actions);
          acc -= STEP;
          // actions are one-shot: only first step consumes them
          if (ev === EVENT_BUSTED) { fine = respawn(state, true); screen = SCREEN_BUSTED; announce('Busted'); break; }
          if (ev === EVENT_WASTED) { fine = respawn(state, false); screen = SCREEN_WASTED; announce('Wasted'); break; }
          break; // one step per frame max chunk handled below via loop guard
        }
        // run remaining steps (without actions)
        let guard = 0;
        while (acc >= STEP && screen === SCREEN_PLAY && guard++ < 8) {
          const ev = stepWorld(state, STEP, control, 0);
          acc -= STEP;
          if (ev === EVENT_BUSTED) { fine = respawn(state, true); screen = SCREEN_BUSTED; announce('Busted'); }
          if (ev === EVENT_WASTED) { fine = respawn(state, false); screen = SCREEN_WASTED; announce('Wasted'); }
        }
        if (acc > STEP * 8) acc = 0;
      }
    }
    if (screen !== lastScreen) lastScreen = screen;
    // audio wiring
    if (screen === SCREEN_PLAY) {
      audio.setEngine(!!state.player.car, state.player.car ? (state.player.car.speed || 0) / 300 : 0);
      audio.setSiren(state.copNear && state.wanted.stars > 0);
    } else { audio.setEngine(false, 0); if (screen === SCREEN_TITLE) audio.setSiren(false); }
    // draw
    const focus = state.player.car || state.player;
    renderer.draw(state, focus);
    if (screen === SCREEN_PLAY) drawHud(canvas, state);
    else if (screen === SCREEN_PAUSED) { drawHud(canvas, state); drawScreen(canvas, state, SCREEN_PAUSED, 0); }
    else drawScreen(canvas, state, screen, fine);
  }
  requestAnimationFrame(frame);
}
