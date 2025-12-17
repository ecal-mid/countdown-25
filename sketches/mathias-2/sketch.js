import { createEngine } from "../_shared/engine.js"
// import { Spring } from "../_shared/spring.js"

const { renderer, input, math, audio, run, finish, } = createEngine()
const { ctx, canvas } = renderer

let clickSoundActive = true
const clickSound = await audio.load({
    src: "assets/Punch-02.mp3",
})

const correctFinishSound = await audio.load({
    src: "assets/correct.mp3",
    loop: false
})

const EndSound = await audio.load({
    src: "assets/End-sound-01.mp3",
    loop: false
})


/*
impactSound.play({
            rate: 1 + Math.random() * 1,
            volume: 0.5 + Math.random() * 0.5
        })
*/






  class ClassRect {
  constructor(x, y, size, ctx) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.ctx = ctx;
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
  drawBlack(alpha = 1, s = 1) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    // fill shade depends on rotateCount: 0 -> black, higher -> lighter grey
    const rc = this.rotateCount || 0;
    const grey = Math.min(255, rc * 10);
    this.ctx.fillStyle = `rgb(${grey},${grey},${grey})`;
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = `rgb(${grey},${grey},${grey})`;

    // choose rotation origin (supports 'center' and 'bottomRight')
    let offsetX = this.size / 2;
    let offsetY = this.size / 2;
    if (this.rotationOrigin === 'bottomRight') {
      offsetX = this.size;
      offsetY = this.size;
    }
    const centerx = this.x + offsetX;
    const centery = this.y + offsetY;
    this.ctx.translate(centerx, centery);
    // apply scaling around the chosen origin
    this.ctx.scale(s, s);
    const angle = this.angle || 0;
    this.ctx.rotate(angle);
    this.ctx.fillRect(-offsetX, -offsetY, this.size, this.size);
    this.ctx.strokeRect(-offsetX, -offsetY, this.size, this.size);
    this.ctx.restore();
  }

  // generic draw that respects scaling around center
  draw(s = 1) {
    this.ctx.save();
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
        // initialize base position and fallen flag for originals
        const r = rects[rects.length - 1];
        r.baseX = r.x;
        r.baseY = r.y;
        r.fallen = false;
      }
    }




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
}); 



let RectChange = new Set()

function addRange(start, end) {
  // inclusive range, supports start === end
  for (let n = start; n <= end; n++) RectChange.add(n);
}

function selectRect(ranges) {
  for (const r of ranges) {
    const [a, b] = r;
    addRange(Math.min(a, b), Math.max(a, b));
  }
  //console.log(Array.from(RectChange));
}


selectRect([[0,13],[19,20], [26,27], [33,34], [35, 50], [56, 57], [63, 64], [70, 83] ]);         


// selected/others will be recomputed each frame in update

ClassRect.prototype.clone = function() {
  const clone = new ClassRect(this.x, this.y, this.size, this.ctx);
  clone.baseX = this.x;
  clone.baseY = this.y;
  clone.fallen = false;
  // rotation state for this clone (optional)
  clone.angle = 0;
  clone.angleTarget = 0;
  clone.angleSpeed = 0.5; // radians per second max change
  clone.isRotating = false;
  // masks rotate around bottom-right by default
  clone.rotationOrigin = 'bottomRight';
  // count how many rotation steps this mask has taken
  clone.rotateCount = 0;
  return clone;
};

let selected = [];
let notDraw = [];
let mask = []

// scale animation state (animate all rects when masks have fallen)
let currentScale = 1;
let targetScale = 1;
let scaling = false;
const SCALE_TARGET = 1.5;
const SCALE_SMOOTH = 6; // larger = faster
let allMasksFallenTriggered = false;

// global alpha used for final fade-out
let globalAlpha = 1;
// ensure we only schedule the end sequence once
let endSequenceScheduled = false;

// click counter to scale how many masks are affected per click
let clickCount = 0;

// small canvas punch rotation (spring)
let punchAngle = 0;
let punchVel = 0;
const punchSpring = 800; // stiffness
const punchDamp = 56; // damping

// rotating-mask selection: after a short delay one mask will tilt/rotate
let rotatingMaskIndex = -1;
const rotationDelay = 1.8; // seconds until one mask starts to rotate
const rotationAngle = -8 * (Math.PI / 180); // radians (~8 degrees)
let rotationTimeoutId = null;
let rotationScheduled = false;

// falling physics
const gravity = 2000; // px/s^2
//map is used to track falling rects
const falling = new Map(); 
// map to track falling for original selected rects
const fallingSelected = new Map();


