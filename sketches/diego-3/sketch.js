const balloonPath =
  "M2.5,22.9c14.3-5,178.2-76.7,157.4,84.2-5.8,44.6-57.8,47.5-92.1,41.2-28-5.4-52.5-7.7-50.6-22.4,1.4-10.8,13.8-14,30.3-13,14.8.9,29.1,5.3,42.3,12.1,26.4,13.7,51.2,34.5,51.3,65,.1,25-10.4,70.4-48.1,80.2-27.1,7.1-58.6-6.7-76.9-34.9";
const trianglePath = "M129.7 241.3 L132.9 251.6 L140.5 242.4 Z";

import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";
const { renderer, run, finish } = createEngine();
const { ctx, canvas } = renderer;
run(update);

let pumpTarget = 0;
const pumpStep = 0.3;
const maxPumpTarget = 2.5;
let popped = false;
let popTimer = 0;
let isPumping = false;
const spring = new Spring({ position: 0, frequency: 0.8, halfLife: 0.9 });
const balloonP2D = new Path2D(balloonPath);
const triangleP2D = new Path2D(trianglePath);

const breathSound = new Audio("assets/breath.mp3");
const inflateSound = new Audio("assets/inflate.mp3");
const popSound = new Audio("assets/pop.mp3");

breathSound.volume = 0;
breathSound.playbackRate = 2;
inflateSound.volume = 0;
inflateSound.playbackRate = 1;
popSound.volume = 0.8;
popSound.playbackRate = 1.0;

const breathTargetVolume = 1;
const inflateTargetVolume = 0.2;

breathSound.load();
inflateSound.load();
popSound.load();

function fadeAudio(audio, targetVolume, duration = 0.2) {
  const startVolume = audio.volume;
  const startTime = Date.now();

  const fade = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / duration, 1);

    audio.volume = startVolume + (targetVolume - startVolume) * progress;

    if (progress < 1) {
      requestAnimationFrame(fade);
    }
  };

  fade();
}

function getPumpTransform() {
  return { x: canvas.width - 80, y: canvas.height / 2 };
}

function isInsideSVGBounds(mx, my) {
  const { x, y } = getPumpTransform();
  const svgSize = Math.min(canvas.width, canvas.height) * 0.5;
  const svgOffset = 50;
  const bounds = {
    left: x - svgSize / 2 - svgOffset,
    right: x + svgSize / 2 - svgOffset,
    top: y - svgSize / 2,
    bottom: y + svgSize / 2,
  };
  return (
    mx >= bounds.left &&
    mx <= bounds.right &&
    my >= bounds.top &&
    my <= bounds.bottom
  );
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (isInsideSVGBounds(mx, my)) {
    isPumping = true;
    pumpBalloon();

    if (!breathSound.paused) {
      fadeAudio(breathSound, 0, 0.15);
      setTimeout(() => breathSound.pause(), 150);
    }

    inflateSound.currentTime = 0;
    inflateSound.volume = 0;
    inflateSound.play().catch((e) => console.log("Audio play failed:", e));
    fadeAudio(inflateSound, inflateTargetVolume, 0.15);
  }
});

canvas.addEventListener("mouseup", () => {
  if (isPumping) {
    isPumping = false;

    fadeAudio(inflateSound, 0, 0.15);
    setTimeout(() => inflateSound.pause(), 150);

    breathSound.currentTime = 0;
    breathSound.volume = 0;
    breathSound.play().catch((e) => console.log("Audio play failed:", e));
    fadeAudio(breathSound, breathTargetVolume, 0.15);
  }
});

