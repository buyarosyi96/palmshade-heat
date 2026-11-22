export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false, mouseClicked = false;
  const keyMap = (code) => code;
  window.addEventListener('keydown', (e) => {
    held.add(e.code);
    if (e.code === 'KeyE' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyF') actions |= ACTION_ENTER_CAR;
    if (e.code === 'KeyJ') actions |= ACTION_PUNCH;
    if (e.code === 'KeyM') actions |= ACTION_MUTE;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  if (canvas) {
    canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); mouseX = (e.clientX - r.left) * (canvas.width / r.width); mouseY = (e.clientY - r.top) * (canvas.height / r.height); });
    canvas.addEventListener('mousedown', (e) => { mouseDown = true; actions |= ACTION_PUNCH; });
    canvas.addEventListener('mouseup', () => { mouseDown = false; });
  }
  return {
    snapshot() {
      let moveX = 0, moveY = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) moveX -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) moveX += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) moveY -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) moveY += 1;
      return { moveX, moveY, run: held.has('ShiftLeft') || held.has('ShiftRight'), brake: held.has('Space'), mouseDown, mouseX, mouseY, throttle: -moveY, steer: moveX };
    },
    takeActions() { const a = actions; actions = 0; return a; },
    held,
  };
}
