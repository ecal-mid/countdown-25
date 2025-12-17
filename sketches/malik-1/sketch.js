import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, math, audio, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Load audio files
let machineSound = null;
let machineSoundInstance = null;
let pickupSound = null;
machineSound = await audio.load({
  src: "/sketches/malik-1/machine.wav",
  loop: true,
});
machineSoundInstance = machineSound.play({
  volume: 0.0,
});

audio.load("/sketches/malik-1/pickup.wav").then((sound) => {
  pickupSound = sound;
});

run(update);

let slideInDuration = 2.0; // Duration of slide-in animations in seconds
let introProgress = 0;
let introComplete = false;

const State = {
  WaitingForInput: "waitingForInput",
  Intro: "intro",
  Drawing: "drawing",
  Done: "done",
  Outro: "outro",
  Finished: "finished",
};

const shoulderSVG = new Image();
shoulderSVG.src = "/sketches/malik-1/shoulder.svg";
const shoulder = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  targetX: 0,
  targetY: 0,
  isAnimating: false,
};
shoulderSVG.onload = () => {
  shoulder.loaded = true;
  shoulder.svg = shoulderSVG;
  shoulder.ratio = shoulderSVG.naturalHeight / shoulderSVG.naturalWidth;
  shoulder.height = canvas.height;
  shoulder.width = shoulder.height / shoulder.ratio;
  shoulder.targetX = canvas.width / 2 - shoulder.width / 2;
  shoulder.targetY = canvas.height / 2 - shoulder.height / 2;
  // Start off-screen to the left
  shoulder.x = -shoulder.width;
  shoulder.y = shoulder.targetY;
  checkIfReady();
};

const oneSVG = new Image();
oneSVG.src = "/sketches/malik-1/1-mask.svg";
const one = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  targetX: 0,
  targetY: 0,
  isAnimating: false,
};
oneSVG.onload = () => {
  one.loaded = true;
  one.svg = oneSVG;
  one.ratio = oneSVG.naturalHeight / oneSVG.naturalWidth;
  checkIfReady();
};

function checkIfReady() {
  if (shoulder.loaded && one.loaded && gun.loaded) {
    // Set one dimensions now that shoulder is loaded
    one.height = shoulder.height * 0.3;
    one.width = one.height / one.ratio;
    one.targetX = canvas.width / 2 - one.width / 2;
    one.targetY = canvas.height / 2 - one.height / 2;
    one.x = one.targetX;
    one.y = one.targetY;

    // Create the mask function
    createIsPointInOneFunction();
  }
}

function createIsPointInOneFunction() {
  // Validate that all required properties are set
  if (!one.svg || one.width <= 0 || one.height <= 0) {
    console.error("Cannot create mask: one object not properly initialized");
    return;
  }

  const oneCanvas = document.createElement("canvas");
  oneCanvas.width = canvas.width;
  oneCanvas.height = canvas.height;
  const oneCtx = oneCanvas.getContext("2d");

  if (!oneCtx) {
    console.error("Cannot get 2D context for mask");
    return;
  }

  oneCtx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the one mask
  oneCtx.drawImage(one.svg, one.x, one.y, one.width, one.height);
  const imageData = oneCtx.getImageData(0, 0, canvas.width, canvas.height);

  mask.data = imageData;
  mask.covered = new Uint8Array((imageData.data.length / 4) | 0);
  mask.totalPixels = 0;
  mask.coveredCount = 0;

  // Count mask pixels once so we don't recompute every frame
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 128) mask.totalPixels++;
  }

  // Check if point is inside the "1" shape
  window.isPointInOne = (x, y) => {
    if (!mask.ready) return false;
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return false;
    const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    return mask.data.data[index + 3] > 128;
  };

  mask.ready = true;
}

const gunSVG = new Image();
gunSVG.src = "/sketches/malik-1/tattoo-gun.svg";
const gun = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  targetX: 0,
  targetY: 0,
  finalX: 0, // Store final position (off-screen)
  finalY: 0,
  isAnimating: false,
  isPickedUp: false,
  isHovered: false,
  offsetX: 0,
  offsetY: 0,
  needlePosition: { x: 0, y: 0 },
  scale: 0.25, // Initial smaller size
};
gunSVG.onload = () => {
  gun.loaded = true;
  gun.svg = gunSVG;
  gun.ratio = gunSVG.naturalHeight / gunSVG.naturalWidth;
  gun.height = canvas.height * gun.scale;
  gun.width = gun.height / gun.ratio;
  gun.targetX = canvas.width * 0.85 - gun.width / 2;
  gun.targetY = canvas.height * 0.33 - gun.height / 2;
  gun.finalX = canvas.width + canvas.width * 0.5; // Final position off-screen to the right
  gun.finalY = gun.targetY;
  // Start off-screen at the bottom
  gun.x = gun.targetX;
  gun.y = canvas.height + gun.height;
  gun.needlePosition = {
    x: gun.x,
    y: gun.y + gun.height,
  };
  checkIfReady();
};