// click to make a random mask rect fall
canvas.addEventListener('click', (e) => {
  // if clicks are disabled (end of sequence), ignore the event
  if (!clickSoundActive) return;
 clickSound.play(); 
  
  // if a rotation was scheduled but hasn't started yet, cancel it
  if (rotationScheduled && rotationTimeoutId) {
    clearTimeout(rotationTimeoutId);
    rotationTimeoutId = null;
    rotationScheduled = false;
    rotatingMaskIndex = -1;
    console.log('rotation canceled by click before start');
    // continue to also trigger falling behavior below
  }
  // pick up to N random available masks and advance each one's rotation step
  clickCount += 1;
  const available = [];
  for (let i = 0; i < mask.length; i++) {
    // only consider mask entries that are not currently falling and haven't already fallen
    if (!falling.has(i) && !mask[i].fallen) available.push(i);
  }

  /*
  if (available.length === 0) {
    // no mask available -> only trigger final fall/finish if final click is enabled
    if (finalClickEnabled) {
      selected.forEach((entry, selectIndex) => {
        const { rect } = entry;
        if (!fallingSelected.has(selectIndex) && !rect.fallen) {
          fallingSelected.set(selectIndex, { vy: 0 });
        }
      });
      setTimeout(() => {
        console.log('final click: no masks left — finishing now');
        finish();
      }, 2000);
    } else {
      console.log('final click ignored: masks are not fully fallen or delay not elapsed');
    }
    return;
  }
    */
  // decide how many masks to affect this click: 1 + floor(clickCount / 3)
  const maxActive = 1 + Math.floor(clickCount / 3);
  const take = Math.min(maxActive, available.length);

  // compute click position in canvas space
  const br = canvas.getBoundingClientRect();
  const mx = (e.clientX - br.left) * (canvas.width / br.width);
  const my = (e.clientY - br.top) * (canvas.height / br.height);

  // If there are available masks, prefer those closer to the click using weighted sampling
  let chosen = [];
  if (available.length > 0) {
    // build distances
    const items = available.map(idx => {
      const r = mask[idx];
      const cx = r.x + r.size / 2;
      const cy = r.y + r.size / 2;
      const d = Math.hypot(mx - cx, my - cy);
      return { idx, d };
    });
    const maxD = items.reduce((m, it) => Math.max(m, it.d), 0);
    // compute a weight favoring small distances; if all distances are zero, use equal weights
    let pool = items.map(it => ({ idx: it.idx, w: maxD === 0 ? 1 : Math.pow(maxD - it.d + 1, 2) }));
    // weighted sampling without replacement
    for (let k = 0; k < take && pool.length > 0; k++) {
      const sum = pool.reduce((s, p) => s + p.w, 0);
      let r = Math.random() * sum;
      let acc = 0;
      let pick = 0;
      for (let i = 0; i < pool.length; i++) {
        acc += pool[i].w;
        if (r <= acc) { pick = i; break; }
      }
      chosen.push(pool[pick].idx);
      pool.splice(pick, 1);
    }
  }
  chosen.forEach(index => {
    const m = mask[index];
    if (typeof m.rotateCount !== 'number') m.rotateCount = 0;
    m.rotateCount += 1;
    m.rotationOrigin = 'bottomRight';
    m.angleTarget = rotationAngle * m.rotateCount;
    m.isRotating = true;
    console.log('mask', index, 'rotation step', m.rotateCount, 'angleTarget=', m.angleTarget.toFixed(3));
    if (m.rotateCount >= 3) {
      falling.set(index, { vy: 0 });
      console.log('mask', index, 'completed 3 rotations -> start falling');
    }
  });

  // apply a small punch impulse to the canvas rotation on every click
  const impulse = 4; // radians
  punchVel += (Math.random() < 0.5 ? -1 : 1) * impulse;



  if (available.length === 1) {
    console.log('all mask rects are now down');
    // start falling for all original selected rects on next click
    // (the case where available becomes 0 is handled by the code below - keep this log)
  }
  
  
});

  rects.forEach((rect, i) => {
    if (RectChange.has(i)) selected.push({ rect, i });
    else notDraw.push({ rect, i });
    mask = selected.map(({ rect }) => rect.clone());
   // console.log(mask.length, mask[0]);
  });

// schedule rotation using setTimeout; clicking before timeout will cancel it
if (mask.length) {
  rotationScheduled = true;
  rotationTimeoutId = setTimeout(() => {
    // use fixed target index (assumed valid)
    const targetIndex = 15;
 
    const m = mask[targetIndex];
    // behave like the click-driven rotation: increment rotateCount,
    // update angleTarget based on rotateCount, and start falling when >=3
    if (m && !falling.has(targetIndex) && !m.fallen) {
      if (typeof m.rotateCount !== 'number') m.rotateCount = 0;
      m.rotateCount += 1;
      // rotate around bottom-right for this scheduled mask
      m.rotationOrigin = 'bottomRight';
      m.angleTarget = rotationAngle * m.rotateCount;
      m.isRotating = true;
    } else {
      console.log('scheduled rotation skipped for index', index, '- missing or already falling');
    }
    rotationScheduled = false;
    rotationTimeoutId = null;
  }, rotationDelay * 1000);
}

//setTimeout(() => functiontest(), 2000);


