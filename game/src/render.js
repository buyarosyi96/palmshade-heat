import { WORLD, ROAD_W, STREETS_X, AVENUES_Y, BEACH_Y, WATER_Y } from './config.js';
import { markerFor, currentStep } from './missions.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0 };
  let staticLayer = null;

  function buildStatic(city) {
    const c = document.createElement('canvas'); c.width = WORLD.w; c.height = WORLD.h;
    const g = c.getContext('2d');
    // lawn base
    g.fillStyle = '#79a95c'; g.fillRect(0, 0, WORLD.w, WORLD.h);
    // subtle lawn patches
    g.fillStyle = '#83b566';
    for (let x = 0; x < WORLD.w; x += 180) for (let y = 0; y < 2400; y += 180) if ((x + y) % 360 === 0) g.fillRect(x, y, 180, 180);
    // beach sand
    g.fillStyle = '#ecd28a'; g.fillRect(0, BEACH_Y - 60, WORLD.w, WATER_Y - BEACH_Y + 60);
    g.fillStyle = '#f4de9e'; g.fillRect(0, BEACH_Y, WORLD.w, WATER_Y - BEACH_Y);
    // sea
    const grad = g.createLinearGradient(0, WATER_Y, 0, WORLD.h);
    grad.addColorStop(0, '#3fa7c4'); grad.addColorStop(1, '#1668a0');
    g.fillStyle = grad; g.fillRect(0, WATER_Y, WORLD.w, WORLD.h - WATER_Y);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, WATER_Y); g.lineTo(WORLD.w, WATER_Y); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    for (let x = 0; x < WORLD.w; x += 130) { g.beginPath(); g.moveTo(x, WATER_Y + 22); g.lineTo(x + 62, WATER_Y + 22); g.stroke(); }
    // blocks sidewalk slabs
    for (const b of city.blocks) {
      if (b.y > BEACH_Y) continue;
      g.fillStyle = '#cfc8b8'; g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = 'rgba(0,0,0,0.08)';
      for (let x = b.x; x < b.x + b.w; x += 44) { g.beginPath(); g.moveTo(x, b.y); g.lineTo(x, b.y + b.h); g.stroke(); }
    }
    // parks
    for (const p of city.parks) {
      g.fillStyle = '#5f9e4d'; g.fillRect(p.x + 8, p.y + 8, p.w - 16, p.h - 16);
      for (const t of p.trees) drawTree(g, t.x, t.y, t.r);
    }
    // parking lots
    for (const l of city.lots) {
      g.fillStyle = '#8d9299'; g.fillRect(l.x + 6, l.y + 6, l.w - 12, l.h - 12);
      g.strokeStyle = '#f5f5f5'; g.lineWidth = 2;
      for (const bay of l.bays) g.strokeRect(bay.x, bay.y, 48, 22);
    }
    // roads
    drawRoads(g);
    // beach huts
    for (const h of city.beach.huts) { g.fillStyle = '#c96f4a'; g.fillRect(h.x, h.y, h.w, h.h); g.fillStyle = '#8a4a32'; g.fillRect(h.x - 4, h.y - 6, h.w + 8, 10); }
    // buildings
    for (const b of city.buildings) drawBuilding(g, b);
    // palms in static layer (beach)
    for (const p of city.beach.palms) drawPalm(g, p.x, p.y, p.s);
    for (const p of city.palms) drawPalm(g, p.x, p.y, p.s);
    // garage pad
    g.fillStyle = '#6e747b'; g.fillRect(city.garage.x - 42, city.garage.y - 30, 84, 60);
    g.fillStyle = '#ffd94d'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('GARAGE', city.garage.x, city.garage.y + 4);
    return c;
  }

  function drawRoads(g) {
    g.fillStyle = '#3c4147';
    for (const x of STREETS_X) g.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD.h);
    for (const y of AVENUES_Y) g.fillRect(0, y - ROAD_W / 2, WORLD.w, ROAD_W);
    g.fillRect(0, 2548 - ROAD_W / 2, WORLD.w, ROAD_W);
    g.fillRect(0, 0, ROAD_W, WORLD.h); g.fillRect(WORLD.w - ROAD_W, 0, ROAD_W, WORLD.h); g.fillRect(0, 0, WORLD.w, ROAD_W);
    // edge lines
    g.strokeStyle = '#e8e8e8'; g.lineWidth = 3;
    for (const x of STREETS_X) { line(g, x - ROAD_W / 2 + 4, 0, x - ROAD_W / 2 + 4, WORLD.h); line(g, x + ROAD_W / 2 - 4, 0, x + ROAD_W / 2 - 4, WORLD.h); }
    for (const y of [...AVENUES_Y, 2548]) { line(g, 0, y - ROAD_W / 2 + 4, WORLD.w, y - ROAD_W / 2 + 4); line(g, 0, y + ROAD_W / 2 - 4, WORLD.w, y + ROAD_W / 2 - 4); }
    // centre dashes
    g.strokeStyle = '#ffd94d'; g.lineWidth = 3; g.setLineDash([26, 22]);
    for (const x of STREETS_X) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WORLD.h); g.stroke(); }
    for (const y of [...AVENUES_Y, 2548]) { g.beginPath(); g.moveTo(0, y); g.lineTo(WORLD.w, y); g.stroke(); }
    g.setLineDash([]);
    // crosswalks
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (const x of STREETS_X) for (const y of AVENUES_Y) {
      for (let i = -2; i <= 2; i++) { g.fillRect(x - 46 + i * 18, y - ROAD_W / 2 - 14, 10, 10); g.fillRect(x - 46 + i * 18, y + ROAD_W / 2 + 4, 10, 10); }
    }
  }
  function line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function drawTree(g, x, y, r) { g.fillStyle = '#2e6b34'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#3f8a46'; g.beginPath(); g.arc(x - 3, y - 3, r * 0.65, 0, 7); g.fill(); }
  function drawPalm(g, x, y, s) {
    g.strokeStyle = '#8a6a42'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5 * s, y - 16 * s); g.stroke();
    g.strokeStyle = '#2e8b4f'; g.lineWidth = 3 * s;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(x + 5 * s, y - 16 * s); g.quadraticCurveTo(x + 5 * s + Math.cos(a) * 14 * s, y - 16 * s + Math.sin(a) * 7 * s - 4, x + 5 * s + Math.cos(a) * 20 * s, y - 16 * s + Math.sin(a) * 12 * s + 4); g.stroke(); }
  }
  function drawBuilding(g, b) {
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    g.fillStyle = b.wall; g.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    g.fillStyle = b.roof; g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = b.roofDark; g.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    g.fillStyle = b.roof; g.fillRect(b.x + 14, b.y + 14, b.w - 28, b.h - 28);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < (b.ac || 0); i++) g.fillRect(b.x + 18 + i * 34, b.y + 18, 20, 14);
    if (b.landmark) {
      // awning
      g.fillStyle = '#d23c2e'; g.fillRect(b.x + b.w * 0.3, b.y + b.h - 4, b.w * 0.4, 12);
      g.fillStyle = '#ffffff'; for (let x = b.x + b.w * 0.3; x < b.x + b.w * 0.7; x += 16) g.fillRect(x, b.y + b.h - 4, 8, 12);
      g.fillStyle = '#ffffff'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3;
      const label = b.name.toUpperCase();
      g.strokeText(label, b.x + b.w / 2, b.y + b.h / 2 + 5);
      g.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }

  function drawCar(g, car, time) {
    g.save(); g.translate(car.x, car.y); g.rotate(car.angle);
    const w = car.w, h = car.h;
    g.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(g, -w / 2 + 3, -h / 2 + 4, w, h, 7); g.fill();
    g.fillStyle = car.color; roundRect(g, -w / 2, -h / 2, w, h, 7); g.fill();
    if (car.kind === 'police') { g.fillStyle = '#222'; roundRect(g, -w / 2, -h / 2, 12, h, 5); g.fill(); g.fillStyle = '#fff'; g.fillRect(-4, -h / 2, 16, h); }
    g.fillStyle = '#bfe8f5'; roundRect(g, 3, -h / 2 + 4, 11, h - 8, 3); g.fill(); // windshield
    g.fillStyle = '#7fb6c9'; roundRect(g, -15, -h / 2 + 5, 8, h - 10, 3); g.fill(); // rear
    g.fillStyle = '#fff8b0'; g.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5); g.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
    g.fillStyle = '#ff5544'; g.fillRect(-w / 2, -h / 2 + 2, 3, 5); g.fillRect(-w / 2, h / 2 - 7, 3, 5);
    if (car.kind === 'police') {
      const phase = Math.floor(time * 5 + (car.sirenPhase || 0)) % 2;
      g.fillStyle = phase ? '#ff2222' : '#ff8888'; g.fillRect(-6, -7, 6, 6);
      g.fillStyle = phase ? '#88aaff' : '#2255ff'; g.fillRect(0, 1, 6, 6);
      g.fillStyle = '#fff'; g.fillRect(-3, -3, 7, 7);
    }
    if (car.damage > 45) { g.fillStyle = 'rgba(40,40,40,0.35)'; roundRect(g, -w / 2, -h / 2, w * 0.5, h, 7); g.fill(); }
    g.restore();
    if (car.damage > 65) { g.fillStyle = 'rgba(90,90,90,0.5)'; g.beginPath(); g.arc(car.x - 14, car.y - 8, 7 + Math.sin(time * 7 + car.id) * 2, 0, 7); g.fill(); }
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function draw(state, focus) {
    if (!staticLayer) staticLayer = buildStatic(state.city);
    const vw = canvas.width, vh = canvas.height;
    const f = focus || state.player;
    let lookX = 0, lookY = 0;
    if (state.player.car) { lookX = state.player.car.vx * 0.42; lookY = state.player.car.vy * 0.42; }
    camera.x = Math.max(0, Math.min(WORLD.w - vw, f.x + lookX - vw / 2));
    camera.y = Math.max(0, Math.min(WORLD.h - vh, f.y + lookY - vh / 2));
    if (WORLD.w < vw) camera.x = (WORLD.w - vw) / 2;
    if (WORLD.h < vh) camera.y = (WORLD.h - vh) / 2;
    ctx.fillStyle = '#1668a0'; ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(staticLayer, camera.x, camera.y, vw, vh, 0, 0, vw, vh);
    const sx = (x) => x - camera.x, sy = (y) => y - camera.y;
    // markers
    const step = currentStep(state);
    if (step) { const mk = markerFor(state.city, step); if (mk) drawMarker(ctx, sx(mk.doorX), sy(mk.doorY), '#ffd94d', state.time); }
    if (state.taxi && state.taxi.phase === 'ride' && state.taxi.dest) drawMarker(ctx, sx(state.taxi.dest.x), sy(state.taxi.dest.y), '#ff9f2e', state.time);
    if (state.taxi && state.taxi.phase === 'hail' && state.taxi.ped) drawMarker(ctx, sx(state.taxi.ped.x), sy(state.taxi.ped.y - 20), '#ff9f2e', state.time);
    // peds
    for (const ped of state.peds) {
      if (ped.state === 'riding') continue;
      const x = sx(ped.x), y = sy(ped.y);
      if (x < -30 || y < -30 || x > vw + 30 || y > vh + 30) continue;
      if (ped.state === 'down') { ctx.fillStyle = ped.shirt; ctx.beginPath(); ctx.ellipse(x, y, 14, 6, ped.angle, 0, 7); ctx.fill(); ctx.fillStyle = '#f2c79b'; ctx.beginPath(); ctx.arc(x + 14, y, 5, 0, 7); ctx.fill(); continue; }
      ctx.fillStyle = ped.pants; ctx.beginPath(); ctx.arc(x, y + 3, 7, 0, 7); ctx.fill();
      ctx.fillStyle = ped.shirt; ctx.beginPath(); ctx.arc(x, y - 2, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2c79b'; ctx.beginPath(); ctx.arc(x, y - 3, 4.5, 0, 7); ctx.fill();
      if (ped.state === 'hail') { ctx.fillStyle = '#ff9f2e'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - 18); }
    }
    // cars
    for (const car of state.cars) {
      const x = sx(car.x), y = sy(car.y);
      if (x < -70 || y < -70 || x > vw + 70 || y > vh + 70) continue;
      const copy = { ...car, x, y };
      drawCar(ctx, copy, state.time);
    }
    // player on foot
    if (!state.player.car) {
      const x = sx(state.player.x), y = sy(state.player.y);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.stroke();
      ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(x, y + 3, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd94d'; ctx.beginPath(); ctx.arc(x, y - 2, 8.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2c79b'; ctx.beginPath(); ctx.arc(x, y - 3, 4.5, 0, 7); ctx.fill();
      if (state.player.hasPistol) { ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(state.player.angle) * 15, y + Math.sin(state.player.angle) * 15); ctx.stroke(); }
    }
    // bullets
    ctx.strokeStyle = '#ffe66d'; ctx.lineWidth = 2.5;
    for (const b of state.bullets) { ctx.beginPath(); ctx.moveTo(sx(b.x), sy(b.y)); ctx.lineTo(sx(b.x - b.vx * 0.02), sy(b.y - b.vy * 0.02)); ctx.stroke(); }
    // effects
    for (const e of state.effects) {
      const x = sx(e.x), y = sy(e.y); const k = 1 - e.t / e.life;
      if (e.type === 'spark') { ctx.strokeStyle = 'rgba(255,200,60,' + k + ')'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = i * 1.26 + e.x; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14 * k + 4, y + Math.sin(a) * 14 * k); ctx.stroke(); } }
      else if (e.type === 'smoke') { ctx.fillStyle = 'rgba(120,120,120,' + (k * 0.5) + ')'; ctx.beginPath(); ctx.arc(x, y - e.t * 22, 6 + e.t * 16, 0, 7); ctx.fill(); }
      else if (e.type === 'muzzle') { ctx.fillStyle = 'rgba(255,220,90,' + k + ')'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); }
      else if (e.type === 'punch') { ctx.strokeStyle = 'rgba(255,255,255,' + k + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 10, e.angle - 0.7, e.angle + 0.7); ctx.stroke(); }
      else if (e.type === 'text') { ctx.fillStyle = '#7dff8a'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; const ty = y - e.t * 26; ctx.strokeText(e.text, x, ty); ctx.fillText(e.text, x, ty); }
    }
    // vignette
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
    vg.addColorStop(0, 'rgba(255,170,60,0)');
    vg.addColorStop(1, 'rgba(80,30,0,0.28)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
  }
  function drawMarker(g, x, y, color, time) {
    const pulse = 1 + Math.sin(time * 5) * 0.18;
    g.fillStyle = color + '55'; g.beginPath(); g.ellipse(x, y, 30 * pulse, 12 * pulse, 0, 0, 7); g.fill();
    const grad = g.createLinearGradient(0, y - 130, 0, y);
    grad.addColorStop(0, 'rgba(255,217,77,0)'); grad.addColorStop(1, color + 'aa');
    if (color === '#ff9f2e') { grad.addColorStop(1, 'rgba(255,159,46,0.65)'); }
    g.fillStyle = grad; g.fillRect(x - 13, y - 130, 26, 130);
    g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, 30 * pulse, 12 * pulse, 0, 0, 7); g.stroke();
  }
  return { draw, camera };
}