const points = [];
const tempPoints = [];
const mask = {
  data: null,
  covered: null,
  totalPixels: 0,
  coveredCount: 0,
  ready: false,
};

const point = {
  x: 0,
  y: 0,
  size: 8,
  lifeTime: 0.5, // seconds
};

let currentState = State.WaitingForInput;
let lastPointTime = 0;
const pointInterval = 0.01; // Add a point every 0.05 seconds while dragging
const COVERAGE_THRESHOLD = 95; // Percentage needed to complete drawing
let drawingDone = false;
let waitBeforOutro = 2.0; // Wait time in seconds before transitioning to outro
let outroWaitProgress = 0;
let outroStarted = false;
let slideOutDuration = 2.0; // Duration of slide-out animation
let outroProgress = 0;
let outroComplete = false;
let coveragePercentage = 0;
let fadeOutProgress = 0;
let fadeOutDuration = 0.5;
let isFadingOut = false;

function update(dt) {
  // console.log(currentState);

  lastPointTime += dt;

  drawObject(shoulder);

  //drawObject(one);
  drawPoints();
  drawObject(gun);
  //DEBUGDrawGunRectangle();

  let nextState = undefined;

  switch (currentState) {
    case State.WaitingForInput:
      if (input.hasStarted()) {
        nextState = State.Intro;
      }
      nextState = State.Intro; // AUTO-START FOR TESTING
      break;
    case State.Intro:
      if (introComplete) {
        nextState = State.Drawing;
      }
      break;
    case State.Drawing:
      if (drawingDone) {
        nextState = State.Done;
      }
      break;
    case State.Done:
      if (outroStarted) {
        nextState = State.Outro;
      }
      break;
    case State.Outro:
      if (outroComplete) {
        nextState = State.Finished;
      }
      break;
    case State.Finished:
      break;
  }

  if (nextState !== undefined) {
    currentState = nextState;
  }

  switch (currentState) {
    case State.WaitingForInput:
      break;
    case State.Intro:
      // Update intro animation
      if (!introComplete) {
        introProgress += dt / slideInDuration;
        if (introProgress >= 1) {
          introProgress = 1;
          introComplete = true;
        }

        // Easing function for smooth intro (smoothstep)
        const ease = introProgress * introProgress * (3 - 2 * introProgress);

        // Animate shoulder sliding in from left
        const shoulderStartX = -shoulder.width;
        shoulder.x =
          shoulderStartX + (shoulder.targetX - shoulderStartX) * ease;

        // Animate gun sliding in from bottom
        const gunStartY = canvas.height + gun.height;
        gun.x = gun.targetX; // Keep x at target position during slide-in
        gun.y = gunStartY + (gun.targetY - gunStartY) * ease;
      }
      break;
    case State.Drawing:
      handleGunPickup();

      if (gun.isPickedUp) {
        updateGun();

        // Only add points when clicking/holding after pickup
        if (input.isPressed() && lastPointTime >= pointInterval) {
          addPointAtNeedle();
          lastPointTime = 0;
        }
      }

      // Update temporary points (fade them out)
      updateTempPoints(dt);

      // Check if coverage threshold is reached
      if (coveragePercentage >= COVERAGE_THRESHOLD) {
        drawingDone = true;
        isFadingOut = true;
        fadeOutProgress = 0;
      }
      break;
    case State.Done:
      // Smoothly move gun to final position (off-screen)
      gun.x = math.lerp(gun.x, gun.finalX, 0.05);
      gun.y = math.lerp(gun.y, gun.finalY, 0.05);

      // Update needle position
      gun.needlePosition.x = gun.x + gun.width / 2;
      gun.needlePosition.y = gun.y + gun.height;

      // Check if gun has reached final position
      const gunReturnDistance = math.dist(gun.x, gun.y, gun.finalX, gun.finalY);

      if (gunReturnDistance < 5) {
        // Gun is off-screen, start waiting
        if (!outroStarted) {
          outroWaitProgress += dt / waitBeforOutro;

          if (outroWaitProgress >= 1) {
            outroWaitProgress = 1;
            outroStarted = true;
          }
        }
      }
      break;
    case State.Outro:
      // Update outro animation
      if (!outroComplete) {
        outroProgress += dt / slideOutDuration;
        if (outroProgress >= 1) {
          outroProgress = 1;
          outroComplete = true;
        }

        // Easing function for smooth outro (smoothstep)
        const ease = outroProgress * outroProgress * (3 - 2 * outroProgress);

        // Slide shoulder out to the right
        const shoulderTargetX = canvas.width + shoulder.width;
        shoulder.x =
          shoulder.targetX + (shoulderTargetX - shoulder.targetX) * ease;

        // Slide gun out to the right
        const gunTargetX = canvas.width + gun.width;
        gun.x = gun.finalX + (gunTargetX - gun.finalX) * ease;
      }
      break;
    case State.Finished:
      console.log("FINISHED");
      finish();
      break;
  }

  // Update fade-out progress
  if (isFadingOut && fadeOutProgress < 1) {
    fadeOutProgress += dt / fadeOutDuration;
    if (fadeOutProgress > 1) fadeOutProgress = 1;
  }

  let vol = 0;
  if (!drawingDone && gun.isPickedUp) {
    if (input.isPressed()) {
      vol = 1.0;
    } else {
      vol = 0.3;
    }
  } else if (isFadingOut) {
    // Fade out over 0.5 seconds
    const currentVol = input.isPressed() ? 1.0 : 0.3;
    vol = currentVol * (1 - fadeOutProgress);
  }
  machineSoundInstance.setVolume(vol);
}

