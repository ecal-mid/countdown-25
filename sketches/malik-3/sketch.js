import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";

const { renderer, input, math, audio, run, finish } = createEngine();
const { ctx, canvas } = renderer;

/* ------------- SETUP ------------- */
const State = {
  WaitingForInput: "waitingForInput",
  Intro: "intro",
  Shaving: "shaving",
  Done: "done",
  Finished: "finished",
};
let currentState = State.WaitingForInput;
// Hair parameters
const hairNumber = 4000;
const maxAttempts = 20000;
const maxHairLength = 80;
const minHairLength = 50;
const minHairSpacing = 8; // Minimum distance between hair roots
const hairPaths = [];
const cutHairRoots = []; // Store positions of cut hair roots permanently

// rectangle parameters
const rect = {
  w: 110,
  h: 15,
  //isHovered: false,
  //isDragging: false,
  offsetX: 0,
  offsetY: 0,
};

// Razor position
const razor = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  finalX: 0, // Final position off-screen
  finalY: 0,
  width: 0,
  height: 0,
  ratio: 0,
  isHovered: false,
  isDragging: false,
  showRazorRectDebug: false, //DEBUG
};

// Load pickup sound (two instances to allow overlapping)
let pickupSound1 = await audio.load("/sketches/malik-3/pickup.wav");
let pickupSound2 = await audio.load("/sketches/malik-3/pickup.wav");
let pickupSoundToggle = false;

// Load shave sound
let shaveSound = await audio.load("/sketches/malik-3/shave.wav");
let lastShaveSoundTime = 0;
const shaveSoundCooldown = 0.1; // Minimum time between sound plays

// Intro animation
let introProgress = 0;
const introDuration = 2.0;
let introComplete = false;

// Outro animation
let outroWaitProgress = 0;
const outroWaitDuration = 2.0; // Wait time before sliding out
let outroProgress = 0;
const outroDuration = 2.0;
let outroStarted = false;

// Hair counter
let hairsInMaskCount = 0;
let shavedHairsInMaskCount = 0;
const hairThresholdPercentage = 0.95;

// load threeSVG as image
let threeMaskScale = 0.5;
let threeMaskAspect;
let threeMaskXFrac = 0.5;
let threeMaskYFrac = 0.5;
let threeMaskRect = { x: 0, y: 0, w: 0, h: 0 };

const threeMaskSVG = new Image();
threeMaskSVG.src = "/sketches/malik-3/3-mask.svg";
let maskLoaded = false;
let showMaskDebug = false; //DEBUG

threeMaskSVG.onload = () => {
  maskLoaded = true;
  checkIfReady();
};

// load razorSVG as image
const razorSVG = new Image();
razorSVG.src = "/sketches/malik-3/razor.svg";
let razorLoaded = false;

razorSVG.onload = () => {
  razorLoaded = true;
  razor.ratio = razorSVG.naturalHeight / razorSVG.naturalWidth;
  razor.height = canvas.height * 0.18;
  razor.width = razor.height / razor.ratio;
  checkIfReady();
};

// load legSVG as image
const legSVG = new Image();
legSVG.src = "/sketches/malik-3/Leg-corner.svg";
let svgLoaded = false;

const leg = {
  svg: null,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  ratio: 0,
};

legSVG.onload = () => {
  svgLoaded = true;
  leg.svg = legSVG;
  leg.ratio = legSVG.naturalHeight / legSVG.naturalWidth;
  leg.height = canvas.height;
  leg.width = leg.height / leg.ratio;
  leg.x = canvas.width / 2 - leg.width / 2;
  leg.y = canvas.height / 2 - leg.height / 2;

  threeMaskAspect = threeMaskSVG.naturalWidth / threeMaskSVG.naturalHeight;
  updateThreeMaskLayout();
  checkIfReady();
};

function checkIfReady() {
  if (svgLoaded && maskLoaded && razorLoaded) {
    createisPointInLegFunction();
    createIsPointInThreeFunction();
    initRazor();
    generateRandomHair(hairNumber);
    console.log("Hairs generated:", hairPaths.length);
    console.log("Hairs inside mask:", hairsInMaskCount);
    run(update);
  }
}

