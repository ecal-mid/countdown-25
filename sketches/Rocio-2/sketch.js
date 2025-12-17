import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// ==================== SCRATCH SURFACE CONFIG ====================
var scratchWidth = 830;
var scratchHeight = 490;

// Scratch canvas (offscreen)
var scratchCanvas = document.createElement("canvas");
var scratchCtx = scratchCanvas.getContext("2d");

scratchCanvas.width = scratchWidth;
scratchCanvas.height = scratchHeight;

// Init scratch surface (full gray)
function initScratchSurface() {
  scratchCtx.fillStyle = "#919191ff";
  scratchCtx.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);
}

// ==================== CHECK ZONE ====================
const checkRectX = 600;
const checkRectY = 100;
const checkRectWidth = 200;
const checkRectHeight = 300;

// ==================== FADE / STATE ====================
var fadeOutStartTime = null;
var fadeOutDuration = 1; // seconds
var thresholdReached = false;

// fade-out for number 2
const ceroFadeDuration = 1000; // ms
var ceroFadeStart = null;
var ceroOpacity = 1;
var scratchingComplete = false;
var wasPressed = false;

// track previous mouse position for smooth lines
var prevMouseX = 0;
var prevMouseY = 0;

// slide-in animation
var animationStartTime = Date.now() / 1000;
var animationDuration = 1; // seconds
let slideInElapsed = 0;

// pixel check optimization
var frameCounter = 0;
var checkFrequency = 5;
var lastScratchProgress = 0;

// ==================== IMAGE (TICKET) ====================
var img = new Image();
var imgLoaded = false;

var x = 0;
var y = 0;
var imageWidth = 0;
var imageHeight = 0;

img.onload = function () {
  imgLoaded = true;
  imageWidth = img.naturalWidth;
  imageHeight = img.naturalHeight;

  var scale = 9;
  imageWidth *= scale;
  imageHeight *= scale;

  x = (canvas.width - imageWidth) / 2;
  y = (canvas.height - imageHeight) / 2;
  initScratchSurface();
};

img.src = "./assets-ticket/ticket.svg";

// ==================== AUDIO ====================
// Chemin à adapter à ton projet
const SCRATCH_SOUND_SRC = "./assets-ticket/scratch-soundv2.mp3";

const scratchSound = new Audio(SCRATCH_SOUND_SRC);
scratchSound.volume = 0.8;
scratchSound.loop = true;

let isScratchSoundPlaying = false;

function startScratchSound() {
  if (isScratchSoundPlaying) return;
  isScratchSoundPlaying = true;

  try {
    scratchSound.currentTime = 0;
  } catch (e) {
    // au cas où le son ne soit pas ready
  }

  const playPromise = scratchSound.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {
      // si le navigateur bloque le son, on remet le flag
      isScratchSoundPlaying = false;
    });
  }
}

function stopScratchSound() {
  if (!isScratchSoundPlaying) return;
  scratchSound.pause();
  isScratchSoundPlaying = false;
}

// ==================== MAIN LOOP ====================
run(update);

