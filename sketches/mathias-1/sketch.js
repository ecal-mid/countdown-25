import { createEngine } from "../_shared/engine.js"
import { Spring } from "../_shared/spring.js"
import { VerletPhysics } from "../_shared/verletPhysics.js"
import { DragManager } from "./dragManagerModif.js"

const { renderer, input, math,  audio, run, finish, } = createEngine()
const { ctx, canvas } = renderer

const physics = new VerletPhysics()
physics.gravityY = 3000

const dragManager = new DragManager()

const EndSound = await audio.load({
    src: "assets/End-sound-01.mp3",
    loop: false
})

// ensure the "correct finish" sound plays only once
let correctFinishPlayed = false;
const correctFinishSound = await audio.load({
    src: "assets/correct.mp3",
    loop: false
})

const mouseClickSound = await audio.load({
    src: "assets/click.mp3",
    loop: false
})

// disable click sounds after the sequence ends
let mouseClickDisabled = false;

// physics bounds
physics.bounds = { left: 0, right: canvas.width, top: 0, bottom: canvas.height }

// global mouse state for DragManager
let mouseX = 0;
let mouseY = 0;
let mouseIsDown = false;
// pointer velocity tracking for fling on release
let prevMouseX = 0;
let prevMouseY = 0;
let prevMouseTime = 0;
let pointerVx = 0;
let pointerVy = 0;
// snapping configuration (pixels)
const SNAP_DIST = 30;
// delay (seconds) after creation before an item can be locked/snapped
const SNAP_LOCK_DELAY = 1;
// horizontal flick speed (px/s) applied randomly left/right when bodies are created
const FLICK_SPEED = 220;
// delay (seconds) after creation before an item can be grabbed
const GRAB_LOCK_DELAY = 0.5;
// delay for the very first drop (milliseconds)
const FIRST_DROP_DELAY_MS = 1;
let allPlacedTriggered = false;
// cycleStage: 0 = first-complete -> drop one; 1 = second-complete -> drop all
let cycleStage = 0;
// when true, the stage-2 (5-drop) has already occurred and should not repeat
let stage2DropDone = false;

// final fade/finish state
let globalAlpha = 1;
let endSequenceScheduled = false;



// global fade-out when puzzle completed
let fadeAll = false;
let overallAlpha = 1;
const FADE_ALL_DURATION = 1.2; // seconds

let alphaLvl = 0;
// automatic fade duration (seconds) from 0 -> 1 at start
const AUTO_FADE_DURATION = 2;
// once alpha reaches 1, pick a random subset of selected rects
let selectedSubset = [];
let subsetCreated = false;
// target slots derived from the selected subset; any body can occupy any free slot
let slots = [];
// slot hover highlight radius (px)
const SLOT_HIGHLIGHT_RADIUS = 120;

function pickRandomSubsetFromSelected(count) {
  const out = [];
  const total = selected.length;
  if (total === 0) return out;
  // build array of indices and shuffle
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const take = Math.min(count, indices.length);
  for (let k = 0; k < take; k++) {
    out.push(selected[indices[k]]);
  }
  return out;
}


  class ClassRect {
  constructor(x, y, size, ctx) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.ctx = ctx;
    this.isGrey = false;
  }


  // draw with controllable opacity (0..1)
  drawWhite(alpha = 1, s = 1) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    this.ctx.translate(cx, cy);
    this.ctx.scale(s, s);
    // render slightly grey when flagged
    this.ctx.fillStyle = this.isGrey ? "rgba(126, 126, 126, 1)" : "white";
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
const startX = margin + Math.round((canvas.width - 2 * margin - gridW) / 2) -100;
const startY = margin + Math.round((canvas.height - 2 * margin - gridH) / 2);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const rectX = startX + j * cell;
        const rectY = startY + i * cell;
        rects.push(new ClassRect(rectX, rectY, rectSize, ctx, ));
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
      // play click sound only when this rect is grey (dynamic/dragged) and clicks are enabled
      if (!mouseClickDisabled && r && r.isGrey) {
        try { mouseClickSound.play(); } catch (err) { /* ignore audio errors */ }
      }
      break; // remove if you want multiple hits
    }
  }

  // update global mouse state (used by DragManager)
  mouseX = mx; mouseY = my; mouseIsDown = true;
  // initialize pointer velocity tracking
  prevMouseX = mx; prevMouseY = my; prevMouseTime = performance.now() / 100;
  pointerVx = 0; pointerVy = 0;
}); 

