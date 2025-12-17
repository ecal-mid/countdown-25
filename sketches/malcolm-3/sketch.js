import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";
import Tomato from "./tomato.js";

const { renderer, input, math, run, finish } = createEngine();
console.log(input);
const { ctx, canvas } = renderer;
run(update);

const spring = new Spring({
  position: 0,
  frequency: 2.5,
  halfLife: 0.05,
});
const svgImage = new Image();
svgImage.src = "./assets/SVG/number-3.svg";
let svgloaeded = false;
svgImage.onload = () => {
  svgloaeded = true;
};

// Preload tomato and splash images (arrays for randomization)
const NUM_SPRITES = 4; // Number of sprite variations (adjust based on your assets)
const preloadedImages = {
  tomatoes: [],
  splashes: [],
  traces: [],
};

// Preload all sprite variations
for (let i = 0; i < NUM_SPRITES; i++) {
  const tomatoImg = new Image();
  const splashImg = new Image();
  // Assuming files are named: tomato.png, tomato2.png, tomato3.png, etc.
  // Or: tomato-0.png, tomato-1.png, etc. - adjust the path as needed
  tomatoImg.src =
    i === 0 ? "./assets/PNG/tomato.png" : `./assets/PNG/tomato${i + 1}.png`;
  splashImg.src =
    i === 0 ? "./assets/PNG/splash.png" : `./assets/PNG/splash${i + 1}.png`;
  preloadedImages.tomatoes.push(tomatoImg);
  preloadedImages.splashes.push(splashImg);
}

// Preload trace images (trace.png to trace4.png)
for (let i = 0; i < 4; i++) {
  const traceImg = new Image();
  traceImg.src =
    i === 0 ? "./assets/PNG/trace.png" : `./assets/PNG/trace${i + 1}.png`;
  preloadedImages.traces.push(traceImg);
}

let tomato = [];
let stuckTomatoCount = 0;
const limiteStuckTomatoes = 50;
let allTraces = []; // Global array to store all traces separately
let isTomatoThrowable = true;
let isCleanupMode = false;

// Cleanup slide sounds (multiple variations)
const slideSoundPaths = [
  "./assets/AUDIO/slide.wav",
  "./assets/AUDIO/slide2.wav",
  "./assets/AUDIO/slide3.wav",
  "./assets/AUDIO/slide4.wav",
  "./assets/AUDIO/slide5.wav",
];
let cleanupSlideSound = new Audio(slideSoundPaths[0]);
cleanupSlideSound.loop = true;
cleanupSlideSound.volume = 0;

function pickRandomSlideSound() {
  const randomIndex = Math.floor(Math.random() * slideSoundPaths.length);
  const wasPlaying = !cleanupSlideSound.paused;
  const currentVolume = cleanupSlideSound.volume;
  cleanupSlideSound.pause();
  cleanupSlideSound = new Audio(slideSoundPaths[randomIndex]);
  cleanupSlideSound.loop = true;
  cleanupSlideSound.volume = currentVolume;
  if (wasPlaying) {
    cleanupSlideSound.play();
  }
}

// Track mouse movement for cleanup sound
let lastMouseX = 0;
let lastMouseY = 0;
let lastDirX = 0;
let lastDirY = 0;

