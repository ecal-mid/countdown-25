import { createEngine } from "../_shared/engine.js";
import Emoji from "./smiley.js";
import Particle from "./particles.js";

// // Load custom font
// const fontFace = new FontFace("Myriad Pro", "./MyriadPro-Regular.otf");
// fontFace
//   .load()
//   .then((loadedFont) => {
//     document.fonts.add(loadedFont);
//   })
//   .catch((error) => {
//     console.error("Font loading failed:", error);
//   });

const { renderer, run, math, finish } = createEngine();
const { ctx, canvas } = renderer;
run(display);
const size = 500;
const wallThickness = 300;

const emoji_1 = new Emoji({
  number: 1,
  size,
  ctx,
  canvas,
});

const emoji_2 = new Emoji({
  number: -1,
  size,
  ctx,
  canvas,
});

// Particle system for wall explosions
const particles = [];

function createExplosion(emoji1, emoji2, size) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const numParticles = 8;
  for (let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * Math.PI * 2;
    const distance = Math.sqrt(
      Math.pow(emoji1.positionX - centerX, 2) +
        Math.pow(emoji1.positionY - centerY, 2)
    );
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    particles.push(new Particle(x, y, size));
  }
}

let isDragging = false;
let controllingRightSide = null;
let hasMovedToThreeQuarters = false;
let threeFullyScaledTime = null;
let threeFalling = false;
let hasLoggedFallComplete = false;

const LOVE_DISTANCE = 333;
const KISS_DELAY = 1000;

function handleMouseDown(event) {
  if (emoji_1.isAnimatingIn || emoji_2.isAnimatingIn) {
    return;
  }

  if (
    emoji_1.isSnapped ||
    emoji_2.isSnapped ||
    emoji_1.isSeparating ||
    emoji_2.isSeparating ||
    emoji_1.isSlidingOut ||
    emoji_2.isSlidingOut
  ) {
    if (
      (emoji_1.isSnappedAtCenter || emoji_2.isSnappedAtCenter) &&
      !hasMovedToThreeQuarters
    ) {
      const timeSinceSnap = Date.now() - (emoji_1.snapTime || 0);
      if (timeSinceSnap < KISS_DELAY) {
        return;
      }

      emoji_1.moveToThreeQuarters();
      emoji_2.moveToThreeQuarters();
      hasMovedToThreeQuarters = true;
    }
    return;
  }

  isDragging = true;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const clickX = (event.clientX - rect.left) * scaleX;
  const centerX = canvas.width / 2;

  controllingRightSide = clickX > centerX;

  handleMouseMove(event);
}

function handleMouseMove(event) {
  if (!isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  let clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  const centerX = canvas.width / 2;

  if (controllingRightSide) {
    clickX = Math.max(centerX + wallThickness / 2, clickX);
  } else {
    clickX = Math.min(centerX - wallThickness / 2, clickX);
  }

  emoji_1.updatePos(
    clickX,
    clickY,
    canvas.width,
    canvas.height,
    controllingRightSide
  );
  emoji_2.updatePos(
    clickX,
    clickY,
    canvas.width,
    canvas.height,
    controllingRightSide
  );
}

function handleMouseUp() {
  if (
    hasMovedToThreeQuarters &&
    !emoji_1.isSlidingOut &&
    !emoji_2.isSlidingOut
  ) {
    emoji_1.slideOut();
    emoji_2.slideOut();
  }

  isDragging = false;
  controllingRightSide = null;
}

canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseup", handleMouseUp);
canvas.addEventListener("mouseleave", handleMouseUp);

function display() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  emoji_1.update();
  emoji_2.update();

  if (emoji_1.getWinkingChanged() || emoji_2.getWinkingChanged()) {
    createExplosion(emoji_1, emoji_2, size);
  }

  const distance = math.dist(
    emoji_1.positionX,
    emoji_1.positionY,
    emoji_2.positionX,
    emoji_2.positionY
  );

  const snapDistance = canvas.width / 6;

  if (distance < snapDistance && !emoji_1.isSnapped && !emoji_2.isSnapped) {
    const centerX = canvas.width / 2;
    const centerY = (emoji_1.positionY + emoji_2.positionY) / 2;

    const screenCenterY = canvas.height / 2;
    const yTolerance = 100;
    const isAtCenter = Math.abs(centerY - screenCenterY) < yTolerance;

    const emoji1X = centerX + LOVE_DISTANCE / 2;
    const emoji2X = centerX - LOVE_DISTANCE / 2;

    emoji_1.snapToCenter(emoji1X, centerY, isAtCenter);
    emoji_2.snapToCenter(emoji2X, centerY, isAtCenter);

    // Stop any ongoing drag when snapping occurs
    isDragging = false;
    controllingRightSide = null;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    } else {
      particles[i].draw(ctx);
    }
  }

  // Check if the "3" is fully scaled (target is 2.5)
  if (emoji_2.threeScale >= 2.49 && !threeFullyScaledTime) {
    threeFullyScaledTime = Date.now();
  }

  // After 1 second of being fully scaled, make the 3 fall
  if (threeFullyScaledTime && !threeFalling) {
    const timeSinceFullyScaled = Date.now() - threeFullyScaledTime;
    if (timeSinceFullyScaled >= 1000) {
      emoji_2.startFalling();
      threeFalling = true;
      console.log("The 3 is falling!");
    }
  }

  // Check if 3 has fallen off screen
  if (
    threeFalling &&
    !hasLoggedFallComplete &&
    emoji_2.isCompletelyOffScreen()
  ) {
    console.log("The 3 has fallen out of the screen!");
    // hasLoggedFallComplete = true;
    finish();
  }

  emoji_1.draw();
  emoji_2.draw();
}
