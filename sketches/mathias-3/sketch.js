import { createEngine } from "../_shared/engine.js"
import { Spring } from "../_shared/spring.js"

const { renderer, input, math, audio, run, finish, } = createEngine()
const { ctx, canvas } = renderer

const EndSound = await audio.load({
    src: "assets/End-sound-01.mp3",
    loop: false
})


const correctFinishSound = await audio.load({
    src: "assets/correct.mp3",
    loop: false
})

const mouseMoveSound = await audio.load({
    src: "assets/moving.wav",
    loop: true
})

run(update)


  class ClassRect {
  constructor(x, y, size, ctx) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.ctx = ctx;
  }
  draw(s = 1) {
    this.ctx.save();
    this.ctx.globalAlpha = 0;
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    this.ctx.translate(cx, cy);
    this.ctx.scale(s, s);
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size)
    this.ctx.restore();
  }

  // draw with controllable opacity (0..1)
  drawWhite(alpha = 1, s = 1) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    this.ctx.translate(cx, cy);
    this.ctx.scale(s, s);
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    this.ctx.restore();
  }

  // draw black with alpha (for fade-out)
  drawBlack(s = 1) {
    this.ctx.save();
    this.ctx.globalAlpha = 0;
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    this.ctx.translate(cx, cy);
    this.ctx.scale(s, s);
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    this.ctx.restore();
  }

  // helper to test point inside this rect
  contains(px, py) {
    return px >= this.x && px <= this.x + this.size && py >= this.y && py <= this.y + this.size;
  }
}

    let rects = [] ;  

const cols = 7;
const rows = 12;
// Use devicePixelRatio to keep layout consistent across displays.
const DPR = window.devicePixelRatio || 1;
// Compute CSS-cell size based on canvas client size so the grid fits the window (checked once at startup)
const clientW = canvas.clientWidth || (canvas.width / DPR);
const clientH = canvas.clientHeight || (canvas.height / DPR);
// Outer margin in CSS pixels (adjust to increase/decrease space around the grid)
const MARGIN_CSS = 100;
// Available area (CSS px) after reserving margins on both sides
const availableW = Math.max(0, clientW - 2 * MARGIN_CSS);
const availableH = Math.max(0, clientH - 2 * MARGIN_CSS);
// Choose the largest integer cell (CSS px) that fits the available area
let CELL_CSS = Math.floor(Math.min(availableW / cols, availableH / rows));
if (CELL_CSS < 8) CELL_CSS = 8; // minimum cell size
// Make rect slightly smaller than cell so there's padding
let RECT_SIZE_CSS = Math.max(4, Math.floor(CELL_CSS * 0.75));
// convert to canvas (device) pixels
const cell = Math.round(CELL_CSS * DPR);
const rectSize = Math.round(RECT_SIZE_CSS * DPR);
// taille totale de la grille (in device pixels)
const gridW = cols * cell;
const gridH = rows * cell;
// compute margin in device pixels and center the grid inside the area left after margins
const margin = Math.round(MARGIN_CSS * DPR);
const startX = margin + Math.round((canvas.width - 2 * margin - gridW) / 2);
const startY = margin + Math.round((canvas.height - 2 * margin - gridH) / 2);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const rectX = startX + j * cell;
        const rectY = startY + i * cell;
        rects.push(new ClassRect(rectX, rectY, rectSize, ctx, ));
      }
    }


let RectChange = new Set()
let Revealed = new Set() // <- new: selected rects that have been revealed by hover

// scale animation state (used to animate all rects to a larger size)
let currentScale = 1;
let targetScale = 1;
let scaling = false;
const SCALE_TARGET = 1.5;
const SCALE_SMOOTH = 6; // larger = faster
// global alpha multiplier for white rects (set to 0 to hide all whites)
let globalAlpha = 1;

// pointer tracking for hover detection
let mouseX = -1;
let mouseY = -1;
let hoveredSelected = false; // true when mouse is over any selected rect
let hoveredSelectedRect = null; // reference to the rect under pointer if any
// require the pointer to be held down to reveal
let isPointerDown = false;
// whether the user has moved the mouse over any rect (used to disable automatic first reveal)
let mouseMovedOverAnyRect = false;

// mouse-move sound control
let prevMouseX = 0;
let prevMouseY = 0;
let prevMouseTime = performance.now();
let mouseMoveHandle = null;
let mouseMoveDisabled = false; // when true, do not start/resume moving sound
// tuning: map speed (px/s) to playback rate
const MOUSE_MOVE_MIN_RATE = 0.9;
const MOUSE_MOVE_MAX_RATE = 3.0;
const MOUSE_MOVE_MAX_SPEED = 2000; // px/s -> clamp
const MOUSE_MOVE_MIN_VOLUME = 0.08;
const MOUSE_MOVE_MAX_VOLUME = 2.0;

