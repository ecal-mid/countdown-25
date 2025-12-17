import { createEngine } from "../_shared/engine.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

canvas.style.cursor = "none";

let endFade = 0;

async function loadImage(url) {
  return new Promise((res) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      res(img);
    };
  });
}

let mouseImage;
let mousePressedImage;
let svgImage;
let clickSound; // New: Audio object for the click sound
let isSoundPlaying = false; // New: Track if the sound is currently playing

async function preload() {
  mouseImage = await loadImage("mouse.svg");
  mousePressedImage = await loadImage("candle-light.svg");
  svgImage = await loadImage("2.svg");

  // New: Load the audio file (replace 'click-sound.mp3' with your file)
  clickSound = new Audio("candle.mp3");
  clickSound.loop = true; // Loop the sound while active

  run(update);
}

preload();

// Utility to extract visible bounds
function getSVGVisibleBounds(img, callback) {
  const probe = new Image();
  probe.src = img.src;
  probe.onload = () => {
    const w = probe.naturalWidth;
    const h = probe.naturalHeight;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tctx = tempCanvas.getContext("2d");
    tctx.drawImage(probe, 0, 0);
    const data = tctx.getImageData(0, 0, w, h).data;
    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0;
    let found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 0) {
          found = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (!found) {
      callback({ x: 0, y: 0, w, h });
      return;
    }
    callback({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  };
}

// Animation variables
let topRadius = 20;
const bottomRadius = 20;
let currentHeight = 200;
let isHovering = false;
let puddleOpacity = 0;
let meltSpeed = 0;
let meltProgress = 0;

// Rounded rectangle helper
function drawRoundedRect(x, y, width, height, radii) {
  const clampedRadii = radii.map((r) => Math.min(r, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + clampedRadii[0], y);
  ctx.lineTo(x + width - clampedRadii[1], y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + clampedRadii[1]);
  ctx.lineTo(x + width, y + height - clampedRadii[2]);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - clampedRadii[2],
    y + height
  );
  ctx.lineTo(x + clampedRadii[3], y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - clampedRadii[3]);
  ctx.lineTo(x, y + clampedRadii[0]);
  ctx.quadraticCurveTo(x, y, x + clampedRadii[0], y);
  ctx.closePath();
}

function update(dt) {
  const cubeSize = Math.min(canvas.width / 2, canvas.height / 2);

  const svgAspect = svgImage.width / svgImage.height;
  const svgWidth = cubeSize * svgAspect; // Increased from 3 to 5
  const svgHeight = cubeSize; // Increased from 3 to 5
  const svgX = canvas.width / 2 - svgWidth / 2;
  const svgY = canvas.height / 2 - svgHeight / 2;

  const cubeX = canvas.width / 2 - cubeSize / 2;
  const cubeY = canvas.height / 2 - cubeSize / 2;

  if (currentHeight === 200) {
    currentHeight = cubeSize;
  }

  const mouseX = input.getX();
  const mouseY = input.getY();
  isHovering =
    mouseX >= cubeX &&
    mouseX <= cubeX + cubeSize &&
    mouseY >= cubeY &&
    mouseY <= cubeY + cubeSize;
  const isPressedAndHovering = input.isPressed() && isHovering;

  // New: Manage sound playback based on click state
  if (isPressedAndHovering) {
    if (!isSoundPlaying) {
      clickSound
        .play()
        .catch((err) => console.error("Audio play failed:", err)); // Handle potential autoplay issues
      isSoundPlaying = true;
    }
  } else {
    if (isSoundPlaying) {
      clickSound.pause();
      clickSound.currentTime = 0; // Reset to start for next play
      isSoundPlaying = false;
    }
  }

  // Melt animation
  if (isPressedAndHovering) {
    meltSpeed -= 150 * dt;
  }
  const damping = 1.5;
  meltSpeed *= Math.exp(-dt * damping);
  currentHeight += meltSpeed * dt;
  currentHeight = math.clamp(currentHeight, 0, cubeSize);
  const topRadius = math.mapClamped(currentHeight, cubeSize, 0, 20, 200);

  const targetOpacity = isPressedAndHovering ? 1 : 0;
  puddleOpacity += (targetOpacity - puddleOpacity) * dt;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const targetMeltProgress = 1 - currentHeight / cubeSize;
  meltProgress = math.lerp(meltProgress, targetMeltProgress, 0.02);
  const completelyMelted = currentHeight < 1;

  const puddleWidth = math.lerp(
    cubeSize - bottomRadius * 2,
    cubeSize * 2, // Increased from 1.5 to 2
    meltProgress
  );
  const puddleHeight = math.lerp(0, cubeSize * 0.5, meltProgress); // Increased from 0.3 to 0.5
  const puddleX = cubeX + cubeSize / 2;
  const puddleY = cubeY + cubeSize - math.lerp(0, 20, meltProgress);

  ctx.beginPath();
  ctx.ellipse(
    puddleX,
    puddleY,
    puddleWidth / 2,
    puddleHeight / 2,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = `white`;
  ctx.fill();
  ctx.strokeStyle = `blue`;
  ctx.lineWidth = 3;
  ctx.stroke();

  if (svgImage.complete) {
    ctx.drawImage(svgImage, svgX, svgY, svgWidth, svgHeight);
  }

  if (!completelyMelted) {
    const coverWidth = cubeSize;
    const coverHeight = currentHeight;
    const coverX = cubeX;
    const coverY = cubeY + (cubeSize - currentHeight);
    drawRoundedRect(coverX, coverY, coverWidth, coverHeight, [
      topRadius,
      topRadius,
      bottomRadius,
      bottomRadius,
    ]);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // ---- DRAW MOUSE SVG LAST ----
  // Switch cursor image when clicked
  const cursorToDraw = input.isPressed() ? mousePressedImage : mouseImage;

  if (true) {
    const baseSize = 200;
    const aspect = cursorToDraw.width / cursorToDraw.height;
    const mouseWidth = baseSize * aspect;
    const mouseHeight = baseSize;
    ctx.drawImage(
      cursorToDraw,
      mouseX - mouseWidth / 2,
      mouseY,
      mouseWidth,
      mouseHeight
    );
  }

  if (completelyMelted) {
    endFade = math.lerp(endFade, 1, 2 * dt);

    if (endFade >= 0.98) {
      finish();
    }

    ctx.save();
    ctx.globalAlpha = math.mapClamped(endFade, 0.5, 1, 0, 1);
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fill();
    ctx.restore();
  }
}