function update(dt) {
  canvas.style.background = "black";

  // Protect against very large `dt` values (tab inactive / resume) which
  // can cause large integrated impulses (e.g. punchAngle) and visible jumps.
  // If dt is huge we zero sensitive velocities and clamp dt for stable integration.
  if (dt > 0.12) {
    // Likely resumed from background — clear punch velocity to avoid a big angular jump
    punchVel = 0;
  }
  const MAX_DT = 1 / 30; // ~33ms per frame
  dt = Math.min(dt, MAX_DT);


  // --- Canvas "punch" rotation (damped spring) ---
  // Use a simple spring: angular acceleration = -k * angle - c * angularVelocity
  // Integrate acceleration -> velocity -> angle (semi-implicit integration for stability)
  const punchAcceleration = -punchSpring * punchAngle - punchDamp * punchVel;
  punchVel += punchAcceleration * dt; // update angular velocity
  punchAngle += punchVel * dt;       // update angle

  // Apply the canvas-level rotation around the canvas center.
  // Save here and restore after all scene drawing to keep transform local.
  ctx.save();
  const canvasCenterX = canvas.width / 2;
  const canvasCenterY = canvas.height / 2;
  ctx.translate(canvasCenterX, canvasCenterY);
  ctx.rotate(punchAngle);
  ctx.translate(-canvasCenterX, -canvasCenterY);

  //end punch
  // draw selected originals and animate their falling when scheduled
  selected.forEach(({ rect }, selectedIndex) => {
    const fall = fallingSelected.get(selectedIndex);
    if (fall) {
      fall.vy += gravity * dt;
      rect.y += fall.vy * dt;
      if (rect.y - rect.size > canvas.height) {
        rect.fallen = true;
        fallingSelected.delete(selectedIndex);
      }
    } else {
      if (!rect.fallen) rect.y = rect.baseY;
    }
    rect.drawWhite(globalAlpha, currentScale);
  });

  // rotation timer: after a short delay pick one available mask to tilt
  // (rotation scheduled via setTimeout; canceled on click if needed)

// update falling mask rects (simple gravity) and draw them with falling ones on top
for (let index = 0; index < mask.length; index++) {
  const rect = mask[index];
  const fall = falling.get(index);
  if (fall) {
    fall.vy += gravity * dt;
    rect.y += fall.vy * dt;
    // when off-screen, mark as fallen (so it won't snap back) and stop updating velocity
    if (rect.y - rect.size > canvas.height) {
      rect.fallen = true;
      falling.delete(index);
    }
  } else {
    // keep at base position when not falling and not already fallen
    if (!rect.fallen) rect.y = rect.baseY;
  }
  // animate rotation toward target if this clone was selected to rotate
  if (rect.isRotating && !rect.fallen) {
    const diff = rect.angleTarget - rect.angle;
    const maxDelta = rect.angleSpeed * dt;
    rect.angle += Math.max(-maxDelta, Math.min(maxDelta, diff));
  }
  if (rect.fallen) rect.isRotating = false;
}
// draw masks so falling ones appear on top: first non-falling, then falling
for (let index = 0; index < mask.length; index++) {
  const rect = mask[index];
  if (!falling.has(index)) {
    rect.drawBlack(globalAlpha, currentScale);
  }
}
for (let index = 0; index < mask.length; index++) {
  const rect = mask[index];
  if (falling.has(index)) {
    rect.drawBlack(globalAlpha, currentScale);
  }
}
  
  // detect when all masks have fallen; trigger scaling once
  if (!allMasksFallenTriggered && mask.length > 0) {
    let allFallen = true;
    for (const m of mask) {
      if (!m.fallen) { allFallen = false; break; }
    }
    if (allFallen) {
      correctFinishSound.play()
      allMasksFallenTriggered = true;
      targetScale = SCALE_TARGET;
      scaling = true;
      console.log('all masks fallen -> starting scale-up to', SCALE_TARGET);
      // enable final click after a short delay so user can't trigger finish immediately
      
    }
  }

  // restore canvas transform from punch
  ctx.restore();

  // advance global scale toward target when scaling is active
  if (scaling) {
    const a = 1 - Math.exp(-SCALE_SMOOTH * dt);
    currentScale += (targetScale - currentScale) * a;
    if (Math.abs(currentScale - targetScale) < 0.001) {
      currentScale = targetScale;
      scaling = false;
    }
  }

  // when we've reached the target scale (and masks have fallen), schedule a small delay, fade out, then finish
  // Note: `targetScale` starts at 1, so guard with `allMasksFallenTriggered` to avoid scheduling immediately.
  if (!endSequenceScheduled && allMasksFallenTriggered && currentScale >= targetScale) {
    endSequenceScheduled = true;
    
    setTimeout(() => {
      globalAlpha = 0;
      clickSoundActive = false;
      EndSound.play()
    }, 1500);
    setTimeout(() => {
      finish();
    }, 2000);
  }

}

run(update)