// named pointer handlers so we can remove them when fade-out begins
function handlePointerMove(e) {
  const br = canvas.getBoundingClientRect();
  mouseX = (e.clientX - br.left) * (canvas.width / br.width);
  mouseY = (e.clientY - br.top) * (canvas.height / br.height);
  // if pointer moved over any *selected* rect, mark flag so we won't auto-activate the first rect
  for (const entry of selected) {
    const rect = entry.rect;
    if (mouseX >= rect.x && mouseX <= rect.x + rect.size && mouseY >= rect.y && mouseY <= rect.y + rect.size) {
      mouseMovedOverAnyRect = true;
      break;
    }
  }

  // compute pointer speed (px/s) and drive the moving sound when pointer is down
  const now = performance.now();
  const dt = Math.max(1, now - prevMouseTime) / 1000; // seconds
  const dx = mouseX - prevMouseX;
  const dy = mouseY - prevMouseY;
  const speed = Math.hypot(dx, dy) / dt; // px/s
  prevMouseX = mouseX;
  prevMouseY = mouseY;
  prevMouseTime = now;

  // only play/mix the moving sound while pointer is down and not disabled
  if (isPointerDown && !mouseMoveDisabled) {
    // map speed to rate and volume
    const s = Math.max(0, Math.min(MOUSE_MOVE_MAX_SPEED, speed));
    const t = s / MOUSE_MOVE_MAX_SPEED; // 0..1
    const rate = MOUSE_MOVE_MIN_RATE + t * (MOUSE_MOVE_MAX_RATE - MOUSE_MOVE_MIN_RATE);
    const volume = MOUSE_MOVE_MIN_VOLUME + t * (MOUSE_MOVE_MAX_VOLUME - MOUSE_MOVE_MIN_VOLUME);

    // start the looped sound if not playing
    try {
      if (!mouseMoveSound.isPlaying()) {
        mouseMoveHandle = mouseMoveSound.play({ rate, volume });
      } else if (mouseMoveHandle) {
        mouseMoveHandle.setRate(rate);
        mouseMoveHandle.setVolume(volume);
      }
    } catch (err) {
      // ignore audio errors
    }
  } else {
    // when pointer not down, gently silence the moving sound (if we can)
    try {
      if (mouseMoveSound.isPlaying() && mouseMoveHandle) {
        mouseMoveHandle.setVolume(0);
      }
    } catch (err) {}
  }
}

function handlePointerDown(e) {
  isPointerDown = true;
  const br = canvas.getBoundingClientRect();
  mouseX = (e.clientX - br.left) * (canvas.width / br.width);
  mouseY = (e.clientY - br.top) * (canvas.height / br.height);
  for (const entry of selected) {
    if (entry.rect.contains(mouseX, mouseY)) {
      Revealed.add(entry.i);
      hoveredSelectedRect = entry.rect;
      hoveredSelected = true;
      break;
    }
  }

  // initialize prev pointer for speed calculations so first delta isn't huge
  prevMouseX = mouseX;
  prevMouseY = mouseY;
  prevMouseTime = performance.now();
}

function handlePointerUp() { isPointerDown = false; }
function handlePointerCancel() { isPointerDown = false; }
function handlePointerOut() { isPointerDown = false; }

canvas.addEventListener('mousemove', handlePointerMove);
canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerCancel);
canvas.addEventListener('pointerout', handlePointerOut);

/*
function disableInteractions() {
  // remove pointer listeners and prevent further clicks
  try {
    canvas.removeEventListener('mousemove', handlePointerMove);
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerCancel);
    canvas.removeEventListener('pointerout', handlePointerOut);
  } catch (err) {
    // ignore removal errors
  }
  // clear pointer state and reset cursor
  isPointerDown = false;
  mouseX = -1;
  mouseY = -1;
  canvas.style.cursor = 'default';
}
*/



/*
function setRandomRectRed() {
  while (RectChange.size < 10) {
    RectChange.add(Math.floor(Math.random() * rects.length));
  }
  console.log(Array.from(RectChange));
}
//setRandomRectRed();
console.log(rects);
*/

function addRange(start, end) {
  // inclusive range, supports start === end
  for (let n = start; n <= end; n++) RectChange.add(n);
}

function setRectRed(ranges) {
  for (const r of ranges) {
    const [a, b] = r;
    addRange(Math.min(a, b), Math.max(a, b));
  }
  //console.log(Array.from(RectChange));
}


setRectRed([[0,13],[19,20], [26,27], [33,34], [35, 48], [54, 55], [61, 62], [68, 69], [70, 83]]);         