function update(dt) {
  // Positions
  var numberX = canvas.width / 2;
  var numberY = canvas.height / 2 + 350;
  var scratchX = canvas.width / 2 - scratchWidth / 2;
  var scratchY = canvas.height / 2 - scratchHeight / 2 + 285;

  // ========== SCRATCH INPUT ==========
  if (input.isPressed()) {
    const mouseX = input.getX();
    const mouseY = input.getY();

    // première frame du clic
    if (!wasPressed) {
      // Si le grattage est déjà fini et qu'on reclique, on lance le fade du 2
      if (scratchingComplete) {
        ceroFadeStart = Date.now();
      }
    } else {
      // démarrer le son de scratch (only if scratching is not complete)
      startScratchSound();
    }

    wasPressed = true;

    // Init previous mouse pos si nécessaire
    if (prevMouseX === 0 && prevMouseY === 0) {
      prevMouseX = mouseX;
      prevMouseY = mouseY;
    }

    // Dessin du scratch (effacer sur le canvas gris)
    scratchCtx.globalCompositeOperation = "destination-out";
    scratchCtx.beginPath();
    scratchCtx.moveTo(prevMouseX - scratchX, prevMouseY - scratchY);
    scratchCtx.lineTo(mouseX - scratchX, mouseY - scratchY);
    scratchCtx.strokeStyle = "rgba(0,0,0,1)";
    scratchCtx.lineWidth = 20;
    scratchCtx.lineCap = "round";
    scratchCtx.lineJoin = "round";
    scratchCtx.stroke();
    scratchCtx.globalCompositeOperation = "source-over";

    prevMouseX = mouseX;
    prevMouseY = mouseY;
  } else {
    // si on arrête de cliquer → stop le son
    if (wasPressed) {
      stopScratchSound();
    }
    prevMouseX = 0;
    prevMouseY = 0;
    wasPressed = false;
  }

  // ========== PROGRESS DU GRATTAGE ==========
  frameCounter++;
  let scratchProgress = lastScratchProgress;

  if (frameCounter >= checkFrequency) {
    frameCounter = 0;
    const scratchPixels = scratchCtx.getImageData(
      checkRectX,
      checkRectY,
      checkRectWidth,
      checkRectHeight
    );
    const data = scratchPixels.data;

    let activePixelCount = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 128) {
        activePixelCount++;
      }
    }
    const totalPixelCount = data.length / 4;
    scratchProgress = 1 - activePixelCount / totalPixelCount;
    lastScratchProgress = scratchProgress;
  }

  // ========== SEUIL & FADE TICKET ==========
  if (scratchProgress > 0.5 && !thresholdReached) {
    thresholdReached = true;
    fadeOutStartTime = Date.now() / 1000;
    scratchingComplete = true;
  }

  if (scratchProgress <= 0.5 && thresholdReached) {
    thresholdReached = false;
    fadeOutStartTime = null;
    scratchingComplete = false;
  }

  let fadeOutOpacity = 1;
  if (thresholdReached && fadeOutStartTime !== null) {
    const elapsedTime = Date.now() / 1000 - fadeOutStartTime;
    fadeOutOpacity = Math.max(0, 1 - elapsedTime / fadeOutDuration);
  }

  // ========== FADE DU CHIFFRE 2 ==========
  if (ceroFadeStart !== null) {
    const fadeElapsed = Date.now() - ceroFadeStart;
    const fadeProgress = Math.min(fadeElapsed / ceroFadeDuration, 1);
    ceroOpacity = 1 - fadeProgress;

    if (ceroOpacity <= 0) {
      // on s’assure que le son est coupé avant de terminer
      stopScratchSound();
      finish();
    }
  }

  // ========== SLIDE-IN ANIMATION ==========
  const currentTime = Date.now() / 1000;
  slideInElapsed = slideInElapsed + 0.02;

  const slideInProgress = Math.min(1, slideInElapsed / animationDuration);
  const slideInOffset = (1 - slideInProgress) * canvas.height;

  // ========== RENDER ==========
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(0, slideInOffset);

  // Ticket
  if (imgLoaded) {
    ctx.globalAlpha = fadeOutOpacity;
    ctx.drawImage(img, x, y, imageWidth, imageHeight);
    ctx.globalAlpha = 1;
  }

  // Chiffre 2
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 + 150;
  const originalX = canvas.width / 2 + 268;
  const originalY = canvas.height / 2 + 289;

  ctx.fillStyle = "#fff";
  ctx.font = "200px TWK, Arial, sans-serif";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Growth starts only after ticket fades out completely
  const growthProgress =
    Math.max(0, 1 - fadeOutOpacity - fadeOutDuration * 0.5) /
    (1 - fadeOutDuration * 0.5);
  const scale = 1 + growthProgress * 12.995;

  const currentX = originalX + (centerX - originalX) * growthProgress;
  const currentY = originalY + (centerY - originalY) * growthProgress;

  ctx.save();
  ctx.translate(currentX, currentY);
  ctx.scale(scale, scale);
  ctx.globalAlpha = ceroOpacity;
  ctx.fillText("2", 0, 0);

  const strokeOpacity = fadeOutOpacity > 0.99 ? 1 : 0;
  ctx.globalAlpha = ceroOpacity * strokeOpacity;
  ctx.strokeText("2", 0, 0);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Scratch layer
  ctx.globalAlpha = fadeOutOpacity;
  ctx.drawImage(scratchCanvas, scratchX, scratchY);
  ctx.globalAlpha = 1;

  ctx.restore();
}
