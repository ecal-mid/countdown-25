import { createEngine } from "../_shared/engine.js"
import { Spring } from "../_shared/spring.js"


const { renderer, input, math, audio, run, finish, } = createEngine()
const { ctx, canvas } = renderer


const EndSound = await audio.load({
    src: "assets/End-sound-01.mp3",
    loop: false
})

const correctFinishSound = await audio.load({
    src: "assets/correct-Finish.mp3",
    loop: false
})



const popRectSound = await audio.load({
    src: "assets/pop.wav",
  })
  


let alphaLvl = 1; // global alpha for selected rects
// scale state (applies to drawWhite)
// per-rect scale is stored on each rect as `rect.scale` and grows after a random delay
let scale = 0; // legacy — per-rect `rect.scale` will be used instead
// configuration for scale change per second
const SCALE_RATE = 0.3; // units per second
const SCALE_MIN = 0.001;
const SCALE_MAX = 0.2;
// maximum random delay (seconds) before a rect begins growing
const MAX_START_DELAY = 0.5;
// when holding/clicking, target scale for rects
const HOLD_SCALE = 3;
// smoothing for transitions toward hold/release target
const SCALE_SMOOTH = 0.1  ;

let mouseIsDown = false;
let mouseX = 0;
let mouseY = 0;
// spring movement config for pushing rects outward when they hit their cap
const SPRING_FREQUENCY = 6; // Hz
const SPRING_HALF_LIFE = 0.01; // seconds
// multiply vector from center by this factor to compute push target
const PUSH_FACTOR = 1.5;
// pointer influence config: radius in px and maximum extra grow multiplier
const POINTER_INFLUENCE_RADIUS = 200;
const POINTER_GROW_BOOST = 80; // at pointer center, growth rate multiplier = 1 + POINTER_GROW_BOOST
// end sequence guard
let endSequenceScheduled = false;
// ensure correctFinishSound only plays once
let correctFinishPlayed = false;
// when every rect has reached its alert color, launch an escape outward
let escapeTriggered = false;
const ESCAPE_DISTANCE_MULT = 0.9; // multiply canvas diagonal to push targets outside the window


/*
const spring = new Spring({
  position: 0
}) */


  class ClassRect {
  constructor(x, y, size, ctx) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.ctx = ctx;
  }



  // draw with controllable opacity (0..1) and optional scale
  drawWhite(s = 1) {
    this.ctx.save();
    this.ctx.globalAlpha = alphaLvl;
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    this.ctx.translate(cx, cy);
    this.ctx.scale(s, s);
    // Color logic:
    // - if the rect reached its maxScaleCap, draw its alertColor
    // - otherwise interpolate grayscale from black -> white as scale goes 0 -> WHITE_THRESHOLD
    const WHITE_THRESHOLD = 1.5;
    if (typeof this.maxScaleCap !== 'undefined' && s >= this.maxScaleCap) {
      this.ctx.fillStyle = this.alertColor || "white";
    } else {
      const t = Math.max(0, Math.min(1, s / WHITE_THRESHOLD));
      const g = Math.round(t * 255);
      this.ctx.fillStyle = `rgb(${g}, ${g}, ${g})`;
    }
    this.ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    this.ctx.restore();
  }

  // do not draw (invisible)
  drawNot() {
    this.ctx.save();
    this.ctx.globalAlpha = 0;
    this.ctx.fillStyle = "red";
    this.ctx.fillRect(this.x, this.y, this.size, this.size);
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
          const r = new ClassRect(rectX, rectY, rectSize, ctx);
          // initialize per-rect growth state
          r.scale = SCALE_MIN;
          r.growDelay = Math.random() * MAX_START_DELAY; // seconds
          // randomize growth speed slightly for variety
          r.growRate = SCALE_RATE * (0.6 + Math.random() * 0.8);
          // store creation time so delays are simple to evaluate later
          r._createdAt = performance.now() / 1000;
              // assign a random threshold between 2 and HOLD_SCALE where the rect will turn alert
              r.maxScaleCap = 2.5 + Math.random() * Math.max(0, (HOLD_SCALE - 2.5));
              // assign a random alert color (HSL for good saturation/contrast)
              const hue = Math.floor(Math.random() * 360);
              r.alertColor = `hsl(${hue} 70% 50%)`;
              rects.push(r);
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
  // record pointer for influence and mark held
  mouseX = mx; mouseY = my;
  mouseIsDown = true;
}); 

canvas.addEventListener('pointerup', (e) => {
  mouseIsDown = false;
});

canvas.addEventListener('pointermove', (e) => {
  const br = canvas.getBoundingClientRect();
  mouseX = (e.clientX - br.left) * (canvas.width / br.width);
  mouseY = (e.clientY - br.top) * (canvas.height / br.height);
});

canvas.addEventListener('pointercancel', () => { mouseIsDown = false; });

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


       
selectRect([[0,15],[19,22], [26,29], [33,36], [40,43], [47,50], [54,57], [61,64], [68,83],  ]);   

// selected/others will be recomputed each frame in update

let selected = [];
let others = [];

  rects.forEach((rect, i) => {
    if (RectChange.has(i)) selected.push({ rect, i });
    else others.push({ rect, i });
  });

