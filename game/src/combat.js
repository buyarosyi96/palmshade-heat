import { knockDown } from './people.js';
import { reportCrime } from './police.js';

export function addEffect(state, type, x, y, text) {
  state.effects.push({ type, x, y, t: 0, life: type === 'text' ? 1.1 : 0.3, text: text || '' });
}

export function punch(state, effects) {
  const p = state.player;
  if (p.car) return;
  const now = state.time;
  if (p.punchCd && now - p.punchCd < 0.32) return;
  p.punchCd = now;
  effects.push({ type: 'punch', x: p.x + Math.cos(p.angle) * 20, y: p.y + Math.sin(p.angle) * 20, angle: p.angle, t: 0, life: 0.18 });
  if (state.audio) state.audio.thud();
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - p.x, dy = ped.y - p.y;
    const d = Math.hypot(dx, dy);
    const dot = d > 0 ? (dx * Math.cos(p.angle) + dy * Math.sin(p.angle)) / d : 0;
    if (d < 36 && dot > 0.35) {
      const cash = knockDown(ped);
      reportCrime(state.wanted, 2);
      if (cash > 0) { p.money += cash; effects.push({ type: 'text', x: ped.x, y: ped.y - 16, t: 0, life: 1.1, text: '+$' + cash }); if (state.audio) state.audio.cash(); }
      ped.state = 'down';
    }
  }
}

export function shoot(state, bullets, effects, aimX, aimY) {
  const p = state.player;
  if (p.car || !p.hasPistol || p.ammo <= 0) return;
  const now = state.time;
  if (p.shootCd && now - p.shootCd < 0.24) return;
  p.shootCd = now; p.ammo -= 1;
  const dx = aimX - p.x, dy = aimY - p.y; const d = Math.hypot(dx, dy) || 1;
  bullets.push({ x: p.x + (dx / d) * 16, y: p.y + (dy / d) * 16, vx: (dx / d) * 920, vy: (dy / d) * 920, life: 0.55 });
  effects.push({ type: 'muzzle', x: p.x + (dx / d) * 18, y: p.y + (dy / d) * 18, t: 0, life: 0.07 });
  p.angle = Math.atan2(dy, dx);
  if (state.audio) state.audio.gunshot();
}

export function updateBullets(state, dt) {
  const bullets = state.bullets;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    // buildings
    for (const bd of state.city.buildings) {
      if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { state.effects.push({ type: 'spark', x: b.x, y: b.y, t: 0, life: 0.25 }); dead = true; break; }
    }
    if (!dead) for (const car of state.cars) {
      if (Math.hypot(car.x - b.x, car.y - b.y) < car.radius + 3) {
        car.damage = Math.min(100, car.damage + 18);
        state.effects.push({ type: 'spark', x: b.x, y: b.y, t: 0, life: 0.25 });
        reportCrime(state.wanted, car.kind === 'police' ? 3 : 1);
        dead = true; break;
      }
    }
    if (!dead) for (const ped of state.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
        const cash = knockDown(ped);
        if (cash) state.effects.push({ type: 'text', x: ped.x, y: ped.y - 14, t: 0, life: 1, text: '$' + cash });
        reportCrime(state.wanted, 2);
        dead = true; break;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

export function runOverCheck(state) {
  const car = state.player.car;
  if (!car || Math.abs(car.speed || 0) < 35) return;
  for (const ped of state.peds) {
    if (ped.state === 'down' || ped.state === 'riding') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.radius + 10) {
      const cash = knockDown(ped);
      state.player.health -= 2;
      reportCrime(state.wanted, 2);
      if (cash) state.effects.push({ type: 'text', x: ped.x, y: ped.y - 14, t: 0, life: 1, text: '$' + cash });
      car.speed *= 0.82;
      if (state.audio) state.audio.thud();
    }
  }
}