/*
canvas.addEventListener('pointerdown', (e) => {
  const br = canvas.getBoundingClientRect();
  const mx = (e.clientX - br.left) * (canvas.width / br.width);
  const my = (e.clientY - br.top) * (canvas.height / br.height);

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (mx >= r.x && mx <= r.x + r.size && my >= r.y && my <= r.y + r.size) {
      console.log('clicked rect index:', i, 'rect:', r);
      break; // remove if you want multiple hits
    }
  }
}); */

const HoverRadius = 100;

// fade controls (seconds to full opacity)
const FadeSpeed = 1.0; 
const FadeIns = new Map(); // index -> progress (0..1)

// selected/others will be recomputed each frame in update

let selected = [];
let others = [];
  rects.forEach((rect, i) => {
    if (RectChange.has(i)) selected.push({ rect, i });
    else others.push({ rect, i });
  });

setTimeout(() => startVisible(), 2000);

const startVisible = () => {
  // pick the first selected index from RectChange (safe even if selected not built yet)
  const first = Array.from(RectChange)[0];
  if (first === undefined) return;
  // begin fade-in for that index
  // do not auto-activate first rect if the user has already moved the mouse over any rect
  if (mouseMovedOverAnyRect) {
    console.log('startVisible skipped because mouse moved over a rect');
    return;
  }
  

  FadeIns.set(first, 0);
  console.log("start fade in index", first);
}

function allSelectedRevealed() {
  if (RectChange.size === 0) return false;
  for (const idx of RectChange) {
    if (!Revealed.has(idx)) return false;
  }
  return true;
}



let allRevealedTriggered = false;
function onAllRevealed() {
  // start scaling all rects toward the target
  targetScale = SCALE_TARGET;
  scaling = true;
  correctFinishSound.play();
}

function update(dt) {
  

  canvas.style.background = "black";

  // recompute selected/others each frame


  // pointer hover reveal (persistent) — require pointer to be down while passing over
  // but DO NOT reveal anymore once fade-out has started (prevents re-appearing before finish)
  hoveredSelected = false;
  hoveredSelectedRect = null;
  if (isPointerDown && mouseX >= 0 && mouseY >= 0) {
    for (const entry of selected) {
      if (entry.rect.contains(mouseX, mouseY)) {
        hoveredSelected = true;
        hoveredSelectedRect = entry.rect;
        Revealed.add(entry.i);
        break;
      }
    }
  }

  // advance ongoing fade-ins (only those in FadeIns)
  if (FadeIns.size > 0) {
    for (const [i, prog] of Array.from(FadeIns.entries())) {
      const next = Math.min(1, prog + dt / FadeSpeed);
      if (next >= 1) {
        FadeIns.delete(i);
        Revealed.add(i);
      } else {
        FadeIns.set(i, next);
      }
    }
  }

  

  // draw selected: combine fade-in, revealed, proximity-based alpha and fade-outs
  selected.forEach(({ rect, i }) => {
    let alpha = 0;
    if (FadeIns.has(i)) {
      alpha = FadeIns.get(i);
    } else if (Revealed.has(i)) {
      alpha = 1;
    } else if (mouseX >= 0 && mouseY >= 0) {
      const cx = rect.x + rect.size / 2;
      const cy = rect.y + rect.size / 2;
      const d = Math.hypot(mouseX - cx, mouseY - cy);
      alpha = Math.max(0, 1 - d / HoverRadius);
    }

 

    if (alpha > 0) rect.drawWhite(alpha * globalAlpha, currentScale);
  });

  // draw non-selected rects (respect global scale)
  others.forEach(({ rect, i }) => {
    rect.draw(currentScale);
  });

  if (!allRevealedTriggered && allSelectedRevealed()) {
    allRevealedTriggered = true;
    onAllRevealed();
  }

  // advance global scale toward target when scaling is active
  if (scaling) {
    const a = 1 - Math.exp(-SCALE_SMOOTH * dt);
    currentScale += (targetScale - currentScale) * a;
    if (Math.abs(currentScale - targetScale) < 0.001) {
      currentScale = targetScale;
      scaling = false;
      if (currentScale >= targetScale) {
        setTimeout(() => {
          EndSound.play()
          globalAlpha = 0;
          // mute / disable mouse-move sound when the final end sound plays
          try {
            mouseMoveDisabled = true;
            if (mouseMoveSound.isPlaying() && mouseMoveHandle) {
              mouseMoveHandle.setVolume(0);
            }
          } catch (err) { /* ignore audio errors */ }
        }, 1500);
        setTimeout(() => {finish();}, 2000);
        
      }
    }
  }

}

/*
class Circle {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 14;
    ctx.stroke();
  }
}

*/
 

  
/*
  if (scale <= 0) {
    finish()
  }
*/

