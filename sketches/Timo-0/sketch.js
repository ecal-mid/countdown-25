import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Configuration constants
const CONFIG = {
  SQUARE_SIZE: 400,
  SOUND_DELAY_MS: 50,
  FLEE_DISTANCE: 0.3,
  INTRO_WAIT_MS: 2000,
  INTRO_SCALE_MS: 500,
  VOLUME: 0.09,
  PATH_POINTS: 500,
  ELLIPSE_RATIO: 1.3,
  PATH_RADIUS_RATIO: 0.3,
  SPRING_FREQUENCY: 1.5,
  SPRING_HALF_LIFE: 0.1,
};

// State management
const state = {
  intro: {
    startTime: null,
    soundPlayed: false,
    complete: false,
    imageScale: 0,
  },
  game: {
    visitedPoints: new Set(),
    previousIndex: 0,
    lastSoundTime: 0,
    complete: false,
    currentPointIndex: 0,
  },
  closing: {
    active: false,
    startTime: null,
    duration: 800,
  },
};

// Audio setup
let audioContext;
let audioBuffer;

function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  fetch("./ERROR.mp3")
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
    .then((buffer) => {
      audioBuffer = buffer;
      console.log("Audio loaded successfully");
    })
    .catch((e) => console.log("Audio load failed:", e));
}

function playSound() {
  if (!audioBuffer || !audioContext) return;

  const now = Date.now();
  if (now - state.game.lastSoundTime < CONFIG.SOUND_DELAY_MS) return;

  state.game.lastSoundTime = now;

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  gainNode.gain.value = CONFIG.VOLUME;
  source.buffer = audioBuffer;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  source.start(0);
}

function playIntroSound() {
  if (!audioBuffer || !audioContext) return;

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  gainNode.gain.value = CONFIG.VOLUME;
  source.buffer = audioBuffer;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  source.start(0);
}

// Initialize audio
initAudio();

// Spring setup
const spring = new Spring({ position: 0 });
const settings = createSpringSettings({
  frequency: CONFIG.SPRING_FREQUENCY,
  halfLife: CONFIG.SPRING_HALF_LIFE,
});
spring.settings = settings;

// Load image
const scrollImage = new Image();
scrollImage.src = "./POPUP.png";

// Create the "0" path
function createZeroPath(centerX, centerY, radius) {
  const points = [];

  for (let i = 0; i <= CONFIG.PATH_POINTS; i++) {
    const angle = (i / CONFIG.PATH_POINTS) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * CONFIG.ELLIPSE_RATIO;
    points.push({ x, y });
  }

  return points;
}

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = Math.min(canvas.width, canvas.height) * CONFIG.PATH_RADIUS_RATIO;
const zeroPath = createZeroPath(centerX, centerY, radius);

// Mark points between two indices (handling circular path)
function markPointsBetween(startIndex, endIndex, pathLength, shouldPlaySound) {
  let newPointsMarked = false;

  if (startIndex === endIndex) {
    if (!state.game.visitedPoints.has(startIndex)) {
      state.game.visitedPoints.add(startIndex);
      newPointsMarked = true;
    }
  } else {
    // Calculate shortest path direction
    const forwardDist = (endIndex - startIndex + pathLength) % pathLength;
    const backwardDist = (startIndex - endIndex + pathLength) % pathLength;

    if (forwardDist <= backwardDist) {
      // Move forward
      let current = startIndex;
      while (current !== endIndex) {
        if (!state.game.visitedPoints.has(current)) {
          state.game.visitedPoints.add(current);
          newPointsMarked = true;
        }
        current = (current + 1) % pathLength;
      }
    } else {
      // Move backward
      let current = startIndex;
      while (current !== endIndex) {
        if (!state.game.visitedPoints.has(current)) {
          state.game.visitedPoints.add(current);
          newPointsMarked = true;
        }
        current = (current - 1 + pathLength) % pathLength;
      }
    }

    // Mark end point
    if (!state.game.visitedPoints.has(endIndex)) {
      state.game.visitedPoints.add(endIndex);
      newPointsMarked = true;
    }
  }

  // Play sound once if new points were marked and hovering
  if (shouldPlaySound && newPointsMarked) {
    playSound();
  }
}