// Rebuild when canvas size or scale changes
function updateThreeMaskLayout() {
  // Calculate height relative to canvas (same scaling approach as leg)
  const h = canvas.height * threeMaskScale;
  const w = h * threeMaskAspect;
  const x = canvas.width * threeMaskXFrac - w * 0.5;
  const y = canvas.height * threeMaskYFrac - h * 0.5;
  threeMaskRect.x = x;
  threeMaskRect.y = y;
  threeMaskRect.w = w;
  threeMaskRect.h = h;
  // Recreate point test after layout change
  if (maskLoaded) createIsPointInThreeFunction();
}

function createIsPointInThreeFunction() {
  const threeCanvas = document.createElement("canvas");
  threeCanvas.width = canvas.width;
  threeCanvas.height = canvas.height;
  const threeCtx = threeCanvas.getContext("2d");
  threeCtx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw scaled mask
  threeCtx.drawImage(
    threeMaskSVG,
    threeMaskRect.x,
    threeMaskRect.y,
    threeMaskRect.w,
    threeMaskRect.h
  );
  const imageData = threeCtx.getImageData(0, 0, canvas.width, canvas.height);

  // Check if point is inside the "3" shape
  window.isPointInThree = (x, y) => {
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return false;
    const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    return imageData.data[index + 3] > 128;
  };
}
window.addEventListener("resize", () => {
  // If your engine resizes canvas elsewhere, ensure canvas dimensions are updated first.
  updateThreeMaskLayout();
  initRazor();
});

function createisPointInLegFunction() {
  // Create a temporary canvas to get the filled shape
  const legCanvas = document.createElement("canvas");
  legCanvas.width = canvas.width;
  legCanvas.height = canvas.height;
  const legCtx = legCanvas.getContext("2d");

  // Draw the SVG image to extract the shape
  legCtx.drawImage(leg.svg, leg.x, leg.y, leg.width, leg.height);

  // Store the image data for pixel-based collision detection
  const imageData = legCtx.getImageData(0, 0, canvas.width, canvas.height);

  // Helper function to check if a pixel is part of the leg (non-transparent)
  window.isPointInLeg = (x, y) => {
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return false;
    const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    return imageData.data[index + 3] > 128; // Check alpha channel
  };
}

function generateRandomHair(numOfHair) {
  hairPaths.length = 0;

  // Create a grid to track occupied positions for better distribution
  const cellSize = minHairSpacing;
  const gridCols = Math.ceil(canvas.width / cellSize);
  const gridRows = Math.ceil(canvas.height / cellSize);
  const grid = new Map();

  const getGridKey = (x, y) => {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    return `${col},${row}`;
  };

  let created = 0;
  for (let i = 0; i < maxAttempts; i++) {
    if (created >= numOfHair) break;
    const randomHairLength =
      Math.random() * (maxHairLength - minHairLength) + minHairLength;

    // Randomly choose up or down direction
    const baseAngle = Math.random() * Math.PI * 0.33 + Math.PI * 0.33;
    const pointUp = Math.random() < 0.5;
    const angle = pointUp ? -baseAngle : baseAngle;

    const x1 = Math.random() * canvas.width;
    const y1 = Math.random() * canvas.height;

    if (window.isPointInLeg && window.isPointInLeg(x1, y1)) {
      const x2 = x1 + randomHairLength * Math.cos(angle);
      const y2 = y1 + randomHairLength * Math.sin(angle);

      // Add curve control point for natural hair bend
      const curvature = (Math.random() - 0.5) * randomHairLength * 0.5;
      const perpAngle = angle + Math.PI / 2;
      const cx = (x1 + x2) / 2 + curvature * Math.cos(perpAngle);
      const cy = (y1 + y2) / 2 + curvature * Math.sin(perpAngle);

      // Check if hair is inside the three mask
      const isInMask =
        window.isPointInThree &&
        (window.isPointInThree(x1, y1) || window.isPointInThree(x2, y2));

      const hairPath = { x1, y1, x2, y2, cx, cy, isInMask };
      hairPaths.push(hairPath);

      if (isInMask) {
        hairsInMaskCount++;
      }

      // Add to grid
      const key = getGridKey(x1, y1);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ x: x1, y: y1 });

      created++;
    }
  }
}