console.log(canvas.width, canvas.height);
function update(dt) {
  if (input.isPressed()) {
    cleanupSlideSound.play();
  }
  /*
  if (input.isPressed()) {
    spring.target = 0;
    tomato.push(new Tomato(ctx, input));
  } else {
    spring.target = 1;
  }
  */
  // Only allow throwing tomatoes if not in cleanup mode
  if (!isCleanupMode) {
    if (input.isDown()) {
      spring.target = 0;
      if (isTomatoThrowable) {
        tomato.push(new Tomato(ctx, input, allTraces, preloadedImages));
      }
    } else {
      spring.target = 1;
    }
  } else {
    // In cleanup mode, remove traces near cursor
    cleanUpTraces();
  }

  spring.step(dt);

  const x = canvas.width / 2;
  const y = canvas.height / 2;
  const scale = Math.max(spring.position, 0);

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw all traces from global array
  allTraces.forEach((trace) => {
    ctx.globalAlpha = trace.alpha;
    const img = trace.image || preloadedImages.traces[0];
    const imgSize = trace.size * 2;
    ctx.save();
    ctx.translate(trace.x, trace.y);
    ctx.rotate(trace.rotation);
    ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
    ctx.restore();
  });

  // Update and draw the tomato
  tomato.forEach((t) => {
    t.update();
    if (t.posY - t.size > canvas.height) {
      tomato.splice(tomato.indexOf(t), 1);
      console.log("Tomato removed. Remaining tomatoes:", tomato.length);
    }
    if (t.wasJustThrownInside()) {
      stuckTomatoCount++;
      console.log("Tomatoes stuck inside SVG:", stuckTomatoCount);
    }
    if (stuckTomatoCount >= limiteStuckTomatoes) {
      t.posY += 5;
      // Switch to cleanup mode when all tomatoes are gone
      if (tomato.length === 0) {
        isCleanupMode = true;
      }
    }
  });

  if (isCleanupMode) {
    visualCleanUpObject();

    // Calculate mouse movement speed
    const mouseX = input.getX();
    const mouseY = input.getY();
    const dx = mouseX - lastMouseX;
    const dy = mouseY - lastMouseY;
    const mouseSpeed = Math.sqrt(dx * dx + dy * dy);

    // Detect direction change (sign change in dx or dy)
    const dirX = Math.sign(dx);
    const dirY = Math.sign(dy);
    if (
      (dirX !== 0 && dirX !== lastDirX) ||
      (dirY !== 0 && dirY !== lastDirY)
    ) {
      //pickRandomSlideSound();
    }
    if (dirX !== 0) lastDirX = dirX;
    if (dirY !== 0) lastDirY = dirY;

    // Update volume based on mouse movement speed
    const targetVolume = Math.min(mouseSpeed / 20, 0.5);
    cleanupSlideSound.volume = math.lerp(
      cleanupSlideSound.volume,
      targetVolume,
      0.1
    );
    console.log("Cleanup sound volume:", cleanupSlideSound.volume);

    // Play/pause based on movement
    if (mouseSpeed > 1) {
      //    if (cleanupSlideSound.paused) {
      //     cleanupSlideSound.play();
      //   }
    } else {
      //   cleanupSlideSound.volume = 0;
    }

    lastMouseX = mouseX;
    lastMouseY = mouseY;
  } else {
    // Stop cleanup sound when not in cleanup mode
    if (!cleanupSlideSound.paused) {
      //     cleanupSlideSound.pause();
      //    cleanupSlideSound.currentTime = 0;
    }
  }

  // Finish when all traces are cleaned up
  if (isCleanupMode && allTraces.length === 0) {
    cleanupSlideSound.pause();
    finish();
  }
}

function getDifferentSplashImage() {
  switch (number) {
    case 1:
      return "./assets/PNG/splash.png";
    case 2:
      return "./assets/PNG/splash-2.png";
    case 3:
      return "./assets/PNG/splash-3.png";
    case 4:
      return "./assets/PNG/splash-4.png";
  }
}

const cleanupRadius = ctx.canvas.width * 0.08;
//console.log("Cleanup radius:", cleanupRadius);
function cleanUpTraces() {
  const mouseX = input.getX();
  const mouseY = input.getY();

  // Remove traces that are close to the cursor
  for (let i = allTraces.length - 1; i >= 0; i--) {
    const trace = allTraces[i];
    const dx = trace.x - mouseX;
    const dy = trace.y - mouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < cleanupRadius) {
      allTraces.splice(i, 1);
    }
  }
}

const cleaningTowelImg = new Image();
cleaningTowelImg.src = "./assets/PNG/cleaning-towel.png";
function visualCleanUpObject() {
  const mouseX = input.getX();
  const mouseY = input.getY();

  const imgSize = cleanupRadius * 1.5;
  ctx.drawImage(
    cleaningTowelImg,
    mouseX - imgSize / 2,
    mouseY - imgSize / 2,
    imgSize,
    imgSize
  );
}