canvas.addEventListener('pointerup', (e) => {
  const br = canvas.getBoundingClientRect();
  const mx = (e.clientX - br.left) * (canvas.width / br.width);
  const my = (e.clientY - br.top) * (canvas.height / br.height);
  // update global mouse state
  mouseX = mx; mouseY = my; mouseIsDown = false;
});

canvas.addEventListener('pointercancel', () => { mouseIsDown = false; });

// always track pointer velocity (used later for fling on release)
canvas.addEventListener('pointermove', (e) => {
  const br = canvas.getBoundingClientRect();
  const mx = (e.clientX - br.left) * (canvas.width / br.width);
  const my = (e.clientY - br.top) * (canvas.height / br.height);
  // compute pointer velocity (px/s)
  const now = performance.now() / 100;
  const dT = Math.max(1e-4, now - prevMouseTime);
  const vx = (mx - prevMouseX) / dT;
  const vy = (my - prevMouseY) / dT;
  // simple smoothing to avoid spikes
  const smooth = 0.6;
  pointerVx = pointerVx * smooth + vx * (1 - smooth);
  pointerVy = pointerVy * smooth + vy * (1 - smooth);
  prevMouseX = mx; prevMouseY = my; prevMouseTime = now;
  // update global mouse position while moving
  mouseX = mx; mouseY = my;
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


selectRect([[5,6], [11,13],[17,20], [23,27], [29,31], [33,34], [35,37], [40,41], [47,48], [54,55], [61,62], [68,69], [75,76], [82,83],  ]);         
  

// selected/others will be recomputed each frame in update

let selected = [];
let notDraw = [];

  rects.forEach((rect, i) => {
    if (RectChange.has(i)) selected.push({ rect, i });
    else notDraw.push({ rect, i });
  });

// scale animation state (animate all rects when subset has filled slots)
let currentScale = 1;
let targetScale = 1;
let scaling = false;
const SCALE_TARGET = 1.5;
const SCALE_SMOOTH = 6; // larger = faster

function update(dt) {
  canvas.style.background = "black";



  // draw selected: combine fade-in, revealed, proximity-based alpha and fade-outs
  // automatic fade from 0 -> 1 at start (advance once per frame)
  if (!subsetCreated) {
    alphaLvl = Math.min(1, alphaLvl + dt / AUTO_FADE_DURATION);
  }
  // Draw selected rects that are NOT part of the physics-driven subset first.
  // The subset (falling) items are drawn later so they appear in front.
  selected.forEach(({ rect }) => {
    let inSubset = false;
    if (subsetCreated) {
      for (const e of selectedSubset) {
        if (e.rect === rect) { inSubset = true; break; }
      }
    }
    // skip grey rects here so they can be drawn last (on top)
    if (!inSubset && !rect.isGrey) rect.drawWhite(alphaLvl * globalAlpha, currentScale);
  });

  // once alpha hits full and we haven't created the subset yet, create it
  if (!subsetCreated && alphaLvl >= 1) {
    const pickCount = 10;
    selectedSubset = pickRandomSubsetFromSelected(pickCount);
    subsetCreated = true;
    console.log('selectedSubset created with', selectedSubset.length, 'items');
    // create physics bodies and drag objects for the subset so they can fall and be dragged
    for (const entry of selectedSubset) {
      const r = entry.rect;
      entry.immobilized = false;
      // create a physics body at the rect center
      const body = physics.createBody({
        positionX: r.x + r.size / 2,
        positionY: r.y + r.size / 2,
        drag: 1.5,
        radius: r.size / 2
      });
      // attach body to the entry so we can sync position later
      entry.body = body;
      // track whether the user is actively dragging this entry
      entry.isBeingDragged = false;
      // keep bodies fixed at creation so they don't all fall simultaneously
      entry.body.isFixed = true;
      // when this entry becomes eligible to be grabbed
      entry.canGrabAt = performance.now() / 1000 + GRAB_LOCK_DELAY;

      // apply a small random horizontal flick so pieces separate as they fall
      // Verlet velocity = position - lastPosition, so set lastPosition to produce vx
      const dtEstimate = 1 / 60;
      const flickVx = (Math.random() * 2 - 1) * FLICK_SPEED; // random between -FLICK_SPEED..FLICK_SPEED
      entry.body.lastPositionX = entry.body.positionX - flickVx * dtEstimate;
      entry.body.lastPositionY = entry.body.positionY;

      
      // create drag object so user can grab the body; keep a reference so we can disable it when snapped
      // supply an isOverlapping function that prevents grabbing until the grab-lock delay
      const dragObj = dragManager.createDragObject({
        target: body,
        isOverlapping: (mx, my) => {
          // not grabbable yet
          if (performance.now() / 1000 < (entry.canGrabAt || 0)) return false;
          const dx = body.positionX - mx;
          const dy = body.positionY - my;
          return Math.hypot(dx, dy) < (body.radius || 30);
        },
        onStartDrag: (t) => {
          // don't allow dragging if we've already immobilized this entry
          if (entry.immobilized) return;
          // freeze physics integration while user drags to avoid jitter
          t.isFixed = true;
          entry.isBeingDragged = true;
          // reset lastPosition so verlet velocity doesn't introduce a big impulse
          t.lastPositionX = t.positionX;
          t.lastPositionY = t.positionY;
        },
        onStopDrag: (t) => {
          entry.isBeingDragged = false;
          // if this entry has been immobilized (snapped into a slot), keep it fixed
          if (entry.immobilized) {
            t.isFixed = true;
            t.lastPositionX = t.positionX;
            t.lastPositionY = t.positionY;
            return;
          }
          // otherwise release body back to physics and give it a fling velocity based on pointer
          t.isFixed = false;
          // estimate a small dt (seconds) to convert pointer velocity (px/s) into lastPosition offset
          const dtEstimate = 1 / 60;
          // set lastPosition so Verlet will compute velocity = position - lastPosition
          t.lastPositionX = t.positionX - pointerVx * dtEstimate;
          t.lastPositionY = t.positionY - pointerVy * dtEstimate;
        }
      });
      entry.dragObj = dragObj;
    }
    // build slots from the original grid positions so any body may snap into any free slot
    const now = performance.now() / 1000;
    slots = selectedSubset.map(e => ({
      x: e.rect.x,
      y: e.rect.y,
      size: e.rect.size,
      occupied: null,
      canSnapAt: now + SNAP_LOCK_DELAY
    }));
  }

  // Update drag manager and physics each frame; do this after subset creation so bodies exist
  dragManager.update(mouseX, mouseY, mouseIsDown);

  physics.update(dt);

  // sync rect positions to physics bodies for the selected subset so they render moving
  if (subsetCreated) {
    for (const entry of selectedSubset) {
      if (entry.body) {
        const b = entry.body;
        const r = entry.rect;
        r.x = b.positionX - r.size / 2;
        r.y = b.positionY - r.size / 2;
        // mark grey only when the body is dynamic (not fixed) and not immobilized
        if (entry.body) {
          r.isGrey = (!entry.immobilized && (!entry.body.isFixed || entry.isBeingDragged));
        }
      }
    }

    // check for snapping to any free slot and immobilize when close enough
    let placedCount = 0;
    const now = performance.now() / 1000;
    for (const entry of selectedSubset) {
      if (!entry.body || entry.immobilized) {
        if (entry.immobilized) placedCount++;
        continue;
      }

      // find nearest free slot within SNAP_DIST that is eligible
      let bestSlot = null;
      let bestDist = Infinity;
      for (const slot of slots) {
        if (slot.occupied) continue;
        if (now < (slot.canSnapAt || 0)) continue;
        const slotCx = slot.x + slot.size / 2;
        const slotCy = slot.y + slot.size / 2;
        const dx = entry.body.positionX - slotCx;
        const dy = entry.body.positionY - slotCy;
        const d = Math.hypot(dx, dy);
        if (d <= SNAP_DIST && d < bestDist) {
          bestDist = d;
          bestSlot = slot;
        }
      }

      if (bestSlot) {
        // snap into chosen slot
        const slotCx = bestSlot.x + bestSlot.size / 2;
        const slotCy = bestSlot.y + bestSlot.size / 2;
        entry.body.positionX = slotCx;
        entry.body.positionY = slotCy;
        entry.body.lastPositionX = entry.body.positionX;
        entry.body.lastPositionY = entry.body.positionY;
        entry.body.isFixed = true;
        entry.immobilized = true;
        bestSlot.occupied = entry;
        // disable drag so it can't be grabbed again
        if (entry.dragObj) entry.dragObj.disabled = true;
        // snap the rect rendering to the slot
        entry.rect.x = bestSlot.x;
        entry.rect.y = bestSlot.y;
        placedCount++;
      }
    }

    // when all are placed: drop a number of rects based on cycleStage (1 -> 3 -> 5)
    // skip if the final stage (5-drop) has already happened once
    if (!allPlacedTriggered && subsetCreated && selectedSubset.length > 0 && !stage2DropDone) {
      const immobilizedCount = selectedSubset.filter(e => e.immobilized).length;
      
      if (immobilizedCount === selectedSubset.length) {
        allPlacedTriggered = true;
        const dtEstimate = 1 / 60;
        const downV = 300; // px/s initial downward velocity

        // determine how many to drop this cycle
        let dropCount = 1;
        if (cycleStage === 0) dropCount = 1;
        else if (cycleStage === 1) dropCount = 3;
        else dropCount = 5;

        // pick from currently immobilized entries only
        const immobilizedEntries = selectedSubset.filter(e => e.immobilized && e.body);
        // clamp dropCount to available immobilized entries
        const take = Math.min(dropCount, immobilizedEntries.length);
        // shuffle indices to sample without replacement
        const indices = Array.from({ length: immobilizedEntries.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
          
        
        const chosen = indices.slice(0, take);

        // performDrop encapsulates the release logic so we can optionally
        // delay only the very first drop using setTimeout.
        function performDrop() {
          for (const idx of chosen) {
            const entry = immobilizedEntries[idx];
            if (!entry || !entry.body) continue;
            entry.immobilized = false;
            entry.body.isFixed = false;
            const flickVx = (Math.random() * 2 - 1) * (FLICK_SPEED * 0.6);
            entry.body.lastPositionX = entry.body.positionX - flickVx * dtEstimate;
            entry.body.lastPositionY = entry.body.positionY - downV * dtEstimate;
            if (entry.dragObj) entry.dragObj.disabled = false;
            // clear its occupied slot if any
            for (const slot of slots) {
              if (slot.occupied === entry) {
                slot.occupied = null;
                slot.canSnapAt = performance.now() / 1000 + SNAP_LOCK_DELAY;
                break;
              }
            }
          }

          // advance cycle stage (max out to keep behavior predictable)
          cycleStage = Math.min(cycleStage + 1, 2);

          // if we just performed the largest drop (5), mark it done so it won't repeat
          if (dropCount >= 5) {
            stage2DropDone = true;
          }

          // allow detection again after a short delay
          setTimeout(() => { allPlacedTriggered = false; }, 200);
        }

        // If this is the very first drop cycle, optionally delay it so the user
        // sees the completed placement briefly before pieces fall.
        if (cycleStage === 0 && typeof FIRST_DROP_DELAY_MS === 'number' && FIRST_DROP_DELAY_MS > 0) {
          setTimeout(performDrop, FIRST_DROP_DELAY_MS);
        } else {
          performDrop();
        }
      }
    }
    
    // If the stage-2 (5-drop) already happened and the user has placed all items back,
    // trigger the final scale-up (rects grow to SCALE_TARGET).
    if (stage2DropDone && !allPlacedTriggered && subsetCreated && selectedSubset.length > 0) {
      const immobilizedCount2 = selectedSubset.filter(e => e.immobilized).length;
      if (immobilizedCount2 === selectedSubset.length) {
        // play completion sound once when the final re-placement is detected
        if (!correctFinishPlayed) {
          try { correctFinishSound.play(); } catch (e) { /* ignore playback errors */ }
          correctFinishPlayed = true;
        }

        allPlacedTriggered = true;
        targetScale = SCALE_TARGET;
        scaling = true;
        console.log('Stage-2 re-placement detected -> scaling to', SCALE_TARGET);
        // allow detection again after a short delay
        setTimeout(() => { allPlacedTriggered = false; }, 200);
      }
    }
  }

  // draw non-selected rects, respect fade-outs
  // skip grey rects so they can be drawn on top later
  notDraw.forEach(({ rect, i }) => {
    if (!rect.isGrey) rect.drawBlack();
  });

  // draw slot highlights (if slots exist) based on mouse proximity
  if (slots && slots.length > 0) {
    for (const slot of slots) {
      const cx = slot.x + slot.size / 2;
      const cy = slot.y + slot.size / 2;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const d = Math.hypot(dx, dy);
      // proximity t in [0..1] where 1 is at center, 0 at or beyond radius
      // If the end sequence has been scheduled, force slot visuals to black
      let grey = 0;
      if (!endSequenceScheduled) {
        const t = Math.max(0, 1 - d / SLOT_HIGHLIGHT_RADIUS);
        grey = Math.round(t * 180); // 0..180 grey range
      }
      ctx.save();
      ctx.globalAlpha = 1; // slot highlight opacity (can be adjusted)
      ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
      ctx.fillRect(slot.x, slot.y, slot.size, slot.size);
      ctx.restore();
    }
  }

  // draw the physics-driven subset (except grey ones which will be drawn on top)
  if (subsetCreated) {
    for (const entry of selectedSubset) {
      if (entry && entry.rect && !entry.rect.isGrey) {
        entry.rect.drawWhite(alphaLvl * globalAlpha, currentScale);
      }
    }
  }

  // draw any grey rects last so they appear above everything else
  for (const r of rects) {
    if (r && r.isGrey) {
      r.drawWhite(alphaLvl * globalAlpha, currentScale);
    }
  }


  // advance global scale toward target when scaling is active
  if (scaling) {
    const a = 1 - Math.exp(-SCALE_SMOOTH * dt);
    currentScale += (targetScale - currentScale) * a;
    if (Math.abs(currentScale - targetScale) < 0.001) {
      currentScale = targetScale;
      scaling = false;
    }
  }

  // When we reach the target scale (and target is the final scale), schedule fade then finish.
  // Only schedule once.
  if (!endSequenceScheduled && targetScale === SCALE_TARGET && currentScale >= targetScale) {
    endSequenceScheduled = true;
    setTimeout(() => {
      EndSound.play()
      globalAlpha = 0;
    }, 1500);
    // disable click sounds once the end sound / fade is scheduled
    setTimeout(() => { mouseClickDisabled = true; }, 1500);
    setTimeout(() => {
      try { finish(); } catch (e) { console.warn('finish() failed', e); }
    }, 2000);
  }
}

run(update)