canvas.addEventListener("mouseleave", () => {
  if (isPumping) {
    isPumping = false;

    fadeAudio(inflateSound, 0, 0.15);
    setTimeout(() => inflateSound.pause(), 150);

    breathSound.currentTime = 0;
    breathSound.volume = 0;
    breathSound.play().catch((e) => console.log("Audio play failed:", e));
    fadeAudio(breathSound, breathTargetVolume, 0.15);
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  canvas.style.cursor = isInsideSVGBounds(mx, my) ? "pointer" : "default";
});

const blowSVG = new Image();
const inhaleSVG = new Image();
blowSVG.src = "assets/blow.svg";
inhaleSVG.src = "assets/inhale.svg";

function pumpBalloon() {
  pumpTarget = Math.min(maxPumpTarget, pumpTarget + pumpStep);
}

let fadeTimer = 0;
const fadeDuration = 2;
const initialBalloonScale = 0.5;

function update(dt) {
  fadeTimer += dt;
  const fadeAlpha = Math.min(fadeTimer / fadeDuration, 1);

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = fadeAlpha;

  if (popped) {
    popTimer += dt;
    if (popTimer < 0.08) {
      const alpha = 1 - popTimer / 0.08;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    inflateSound.pause();
    breathSound.pause();
    ctx.globalAlpha = 1;
    return;
  }

  spring.target = pumpTarget;
  spring.step(dt);
  const squeeze = Math.max(spring.position, 0);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxSize = Math.min(canvas.width, canvas.height) * 0.5;
  const baseBalloonScale = maxSize / Math.max(164.74, 274.62);
  const currentScale =
    initialBalloonScale +
    (baseBalloonScale - initialBalloonScale) *
      (spring.position / maxPumpTarget);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(currentScale, currentScale);
  ctx.translate(-164.74 / 2, -274.62 / 2);
  ctx.lineWidth = (10 + squeeze * 150) / baseBalloonScale;
  ctx.strokeStyle = "white";
  ctx.lineCap = "round";
  ctx.fill(balloonP2D);
  ctx.stroke(balloonP2D);

  ctx.fill(triangleP2D);

  const triangleX = 135 - 164.74 / 2;
  const triangleY = 245 - 274.62 / 2;
  ctx.restore();

  const worldTriangleX = cx + triangleX * currentScale;
  const worldTriangleY = cy + triangleY * currentScale;

  const svgSize = Math.min(canvas.width, canvas.height) * 0.2;
  const { x, y } = getPumpTransform();

  const mouthRadius = svgSize * 0.15;
  const mouthCenterX = x - svgSize / 2 + 60;
  const mouthCenterY = y + 20;

  const angle = Math.atan2(
    worldTriangleY - mouthCenterY,
    worldTriangleX - mouthCenterX
  );
  const ropeEndX = mouthCenterX + Math.cos(angle) * mouthRadius;
  const ropeEndY = mouthCenterY + Math.sin(angle) * mouthRadius;

  ctx.strokeStyle = "black";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(worldTriangleX, worldTriangleY);
  ctx.quadraticCurveTo(
    (worldTriangleX + ropeEndX) / 2,
    (worldTriangleY + ropeEndY) * 1.05,
    ropeEndX,
    ropeEndY
  );
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(worldTriangleX, worldTriangleY);
  ctx.quadraticCurveTo(
    (worldTriangleX + ropeEndX) / 2,
    (worldTriangleY + ropeEndY) * 1.05,
    ropeEndX,
    ropeEndY
  );
  ctx.stroke();

  const svgOffset = 50;
  ctx.drawImage(
    isPumping ? blowSVG : inhaleSVG,
    x - svgSize / 2 - svgOffset,
    y - svgSize / 2,
    svgSize,
    svgSize
  );

  if (pumpTarget >= maxPumpTarget) {
    popped = true;
    popTimer = 0;

    fadeAudio(inflateSound, 0, 0.1);
    fadeAudio(breathSound, 0, 0.1);
    setTimeout(() => {
      inflateSound.pause();
      breathSound.pause();
    }, 50);

    setTimeout(finish, 1000);

    popSound.currentTime = 4;
    popSound.play().catch((e) => console.log("Pop sound failed:", e));
  }

  if (!isPumping) {
    pumpTarget = Math.max(pumpTarget - dt * 0.1, 0);
  }

  ctx.globalAlpha = 1;
}
