import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

canvas.style.cursor = "none";

const canvas2 = document.createElement("canvas");
const ctx2 = canvas2.getContext("2d");
canvas2.width = canvas.width;
canvas2.height = canvas.height;

const matchSound = new Audio("assets/match.mp3");
matchSound.preload = "auto";
matchSound.volume = 0.5;

const candleSound = new Audio("assets/burn.mp3");
candleSound.preload = "auto";
candleSound.loop = true;
candleSound.volume = 1;

let hasClickedToLight = false;
let candleSoundPlaying = false;

let matchLoopActive = false;
const MATCH_START = 11;
const MATCH_SEGMENT_START = 15;
const MATCH_SEGMENT_END = 20;

matchSound.addEventListener("timeupdate", () => {
  if (!matchLoopActive) {
    if (matchSound.currentTime >= MATCH_SEGMENT_END) {
      matchLoopActive = true;
      try {
        matchSound.currentTime = MATCH_SEGMENT_START;
      } catch (e) {}
    }
  } else {
    if (
      matchSound.currentTime >= MATCH_SEGMENT_END ||
      matchSound.currentTime < MATCH_SEGMENT_START
    ) {
      try {
        matchSound.currentTime = MATCH_SEGMENT_START;
      } catch (e) {}
    }
  }
});

function fadeInAudio(audio, targetVol = 1, durationMs = 1000) {
  const startVol = 0;
  const startTime = performance.now();
  audio.volume = startVol;

  function step(now) {
    const t = Math.min(1, (now - startTime) / durationMs);
    audio.volume = startVol + (targetVol - startVol) * t;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

canvas.addEventListener("click", () => {
  hasClickedToLight = true;
  try {
    matchLoopActive = false;
    matchSound.currentTime = MATCH_START;
    matchSound.play();
  } catch (e) {}
});

const handImage = new Image();
handImage.src = "assets/hand.svg";
let handLoaded = false;
handImage.onload = () => (handLoaded = true);

const handScale = 0.3;
const handCursorOffset = { x: 820, y: 1300 };
const haloHotspotOffset = { x: 900, y: 750 };
let haloTip = { x: 0, y: 0 };

const candleFade = new Spring({ position: 0, frequency: 1, halfLife: 0.5 });

function drawHandCursor() {
  if (!isMouseOverCanvas || !handLoaded) return;

  const baseW = 1640;
  const baseH = 2360;
  const w = baseW * handScale;
  const h = baseH * handScale;

  const x = mouse.x - handCursorOffset.x * handScale;
  const y = mouse.y - handCursorOffset.y * handScale;

  haloTip.x = x - 270 + haloHotspotOffset.x * handScale;
  haloTip.y = y - 50 + haloHotspotOffset.y * handScale;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(handImage, x, y, w, h);
  ctx.restore();
}

run(update);

const candleImage = new Image();
candleImage.src = "assets/candle.svg";
let candleLoaded = false;
candleImage.onload = () => (candleLoaded = true);

const maskSpring = new Spring({ position: 0, frequency: 2, halfLife: 0.3 });
const flameSpring = new Spring({ position: 1, frequency: 1.5, halfLife: 0.3 });
const heatHaloSpring = new Spring({
  position: 0,
  frequency: 3,
  halfLife: 0.25,
});

let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let isMouseOverCanvas = false;

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) * canvas.width) / rect.width;
  mouse.y = ((e.clientY - rect.top) * canvas.height) / rect.height;
  isMouseOverCanvas = true;
});
canvas.addEventListener("mouseleave", () => (isMouseOverCanvas = false));

let heat = 0;
const heatUpSpeed = 0.06;
const triggerDistance = 130;
const meltDelay = 2;
const heatHaloDelay = 2;

let flameUnlocked = false;
let timeSinceMeltStart = 0;