function handleGunPickup() {
  const mouseX = input.getX();
  const mouseY = input.getY();

  // Check if mouse is hovering over the gun
  gun.isHovered =
    mouseX >= gun.x &&
    mouseX <= gun.x + gun.width &&
    mouseY >= gun.y &&
    mouseY <= gun.y + gun.height;

  // Handle pickup - click on gun to pick it up
  if (
    input.isPressed() &&
    !gun.isPickedUp &&
    gun.isHovered &&
    currentState === State.Drawing
  ) {
    gun.isPickedUp = true;
    gun.scale = 0.3; // Increase size when picked up

    // Recalculate dimensions with new scale
    gun.height = canvas.height * gun.scale;
    gun.width = gun.height / gun.ratio;

    // Store offset from mouse to gun position
    gun.offsetX = gun.width / 4;
    gun.offsetY = (3 * gun.height) / 4;

    // Play pickup sound and start machine sound
    if (pickupSound) {
      pickupSound.play({
        volume: Math.random() * 0.1 + 0.9,
      });
    }
  }
}

function updateGun() {
  if (!gun.isPickedUp) return;

  const mouseX = input.getX();
  const mouseY = input.getY();

  // Update target position based on mouse position (accounting for offset)
  gun.targetX = mouseX - gun.offsetX;
  gun.targetY = mouseY - gun.offsetY;

  // Smoothly lerp gun position towards target
  gun.x = math.lerp(gun.x, gun.targetX, 0.2);
  gun.y = math.lerp(gun.y, gun.targetY, 0.2);

  // Update needle position to follow gun
  gun.needlePosition.x = gun.x + gun.width / 2;
  gun.needlePosition.y = gun.y + gun.height;
}

function addPointAtNeedle() {
  const needleX = gun.x;
  const needleY = gun.y + gun.height;

  // Check if the needle point is inside the "one" mask
  if (window.isPointInOne && window.isPointInOne(needleX, needleY)) {
    // Add to permanent points array
    points.push({
      x: needleX,
      y: needleY,
      size: point.size,
    });
    coveragePercentage = updateCoverageForPoint(needleX, needleY, point.size);
  } else {
    // Add to temporary points array with lifetime
    tempPoints.push({
      x: needleX,
      y: needleY,
      size: point.size,
      lifetime: 0,
      maxLifetime: point.lifeTime, // Disappear after 3 seconds
    });
  }
}

function updateCoverageForPoint(cx, cy, radius) {
  if (!mask.ready || mask.totalPixels === 0) return coveragePercentage;

  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(canvas.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(canvas.height - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y++) {
    const dy = y + 0.5 - cy;
    const dy2 = dy * dy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dist2 = dx * dx + dy2;
      if (dist2 > r2) continue;

      const idx = y * canvas.width + x;
      if (mask.covered[idx]) continue;
      if (mask.data.data[idx * 4 + 3] <= 128) continue;

      mask.covered[idx] = 1;
      mask.coveredCount++;
    }
  }

  if (mask.totalPixels === 0) return 0;
  return (mask.coveredCount / mask.totalPixels) * 100;
}

function updateTempPoints(dt) {
  // Update lifetime of temporary points and remove expired ones
  for (let i = tempPoints.length - 1; i >= 0; i--) {
    tempPoints[i].lifetime += dt;
    if (tempPoints[i].lifetime >= tempPoints[i].maxLifetime) {
      tempPoints.splice(i, 1);
    }
  }
}

function drawPoints() {
  ctx.save();

  // Calculate shoulder offset for outro animation
  const shoulderOffsetX = shoulder.x - shoulder.targetX;

  // Draw permanent points
  ctx.fillStyle = "black";
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x + shoulderOffsetX, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw temporary points with fading opacity
  tempPoints.forEach((p) => {
    const fade = 1 - p.lifetime / p.maxLifetime;
    ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
    ctx.beginPath();
    ctx.arc(p.x + shoulderOffsetX, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawObject(obj) {
  if (!obj.loaded) return;
  ctx.save();
  ctx.drawImage(obj.svg, obj.x, obj.y, obj.width, obj.height);
  ctx.restore();
}

function DEBUGDrawGunRectangle() {
  ctx.save();
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.strokeRect(gun.x, gun.y, gun.width, gun.height);
  ctx.restore();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "f") {
    finish();
  }
});