function update(dt) {
  canvas.style.background = "black";
  // per-rect growth: each rect begins increasing its `rect.scale` after a random delay
  const now = performance.now() / 1000;


  // draw selected: combine fade-in, revealed, proximity-based alpha and fade-outs
  selected.forEach(({ rect, i }) => {
    // simple age check: advance scale only after the rect's growDelay
   // if (typeof rect._createdAt === 'undefined') rect._createdAt = now;
    const age = now - rect._createdAt;
    if (age >= rect.growDelay) {
      // initial randomized ramp toward the normal max
      // compute proximity factor (1..1+POINTER_GROW_BOOST) based on pointer
      let proximityFactor = 1;
      if (mouseIsDown) {
        const rcx = rect.x + rect.size / 2;
        const rcy = rect.y + rect.size / 2;
        const dxm = rcx - mouseX;
        const dym = rcy - mouseY;
        const dm = Math.hypot(dxm, dym);
        if (dm < POINTER_INFLUENCE_RADIUS) {
          const t = 1 - (dm / POINTER_INFLUENCE_RADIUS); // 0..1
          proximityFactor = 1 + t * POINTER_GROW_BOOST;
        }
      }

      // initial randomized ramp toward the normal max (boosted near pointer)
      if (rect.scale < SCALE_MAX) {
        rect.scale = Math.min(SCALE_MAX, rect.scale + rect.growRate * proximityFactor * dt);
      }
      // while the mouse is held, smoothly grow toward HOLD_SCALE.
      // When released, do NOT shrink back — keep the current size.
      if (mouseIsDown) {
        const a = 1 - Math.exp(-SCALE_SMOOTH * proximityFactor * dt);
        rect.scale += (HOLD_SCALE - rect.scale) * a;
      }

      // when the rect reaches or exceeds its cap, push it outward once
      if (!rect.hasBeenPushed && typeof rect.maxScaleCap !== 'undefined' && rect.scale >= rect.maxScaleCap) {
        rect.hasBeenPushed = true;
        // play a pop sound once when the rect becomes alert-colored
        try { popRectSound.play(); } catch (e) { /* ignore playback errors */ }
        // compute center and target outwards position
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        let dx = rect.x - cx;
        let dy = rect.y - cy;
        // if exactly at center, pick a random direction
        if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) {
          const a = Math.random() * Math.PI * 2;
          dx = Math.cos(a);
          dy = Math.sin(a);
        }
        // compute a random outward distance: normalize direction then pick
        // a multiplier that varies per-rect so targets are at random distances
        const dist = Math.hypot(dx, dy);
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        // random multiplier between PUSH_FACTOR and PUSH_FACTOR + 0.8
        // push random
        const multiplier = PUSH_FACTOR + Math.random() * 0.5;
        const newRadius = dist * multiplier;
        const targetX = cx + nx * newRadius;
        const targetY = cy + ny * newRadius;
        // create springs for x and y to animate movement
        rect.springX = new Spring({ frequency: SPRING_FREQUENCY, halfLife: SPRING_HALF_LIFE, position: rect.x, target: targetX });
        rect.springY = new Spring({ frequency: SPRING_FREQUENCY, halfLife: SPRING_HALF_LIFE, position: rect.y, target: targetY });
      }
    }

    // if springs exist, step them and update rect position so movement is animated
    if (rect.springX && rect.springY) {
      rect.springX.step(dt);
      rect.springY.step(dt);
      rect.x = rect.springX.position;
      rect.y = rect.springY.position;
    }

    rect.drawWhite(rect.scale);
  });

  // If all selected rects have been pushed, schedule a fade and finish (once)
  if (selected.length > 0) {
    const allPushed = selected.every(({ rect }) => rect.hasBeenPushed);
    // once all are alert-colored, retarget them outward so they leave the window
    if (allPushed && !escapeTriggered) {
       // optional celebratory sound when all are alert (play once)
      if (!correctFinishPlayed) {
        try { correctFinishSound.play(); } catch (e) { /* ignore */ }
        correctFinishPlayed = true;
      }
      setTimeout(() => {
      escapeTriggered = true;
     
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const diag = Math.hypot(canvas.width, canvas.height);
      const targetRadius = diag * ESCAPE_DISTANCE_MULT;
      for (const { rect } of selected) {
        let dx = rect.x - cx;
        let dy = rect.y - cy;
        if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) {
          const a = Math.random() * Math.PI * 2;
          dx = Math.cos(a);
          dy = Math.sin(a);
        }
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        const targetX = cx + nx * targetRadius;
        const targetY = cy + ny * targetRadius;
        rect.springX = new Spring({ frequency: SPRING_FREQUENCY -9.5, halfLife: SPRING_HALF_LIFE, position: rect.x, target: targetX });
        rect.springY = new Spring({ frequency: SPRING_FREQUENCY  -9.5, halfLife: SPRING_HALF_LIFE, position: rect.y, target: targetY });
      }
      }, 800);
      // after they start escaping, schedule fade and finish once
      if (!endSequenceScheduled) {
        endSequenceScheduled = true;
        setTimeout(() => {
          //EndSound.play();
          alphaLvl = 0;
        }, 2000);
        setTimeout(() => {
          try { finish(); } catch (e) { console.warn('finish() failed', e); }
        }, 2500);
      }
    }
  }

  // do not draw non-selected rects
  /*others.forEach(({ rect, i }) => {
    rect.drawNot();
  }); */
}

run(update)