// Easing function for intro animation
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Draw image at position
function drawImage(x, y, size) {
  if (scrollImage.complete) {
    ctx.drawImage(scrollImage, x - size / 2, y - size / 2, size, size);
  } else {
    ctx.fillStyle = "white";
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
}

// Update intro sequence
function updateIntro(elapsedTime) {
  // Phase 1: Black screen wait
  if (elapsedTime < CONFIG.INTRO_WAIT_MS) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return true; // Continue intro
  }

  // Phase 2: Scale animation
  const scaleElapsed = elapsedTime - CONFIG.INTRO_WAIT_MS;
  if (scaleElapsed < CONFIG.INTRO_SCALE_MS) {
    const progress = scaleElapsed / CONFIG.INTRO_SCALE_MS;
    state.intro.imageScale = easeOutCubic(progress);

    // Play sound at start of scale
    if (!state.intro.soundPlayed) {
      playIntroSound();
      state.intro.soundPlayed = true;
    }

    // Draw black background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw scaled image at center
    const pos = zeroPath[0];
    const scaledSize = CONFIG.SQUARE_SIZE * state.intro.imageScale;
    drawImage(pos.x, pos.y, scaledSize);

    return true; // Continue intro
  }

  // Intro complete
  state.intro.complete = true;
  state.intro.imageScale = 1;
  state.game.visitedPoints.add(0);
  return false;
}

// Update game state
function updateGame(dt) {
  // Check if all points visited
  if (state.game.visitedPoints.size >= zeroPath.length) {
    if (!state.game.complete) {
      state.game.complete = true;
      canvas.style.cursor = "pointer";
    }

    // Draw final state
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let pointIndex of state.game.visitedPoints) {
      const visitedPos = zeroPath[pointIndex];
      drawImage(visitedPos.x, visitedPos.y, CONFIG.SQUARE_SIZE);
    }
    return;
  }

  // Get mouse position
  const mouseX = input.getX();
  const mouseY = input.getY();

  // Calculate current position on path
  let progress = spring.position % 1;
  if (progress < 0) progress += 1;
  const currentPointIndex = Math.floor(progress * (zeroPath.length - 1));
  state.game.currentPointIndex = currentPointIndex;
  const pos = zeroPath[currentPointIndex];

  // Check if mouse is hovering over square
  const isHoveringSquare =
    mouseX >= pos.x - CONFIG.SQUARE_SIZE / 2 &&
    mouseX <= pos.x + CONFIG.SQUARE_SIZE / 2 &&
    mouseY >= pos.y - CONFIG.SQUARE_SIZE / 2 &&
    mouseY <= pos.y + CONFIG.SQUARE_SIZE / 2;

  if (isHoveringSquare) {
    // Determine which direction to flee
    const nextIndex = (currentPointIndex + 1) % zeroPath.length;
    const prevIndex =
      (currentPointIndex - 1 + zeroPath.length) % zeroPath.length;

    const nextPos = zeroPath[nextIndex];
    const prevPos = zeroPath[prevIndex];

    const distToNext = Math.hypot(mouseX - nextPos.x, mouseY - nextPos.y);
    const distToPrev = Math.hypot(mouseX - prevPos.x, mouseY - prevPos.y);

    // Flee away from mouse
    if (distToNext < distToPrev) {
      spring.target = spring.position - CONFIG.FLEE_DISTANCE;
    } else {
      spring.target = spring.position + CONFIG.FLEE_DISTANCE;
    }
  } else {
    spring.target = spring.position;
  }

  spring.step(dt);

  // Mark all points between previous and current position
  markPointsBetween(
    state.game.previousIndex,
    currentPointIndex,
    zeroPath.length,
    isHoveringSquare
  );

  state.game.previousIndex = currentPointIndex;

  // Draw everything
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw all visited points
  for (let pointIndex of state.game.visitedPoints) {
    const visitedPos = zeroPath[pointIndex];
    drawImage(visitedPos.x, visitedPos.y, CONFIG.SQUARE_SIZE);
  }

  // Draw current position on top
  drawImage(pos.x, pos.y, CONFIG.SQUARE_SIZE);
}

// Update closing animation
function updateClosing(elapsedTime) {
  const progress = Math.min(elapsedTime / state.closing.duration, 1);
  const scale = 1 - easeOutCubic(progress);

  // Draw black background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw all images with decreasing scale
  for (let pointIndex of state.game.visitedPoints) {
    const visitedPos = zeroPath[pointIndex];
    const scaledSize = CONFIG.SQUARE_SIZE * scale;
    drawImage(visitedPos.x, visitedPos.y, scaledSize);
  }

  // Animation complete - just show black screen
  if (progress >= 1) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Main update loop
function update(dt) {
  // Initialize intro start time
  if (state.intro.startTime === null) {
    state.intro.startTime = Date.now();
  }

  // Handle closing animation
  if (state.closing.active) {
    const elapsedTime = Date.now() - state.closing.startTime;
    updateClosing(elapsedTime);
    return;
  }

  const elapsedTime = Date.now() - state.intro.startTime;

  // Handle intro or game
  if (!state.intro.complete) {
    updateIntro(elapsedTime);
  } else {
    updateGame(dt);
  }
}

// Click handler
canvas.addEventListener("click", (e) => {
  if (!state.game.complete || state.closing.active) return;

  // Start closing animation
  state.closing.active = true;
  state.closing.startTime = Date.now();
  canvas.style.cursor = "default";

  // Play closing sound
  playSound();
  setTimeout(finish, 3000);
});

run(update);