function initRazor() {
  razor.targetX = canvas.width * 0.85;
  razor.targetY = canvas.height * 0.5;
  razor.finalX = canvas.width + canvas.width * 0.5; // Final position off-screen to the right
  razor.finalY = razor.targetY;
  // Start razor off-screen at the bottom
  razor.x = razor.targetX;
  razor.y = canvas.height + razor.height;

  // Start intro animation
  introProgress = 0;
  introComplete = false;
}

function update(dt) {
  console.log("Current State:", currentState);
  let nextState = undefined;
  switch (currentState) {
    case State.WaitingForInput:
      if (input.hasStarted()) {
        nextState = State.Intro;
      }
      break;
    case State.Intro:
      // Update intro animation
      introProgress += dt / introDuration;
      if (introProgress >= 1) {
        introProgress = 1;
        introComplete = true;
        nextState = State.Shaving;
      }
      break;
    case State.Shaving:
      if (
        shavedHairsInMaskCount / hairsInMaskCount >=
        hairThresholdPercentage
      ) {
        nextState = State.Done;
        // Make all remaining hairs in mask fall when transitioning to Done
        hairPaths.forEach((e) => {
          if (e.isInMask && !e.isCut) {
            e.isCut = true;
            e.cutProgress = 0;
            e.fallVelocity = 0;
          }
        });
      }
      break;
    case State.Done:
      // Check if razor has reached final position (off-screen)
      const razorReturnDistance = math.dist(
        razor.x,
        razor.y,
        razor.finalX,
        razor.finalY
      );

      if (razorReturnDistance < 5) {
        // Razor is off-screen, start waiting
        if (!outroStarted) {
          outroWaitProgress += dt / outroWaitDuration;

          if (outroWaitProgress >= 1) {
            outroWaitProgress = 1;
            outroStarted = true;
          }
        }

        // After wait, start outro animation
        if (outroStarted) {
          outroProgress += dt / outroDuration;

          if (outroProgress >= 1) {
            outroProgress = 1;
            nextState = State.Finished;
          }
        }
      }
      break;
    case State.Finished:
      break;
  }

  if (nextState !== undefined) {
    currentState = nextState;
  }

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate easing and offsets based on current state
  let legOffsetX = 0;
  let razorOffsetX = 0;
  let ease = 1;

  if (currentState === State.WaitingForInput || currentState === State.Intro) {
    // Easing function for smooth intro
    ease = introProgress * introProgress * (3 - 2 * introProgress);
    legOffsetX = (1 - ease) * -canvas.width * 1;
  } else if (currentState === State.Done && outroStarted) {
    // Easing function for smooth outro
    const outroEase = outroProgress * outroProgress * (3 - 2 * outroProgress);
    legOffsetX = outroEase * canvas.width * 1.5;
    razorOffsetX = outroEase * canvas.width * 1.5;
  } else if (currentState === State.Finished) {
    // Keep elements off-screen after outro
    legOffsetX = canvas.width * 1.5;
    razorOffsetX = canvas.width * 1.5;
  }

  // Draw leg with intro offset
  ctx.save();
  ctx.translate(legOffsetX, 0);
  ctx.drawImage(leg.svg, leg.x, leg.y, leg.width, leg.height);
  ctx.restore();

  switch (currentState) {
    case State.Finished:
      console.log("FINISHED");
      finish();
      break;
    case State.WaitingForInput:
      break;
    case State.Intro:
      break;
    case State.Shaving:
      break;
    case State.Done:
      break;
  }

  drawThreeMaskDebug(); //DEBUG

  // Check if mouse is hovering over razor (bounds check)
  const mouseX = input.getX();
  const mouseY = input.getY();
  razor.isHovered =
    mouseX >= razor.x - razor.width / 2 &&
    mouseX <= razor.x + razor.width / 2 &&
    mouseY >= razor.y &&
    mouseY <= razor.y + razor.height;

  // Handle dragging (only during Shaving state)
  if (currentState === State.Shaving && input.isPressed()) {
    if (!razor.isDragging && razor.isHovered) {
      razor.isDragging = true;
      razor.offsetX = razor.x - mouseX;
      razor.offsetY = razor.y - mouseY;
      // Play pickup sound (alternate between instances)
      pickupSoundToggle = !pickupSoundToggle;
      const pickupSound = pickupSoundToggle ? pickupSound1 : pickupSound2;
      if (pickupSound) {
        console.log("PLAY SOUND");
        pickupSound.play({
          volume: Math.random() * (1.0 - 0.9) + 0.7,
        });
      }
    }
    if (razor.isDragging) {
      // Smooth lerp towards mouse position while dragging
      const dragEase = 0.25; // Higher value = more responsive dragging
      const targetX = mouseX + razor.offsetX;
      const targetY = mouseY + razor.offsetY;
      razor.x += (targetX - razor.x) * dragEase;
      razor.y += (targetY - razor.y) * dragEase;
    }
  } else {
    if (razor.isDragging) {
      razor.isDragging = false;
      pickupSoundToggle = !pickupSoundToggle;
      const pickupSound = pickupSoundToggle ? pickupSound1 : pickupSound2;
      if (pickupSound) {
        console.log("PLAY SOUND");
        pickupSound.play({
          volume: Math.random() * 0.1 + 0.6,
          rate: 1 + Math.random() * 1,
        });
      }
    }
  }

  // Animate back to target when not dragging using smooth lerp
  if (!razor.isDragging) {
    if (currentState === State.Done) {
      // Move to final position (off-screen) when in Done state
      if (!outroStarted) {
        const returnEase = 0.03;
        razor.x += (razor.finalX - razor.x) * returnEase;
        razor.y += (razor.finalY - razor.y) * returnEase;
      }
    } else if (currentState === State.Intro) {
      // During intro, animate from bottom
      const razorStartY = canvas.height * 1.2;
      razor.x = razor.targetX;
      razor.y = razorStartY + (razor.targetY - razorStartY) * ease;
    }
    // During Shaving state: razor stays where it was released (no return animation)
  }

  // Rectangle follows razor position
  const rectX = razor.x;
  const rectY = razor.y + rect.h / 2 + 10;

  ctx.lineWidth = 5;
  ctx.strokeStyle = "black";

  // Cut hair when rectangle hovers over them (only during Shaving state)
  if (currentState === State.Shaving) {
    hairPaths.forEach((e) => {
      if (
        window.isPointInThree &&
        (window.isPointInThree(e.x1, e.y1) || window.isPointInThree(e.x2, e.y2))
      ) {
        // Check if hair root or tip is inside rectangle bounds
        const isRootInRect =
          e.x1 >= rectX - rect.w / 2 &&
          e.x1 <= rectX + rect.w / 2 &&
          e.y1 >= rectY - rect.h / 2 &&
          e.y1 <= rectY + rect.h / 2;

        const isTipInRect =
          e.x2 >= rectX - rect.w / 2 &&
          e.x2 <= rectX + rect.w / 2 &&
          e.y2 >= rectY - rect.h / 2 &&
          e.y2 <= rectY + rect.h / 2;

        if ((isRootInRect || isTipInRect) && !e.isCut) {
          e.isCut = true;
          e.cutProgress = 0;
          e.fallVelocity = 0;

          // Store the hair root position permanently
          cutHairRoots.push({ x: e.x1, y: e.y1 });

          // Decrease counter if hair was in mask
          if (e.isInMask) {
            shavedHairsInMaskCount++;
          }

          // Play shave sound only if not already playing
          if (shaveSound && !shaveSound.isPlaying()) {
            const soundInstance = shaveSound.play({
              volume: Math.random() * 0.1 + 0.7,
              rate: 0.9 + Math.random() * 0.15,
            });
            // Schedule fade out before sound ends (last 0.3 seconds)
            if (soundInstance && shaveSound.buffer) {
              const fadeOutDuration = 0.3;
              const fadeOutStartTime =
                shaveSound.buffer.duration - fadeOutDuration;
              setTimeout(() => {
                if (soundInstance && soundInstance.setVolume) {
                  // Exponential fade from 1.0 to 0.01 over fadeOutDuration
                  const steps = 30;
                  const stepTime = (fadeOutDuration * 1000) / steps;
                  let currentStep = 0;
                  const fadeInterval = setInterval(() => {
                    currentStep++;
                    const progress = currentStep / steps;
                    const volume = Math.max(
                      0.01,
                      1.0 * Math.pow(0.01, progress)
                    );
                    soundInstance.setVolume(volume);
                    if (currentStep >= steps) {
                      clearInterval(fadeInterval);
                    }
                  }, stepTime);
                }
              }, fadeOutStartTime * 1000);
            }
          }
        }
      }
    });
  }

  // Update falling hair
  hairPaths.forEach((e) => {
    if (e.isCut && e.cutProgress !== undefined) {
      e.fallVelocity += 0.5; // Gravity acceleration
      e.cutProgress += e.fallVelocity;
    }
  });

  // Remove hair that has fallen off screen
  for (let i = hairPaths.length - 1; i >= 0; i--) {
    const e = hairPaths[i];
    if (e.isCut && e.cutProgress > canvas.height + 100) {
      hairPaths.splice(i, 1);
    }
  }

  // Draw permanent cut hair roots first
  ctx.fillStyle = "black";
  cutHairRoots.forEach((root) => {
    ctx.beginPath();
    ctx.arc(root.x + legOffsetX, root.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  });

  hairPaths.forEach((e) => {
    // Apply leg offset to hair positions during intro
    const hairX1 = e.x1 + legOffsetX;
    const hairX2 = e.x2 + legOffsetX;
    const hairCx = e.cx + legOffsetX;

    // Only draw root point for uncut hair (cut roots are in cutHairRoots array)
    if (!e.isCut) {
      ctx.beginPath();
      ctx.arc(hairX1, e.y1, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "black";
      ctx.fill();
    }
    if (!e.isCut) {
      ctx.beginPath();
      ctx.moveTo(hairX1, e.y1);
      ctx.quadraticCurveTo(hairCx, e.cy, hairX2, e.y2);
      ctx.stroke();
    } else if (e.cutProgress !== undefined) {
      // Draw falling hair
      ctx.beginPath();
      ctx.moveTo(hairX1, e.y1 + e.cutProgress);
      ctx.quadraticCurveTo(
        hairCx,
        e.cy + e.cutProgress,
        hairX2,
        e.y2 + e.cutProgress
      );
      ctx.stroke();
    }
  });

  drawRazorRectangleDebug(rectX, rectY); //DEBUG

  // Draw razor SVG at its position with outro offset
  if (razorLoaded) {
    ctx.save();
    ctx.drawImage(
      razorSVG,
      razor.x - razor.width / 2 + razorOffsetX,
      razor.y,
      razor.width,
      razor.height
    );
    ctx.restore();
  }
}

/* ------------------- DEBUG ----------------*/

function drawRazorRectangleDebug(rectX, rectY) {
  if (!razor.showRazorRectDebug) return;
  // Draw interactive rectangle (debug) - follows razor
  ctx.beginPath();
  ctx.rect(rectX - rect.w / 2, rectY - rect.h / 2, rect.w, rect.h);
  ctx.fillStyle = razor.isDragging
    ? "rgba(34,34,34,0.3)"
    : razor.isHovered
    ? "rgba(51,51,51,0.3)"
    : "rgba(102,102,102,0.3)";
  ctx.fill();
  ctx.strokeStyle = razor.isDragging
    ? "yellow"
    : razor.isHovered
    ? "white"
    : "#999";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawThreeMaskDebug() {
  if (!showMaskDebug) return;
  ctx.save();
  ctx.drawImage(
    threeMaskSVG,
    threeMaskRect.x,
    threeMaskRect.y,
    threeMaskRect.w,
    threeMaskRect.h
  );
  ctx.restore();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "f") {
    finish();
  }
});