const smokeParticles = [];
class SmokeParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vy = -0.5 - Math.random() * 0.5;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.size = 0.5 + Math.random() * 0.1;
    this.life = 1;
    this.opacity = Math.min(1, Math.max(0, 0.2 + Math.random() * 0.2));
  }
  update(dt) {
    this.y += this.vy * dt * 60;
    this.x += this.vx * dt * 60;
    this.size += 0.2 * dt * 60;
    this.life -= 0.01 * dt * 60;
  }
  draw(ctx) {
    ctx.fillStyle = `rgba(255,255,255, ${this.opacity * this.life})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function getCandleFlicker(base = 1) {
  const t = Date.now() * 0.001;
  const slow = Math.sin(t * 1.1) * 0.05;
  const mid = Math.sin(t * 7.3) * 0.08;
  const fast = Math.sin(t * 13.7 + Math.random() * 0.5) * 0.04;
  const noise = (Math.random() - 0.5) * 0.06;
  return base + slow + mid + fast + noise;
}

let haloDrawn = false;
let timeSinceUnlock = 0;
const minSmokeDistanceFromWick = 90;
const wickSmokeDelay = 1.2;

let introFade = 1;
let outroFade = 0;
let outroActive = false;
const introSpeed = 0.9;
const outroSpeed = 0.8;

const ovals = []; // Array to store ovals

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = ((e.clientX - rect.left) * canvas.width) / rect.width;
  const clickY = ((e.clientY - rect.top) * canvas.height) / rect.height;

  // Check if the click is within the red dot area
  const redDotX = canvas.width / 2; // Assuming the red dot is at the center
  const redDotY = canvas.height / 2;
  const redDotRadius = 20; // Adjust the radius as needed

  const dx = clickX - redDotX;
  const dy = clickY - redDotY;
  if (dx * dx + dy * dy <= redDotRadius * redDotRadius) {
    // Clicked on the red dot, create a new oval
    ovals.push({ x: redDotX, y: redDotY, size: 20 }); // Adjust size as needed
  }
});

// Update function to move ovals down
function update(dt) {
  if (!candleLoaded) {
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const candleWidth = 300;
  const candleHeight = 600;
  const candleX = centerX - candleWidth / 2;
  const candleY = centerY - candleHeight / 2;

  const maskValue = maskSpring.position;
  const meltOffset = Math.pow(maskValue, 1) * candleHeight;

  const wickX = centerX + 90;
  const wickY = candleY + meltOffset;

  const dx = haloTip.x - wickX;
  const dy = haloTip.y - wickY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const isNearWick = dist < triggerDistance;

  if (hasClickedToLight && isNearWick) flameUnlocked = true;
  if (flameUnlocked) {
    timeSinceUnlock += dt;
    timeSinceMeltStart += dt;
  } else {
    timeSinceUnlock = 0;
    timeSinceMeltStart = 0;
  }

  heatHaloSpring.target =
    flameUnlocked && timeSinceMeltStart > heatHaloDelay
      ? 1
      : hasClickedToLight && isNearWick
      ? 1
      : 0;
  heatHaloSpring.step(dt);

  if (flameUnlocked && timeSinceMeltStart > meltDelay) {
    heat += heatUpSpeed * dt;
    heat = Math.min(1, heat);
    if (!candleSoundPlaying) {
      try {
        candleSound.currentTime = 20;
        candleSound.play();
        candleSoundPlaying = true;
        fadeInAudio(candleSound, 1, 1200);
      } catch (e) {}
    }
  }

  if (!outroActive && heat >= 1) {
    outroActive = true;
    try {
      candleSound.pause();
      candleSound.currentTime = 0;
      candleSoundPlaying = false;
      matchSound.pause();
      matchSound.currentTime = 0;
      matchSoundPlaying = false;
    } catch (e) {}
  }

  maskSpring.target = heat;
  maskSpring.step(dt);

  flameSpring.target = 1;
  flameSpring.step(dt);

  if (
    hasClickedToLight &&
    flameUnlocked &&
    flameSpring.position > 0.03 &&
    dist > minSmokeDistanceFromWick &&
    Math.random() < 0.08
  ) {
    smokeParticles.push(new SmokeParticle(haloTip.x, haloTip.y));
  }

  if (
    flameUnlocked &&
    timeSinceUnlock > wickSmokeDelay &&
    heatHaloSpring.position > 0.2 &&
    Math.random() < 0.05
  ) {
    smokeParticles.push(new SmokeParticle(wickX, wickY - 5));
  }

  candleFade.target = flameUnlocked ? 0.3 : 0;
  candleFade.step(dt);

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (flameUnlocked) {
    const waveTime = Date.now() * 0.02;
    ctx.save();
    ctx.beginPath();
    for (let x = 0; x <= candleWidth; x += 2) {
      const waveY = Math.sin(x * 0.05 + waveTime) * 0.5 * maskValue;
      const px = candleX + x;
      const py = candleY + meltOffset + waveY;
      if (x === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineTo(candleX + candleWidth, candleY + candleHeight);
    ctx.lineTo(candleX, candleY + candleHeight);
    ctx.closePath();
    ctx.clip();

    ctx.globalAlpha = candleFade.position;
    ctx.drawImage(candleImage, candleX, candleY, candleWidth, candleHeight);
    ctx.restore();
  } else {
    ctx2.globalCompositeOperation = "source-over";
    ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
    ctx2.drawImage(candleImage, candleX, candleY, candleWidth, candleHeight);
    ctx2.globalCompositeOperation = "source-atop";
    ctx2.fillStyle = "black";
    ctx2.beginPath();
    ctx2.rect(candleX, candleY, candleWidth, candleHeight);
    ctx2.fill();
    if (hasClickedToLight) {
      drawPermanentFlameHalo(ctx2);
    }

    ctx.drawImage(canvas2, 0, 0);
  }

  ctx.save();
  ctx.filter = "blur(100px)";
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    smokeParticles[i].update(dt);
    smokeParticles[i].draw(ctx);
    if (smokeParticles[i].life <= 0) smokeParticles.splice(i, 1);
  }
  ctx.restore();

  if (hasClickedToLight) {
    drawPermanentFlameHalo(ctx);
  }

  drawHeatHalo(heatHaloSpring.position, wickX, wickY);

  if (hasClickedToLight) {
    drawTorchReveal();
  }

  drawWickGlow(wickX, wickY);

  drawHandCursor();

  // Update ovals
  for (let i = ovals.length - 1; i >= 0; i--) {
    ovals[i].y += 100 * dt; // Move down at a speed of 100 pixels per second
    if (ovals[i].y > canvas.height) {
      ovals.splice(i, 1); // Remove ovals that fall off the canvas
    }
  }

  // Draw ovals
  ctx.fillStyle = "blue"; // Color of the ovals
  for (const oval of ovals) {
    ctx.beginPath();
    ctx.ellipse(oval.x, oval.y, oval.size, oval.size / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (introFade > 0) {
    introFade = Math.max(0, introFade - dt / introSpeed);
  }

  if (outroActive && outroFade < 1) {
    outroFade = Math.min(1, outroFade + dt / outroSpeed);
    if (outroFade >= 1) {
      try {
        finish();
      } catch (e) {}
    }
  }

  const overlayAlpha = Math.max(introFade, outroFade);
  if (overlayAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = overlayAlpha;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function drawPermanentFlameHalo(ctx) {
  if (!isMouseOverCanvas) return;

  const x = haloTip.x;
  const y = haloTip.y;

  const flicker = Math.max(0.6, getCandleFlicker(1));
  const g = ctx.createRadialGradient(x, y, 0, x, y, 140);
  g.addColorStop(0, `rgba(255, 255, 255, ${0.45 * flicker})`);
  g.addColorStop(0.2, `rgba(255, 255, 255, ${0.25 * flicker})`);
  g.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 140, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeatHalo(strength, x, y) {
  if (!flameUnlocked) return;

  const s = Math.max(0.1, strength);
  const r = 400 * s;
  const flicker = Math.max(0.6, getCandleFlicker(1));

  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255, ${0.45 * s * flicker})`);
  g.addColorStop(0.2, `rgba(255,255,255, ${0.25 * s * flicker})`);
  g.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTorchReveal() {
  ctx.save();

  if (isMouseOverCanvas) {
    const flicker = Math.max(0.7, getCandleFlicker(1));
    const radius = 200 * flicker;

    const x = haloTip.x;
    const y = haloTip.y;

    const reveal = ctx.createRadialGradient(x, y, 0, x, y, radius);
    reveal.addColorStop(0, `rgba(255,255,255, ${0.95 * flicker})`);
    reveal.addColorStop(0.2, `rgba(255,255,255, ${0.35 * flicker})`);
    reveal.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = reveal;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawWickGlow(x, y) {
  if (!flameUnlocked) return;

  const r = 300;
  const flicker = Math.max(0.7, getCandleFlicker(1));

  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  glow.addColorStop(0, `rgba(255,255,255, ${0.95 * flicker})`);
  glow.addColorStop(0.2, `rgba(255,255,255, ${0.35 * flicker})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
