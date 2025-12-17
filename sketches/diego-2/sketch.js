import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const waterSound = new Audio("assets/water.mp3");
waterSound.volume = 0;

function fadeAudio(audio, targetVolume, duration) {
  const step = (targetVolume - audio.volume) / (duration * 60);
  const fade = () => {
    audio.volume += step;
    if (
      (step > 0 && audio.volume < targetVolume) ||
      (step < 0 && audio.volume > targetVolume)
    ) {
      requestAnimationFrame(fade);
    } else {
      audio.volume = targetVolume;
    }
  };
  fade();
}

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

run(update);

const canRotationSpring = new Spring({
  position: 0,
  frequency: 2,
  halfLife: 0.1,
});

const canYSpring = new Spring({
  position: 0,
  frequency: 2,
  halfLife: 0.1,
});

const flowerScaleSpring = new Spring({
  position: 0,
  target: 0,
  frequency: 1.2,
  halfLife: 0.2,
});

const flowerHeightSpring = new Spring({
  position: 0,
  target: 0,
  frequency: 0.8,
  halfLife: 0.3,
});

let transitionOpacity = 0;
const TRANSITION_DURATION = 2;

const State = {
  WaitingForInput: "waitingForInput",
  Dragging: "dragging",
  Watering: "watering",
  Growing: "growing",
  Finished: "finished",
  Transition: "transition",
};

let currentState = State.WaitingForInput;
let waterLevel = 0;
let wateringTimer = 0;
const WATERING_DURATION = 50;

const soilRect = {
  x: canvas.width / 2 - 500,
  y: canvas.height * 0.75,
  width: 1000,
  height: 30,
};

let canX = canvas.width * 0.8;
let canY = canvas.height * 0.4;
let dragOffsetX = 0;
let dragOffsetY = 0;

let waterDrops = [];
let hasWaterTouchedSoil = false;
let isCurrentlyWatering = false;

const dotPositions = [
  { x: 35.04, y: 60.81 },
  { x: 64.3, y: 46.2 },
  { x: 100.84, y: 54.62 },
  { x: 29.98, y: 108.07 },
  { x: 68.79, y: 114.23 },
  { x: 99.74, y: 86.67 },
  { x: 46.29, y: 82.75 },
  { x: 75.55, y: 70.37 },
  { x: 68.23, y: 90.63 },
];

let dropTimers = new Array(9).fill(0);
const DROP_INTERVAL = 0.15;

const flowerSVG = new Path2D(
  "M30.16,573.9c8.39-34.8,11.69-64.14,13.05-85.77,2.78-44.37-3.01-49.97-6.52-51.52-7.49-3.3-20.68,4.68-23.97,15.07-4.68,14.74,11.02,32.91,23.31,33.01,7.27.06,12.1-6.23,40.43-48.83,18.69-28.11,22.16-33.76,31.3-38.72,19.77-10.74,46.42-7.6,47.82-1.92,1.13,4.6-13.16,15.45-25.13,12.59-9.85-2.35-18.96-14.19-17.66-23.96,3.99-30.12,59.36,5.05,94.7.8,27.72-3.33,65.68-24.02,78.07-37.28,18.59-19.91,26.74-68.11,14.73-74.79-8.44-4.7-25.91,4.6-29.28,16.41-4.83,16.92,29.05,48.91,50.77,49.96,24.43,1.18,19.58-55.81,52.46-60.52,23.62-3.38,50.3,7.89,51.31,18.35.52,5.32-5.51,11.38-11.6,12.62-15.15,3.08-40.14-21.85-38.09-42.21,2.93-29.14,59.57-32.43,63.64-64.89,2.21-17.61-13.66-23.03-10.57-42.45,4.2-26.37,38.55-48.48,51.56-41.37,6.68,3.65,9.22,15.82,5.21,23.39-7.61,14.32-40.64,15.75-63.49,4.56-8.11-3.97-10.45-7.34-50.77-80.57-8.7-15.8-17.36-32.07-11.83-48.45,1.63-4.84,5.68-13.19,9.88-12.89,6.98.5,15.79,25.01,7.98,45.2-.56,1.44-7.95,19.75-25.24,24.84-12.22,3.6-16.97-3.07-30.09-2.14-25.05,1.78-49.2,29-44.79,41.44,2.64,7.47,16.08,11.01,26.04,7.93,14.55-4.49,21.6-23.05,17.15-33.91-4.64-11.31-21.33-13.18-41.77-15.21-23.7-2.35-52.98-5.25-87.17,9.91-41.14,18.25-61.24,50.18-68.98,62.87,0,0-17.14,28.09-26.67,80.56-.17.96-.69,3.81-.48,3.86.24.06,1.32-3.65,1.67-4.86,3.47-11.91,18.93-65.02,1.63-76.38-7.66-5.03-22.59-2.42-28.45,6.06-13.39,19.38,23.22,65.47,18.98,68.32-2.98,2-15.83-24.25-38.46-27.58-22.05-3.25-47.91,16.08-46.27,28.38,1.22,9.13,17.51,13.9,21.42,15.04,31.52,9.23,61.81-10.12,63.39-7,2,3.97-52.55,23.57-59.34,60.99-1.74,9.58-.81,22.86,5.62,26.01,8.57,4.19,25.08-10.55,34.54-22.94,21.69-28.4,23.13-66.45,25.26-66.06.35.06.42,1.13.43,1.26.19,2.93,2.24,34.02,8.15,47.35,4.46,10.06,15.98,20.97,28.67,19.85,9.69-.86,19.17-8.66,21.19-17.96,3.41-15.74-15.87-29.73-20.93-33.4-15.73-11.41-31.22-11.66-30.91-14.9.37-3.85,22.43-5.83,34.14-6.89,16.44-1.48,21.96-.72,23.95-4.49,3.3-6.24-6.72-18.05-14.16-23.91-4.97-3.91-11.3-8.9-17.26-7.09-5.48,1.67-6.19,7.74-14.78,20.23-3.58,5.2-13.12,15.43-15.37,17.97"
);

function isOverSoil(x, y) {
  return (
    x > soilRect.x &&
    x < soilRect.x + soilRect.width &&
    y < soilRect.y + soilRect.height
  );
}

function drawFlowerSVG(x, y, growthProgress) {
  ctx.save();
  ctx.translate(x, y);
  const svgWidth = 483.12;
  const svgHeight = 570.88;
  const targetHeight = 200;
  const scale = (targetHeight / svgHeight) * 5;
  ctx.scale(scale, scale);
  ctx.translate(-svgWidth / 2, -svgHeight);
  const pathLength = 10000;
  const dashOffset = pathLength * (1 - growthProgress);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([pathLength]);
  ctx.lineDashOffset = dashOffset;
  ctx.stroke(flowerSVG);
  ctx.restore();
}

function drawWateringCan(x, y, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const canPath = new Path2D(
    "M173.96,214.34c-25.27-32.16-50.54-64.32-75.81-96.48-1.05-1.35-3.53-1.51-4.9-.62-16.63,10.63-38.13,23.41-58.56,16.6-16.15-5.38-24.03-22.26-26.02-38.08C4.02,58.77,26.22,15.49,65.13,8.74c18.06-3.15,36.73,3.36,47.01,18.92,4.71,7.13,7.51,15.53,7.21,24.11-.32,9.77-6.92,18.27-5.27,28.2.83,5.06,3.42,9.63,5.95,13.99,3.15,5.41,6.3,10.79,9.45,16.2,6.19,10.6,12.38,21.21,18.57,31.81,6.19,10.6,12.38,21.21,18.57,31.81,3.15,5.41,6.3,10.79,9.45,16.2,2.77,4.74,5.27,9.8,8.69,14.1,6.89,8.69,18.38,8.37,28.47,9.47,12,1.32,23.95,2.85,35.9,4.6,23.71,3.5,47.34,7.8,70.75,12.92,5.97,1.29,11.92,2.66,17.84,4.06l-2.96-3.9c.3,49.14.59,98.28.89,147.39.08,13.86.16,27.69.24,41.55l2.96-3.9c-50.78,6.86-102.07,9.98-153.31,9.47l3.9,2.96c-5.79-32.05-11.11-64.21-15.9-96.42-2.4-16.09-4.66-32.19-6.81-48.31-1-7.43-1.83-14.88-2.93-22.31-.83-5.62-2.02-11.2-2.37-16.87-.32-5.33.19-10.63,3.28-15.12,2.48-3.61,6.27-6.32,9.2-9.61,3.44-3.88-2.23-9.61-5.71-5.71-2.64,2.96-5.76,5.38-8.29,8.4-3.63,4.25-5.73,9.26-6.38,14.77s.08,10.87.89,16.25c1.02,6.78,2.1,13.51,2.96,20.32,4.33,33.56,9.2,67.01,14.61,100.41,3.04,18.81,6.27,37.59,9.66,56.35.32,1.72,2.23,2.96,3.9,2.96,51.99.51,103.93-2.8,155.44-9.74,1.72-.24,2.96-2.29,2.96-3.9-.30-49.14-.59-98.28-.89-147.39-.08-13.86-.16-27.69-.24-41.55,0-1.72-1.24-3.5-2.96-3.9-24.6-5.81-49.41-10.76-74.38-14.77-12.62-2.05-25.27-3.82-37.97-5.41-6.27-.78-12.54-1.51-18.84-2.18-5.17-.54-11.63-.43-15.80-3.98s-6.51-9.42-9.15-13.94c-3.26-5.6-6.51-11.17-9.80-16.77-6.51-11.17-13.05-22.36-19.56-33.53-6.51-11.17-13.05-22.36-19.56-33.53-3.18-5.41-6.46-10.79-9.47-16.28-2.85-5.22-4.31-10.06-2.53-15.90,1.48-4.87,3.53-9.42,4.23-14.51.65-4.68.51-9.34-.30-13.99-1.53-8.93-5.81-17.3-11.6-24.22C102.38,2.98,82.19-2.4,62.98.96,21.99,8.15-2.44,52.36.19,91.65c1.16,17.2,7.62,35.23,22.47,45.21,18.68,12.54,41.82,5.68,60.07-4.01,5.01-2.66,9.82-5.6,14.59-8.64l-4.9-.62c25.27,32.16,50.54,64.32,75.81,96.48,3.2,4.09,8.88-1.67,5.71-5.71l.03-.03Z"
  );
  const handlePath = new Path2D(
    "M217.13,205.76c-.91-51.8,14.94-103.9,45.29-146.02,6.35-8.83,14.85-18.17,26.45-18.89,10.74-.65,20.75,5.11,27.8,12.84,17.68,19.24,13.43,49.11,11.25,72.85-3.09,33.42-6.16,66.85-9.26,100.24-.48,5.17,7.59,5.14,8.07,0,2.93-31.86,5.89-63.73,8.83-95.62,2.4-26.05,7.08-57.08-10.04-79.41-6.89-8.99-16.98-16.39-28.31-18.41-12.27-2.18-23.49,2.31-32.29,10.90-9.31,9.10-16.42,20.99-22.82,32.24-6.89,12.06-12.73,24.73-17.55,37.76-10.79,29.20-16.07,60.39-15.53,91.50.08,5.19,8.15,5.19,8.07,0h0l.03.03Z"
  );
  const dotsPath = [
    "M35.04,60.81c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
    "M64.3,46.2c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
    "M100.84,54.62c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
    "M29.98,108.07c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
    "M68.79,114.23c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
    "M99.74,86.67c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
    "M46.29,82.75c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
    "M75.55,70.37c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
    "M68.23,90.63c5.19,0,5.19-8.07,0-8.07s-5.19,8.07,0,8.07h0Z",
  ];

  ctx.fillStyle = "white";
  ctx.scale(0.8, 0.8);
  ctx.translate(-171.98, -216.94);
  ctx.fill(canPath);
  ctx.fill(handlePath);
  dotsPath.forEach((d) => {
    const path = new Path2D(d);
    ctx.fill(path);
  });

  ctx.restore();
}

let growthDelayTimer = 0;
const MAX_GROWTH_HEIGHT = 0.32;

let fadeInOpacity = 1;
let fadeOutOpacity = 0;
const FADE_DURATION = 0.1;

function update(dt) {
  let nextState = undefined;

  if (fadeInOpacity > 0) {
    fadeInOpacity -= dt / FADE_DURATION;
    fadeInOpacity = Math.max(fadeInOpacity, 0);
  }

  const mx = input.getX();
  const my = input.getY();

  const canWidth = 171.98 * 2;
  const canHeight = 216.94 * 2;
  const canLeft = canX - canWidth / 2;
  const canRight = canX + canWidth / 2;
  const canTop = canY - canHeight / 2;
  const canBottom = canY + canHeight / 2;

  const isOverCan =
    mx >= canLeft && mx <= canRight && my >= canTop && my <= canBottom;

  if (currentState === State.Dragging) {
    canvas.style.cursor = "grabbing";
  } else if (isOverCan) {
    canvas.style.cursor = "grab";
  } else {
    canvas.style.cursor = "default";
  }

  switch (currentState) {
    case State.WaitingForInput: {
      if (input.hasStarted()) {
        const mx = input.getX();
        const my = input.getY();
        if (isOverCan) {
          dragOffsetX = canX - mx;
          dragOffsetY = canY - my;
          nextState = State.Dragging;
        }
      }
      break;
    }

    case State.Dragging: {
      if (input.isPressed()) {
        canX = input.getX() + dragOffsetX;
        canY = input.getY() + dragOffsetY;

        if (isOverSoil(canX, canY + 20)) {
          canRotationSpring.target = -45;
          isCurrentlyWatering = true;

          growthDelayTimer += dt;

          dotPositions.forEach((dot, index) => {
            dropTimers[index] += dt;

            if (dropTimers[index] >= DROP_INTERVAL) {
              dropTimers[index] = 0;

              const angle = math.toRadian(canRotationSpring.position);
              const scale = 0.8;
              const offsetX = (dot.x - 171.98) * scale;
              const offsetY = (dot.y - 216.94) * scale;

              const rotatedX =
                offsetX * Math.cos(angle) - offsetY * Math.sin(angle);
              const rotatedY =
                offsetX * Math.sin(angle) + offsetY * Math.cos(angle);

              waterDrops.push({
                x: canX + rotatedX,
                y: canY + rotatedY,
                vx: Math.random() * 20 - 10,
                vy: 150 + Math.random() * 30,
                life: 1,
                size: 3 + Math.random() * 2,
              });
            }
          });

          wateringTimer += dt;
          waterLevel = Math.min(1, wateringTimer / WATERING_DURATION);
        } else {
          canRotationSpring.target = 0;
          dropTimers.fill(0);
          growthDelayTimer = 0;
          isCurrentlyWatering = false;
        }
      } else {
        canRotationSpring.target = 0;
        dropTimers.fill(0);
        isCurrentlyWatering = false;
        hasWaterTouchedSoil = false;

        if (flowerHeightSpring.position >= MAX_GROWTH_HEIGHT * 0.98) {
          nextState = State.Finished;
        } else {
          nextState = State.WaitingForInput;
        }
      }
      break;
    }

    case State.Watering: {
      nextState = State.Finished;
      break;
    }

    case State.Growing: {
      nextState = State.Finished;
      break;
    }

    case State.Finished: {
      fadeOutOpacity += dt / FADE_DURATION;
      fadeOutOpacity = Math.min(fadeOutOpacity, 1);

      if (fadeOutOpacity >= 0.99) {
        nextState = State.Transition;
      }
      break;
    }

    case State.Transition: {
      transitionOpacity += (100 / (TRANSITION_DURATION * 60)) * dt;
      if (transitionOpacity >= 2) {
        transitionOpacity = 100;
        finish();
      }
      break;
    }
  }

  if (nextState !== undefined) {
    currentState = nextState;
  }

  canRotationSpring.step(dt);
  canYSpring.step(dt);
  flowerScaleSpring.step(dt);
  flowerHeightSpring.step(dt);

  waterDrops = waterDrops.filter((drop) => {
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    drop.vy += 1000 * dt;
    drop.life -= dt * 0.1;

    if (
      drop.y >= soilRect.y &&
      drop.y <= soilRect.y + soilRect.height &&
      drop.x >= soilRect.x &&
      drop.x <= soilRect.x + soilRect.width
    ) {
      if (isCurrentlyWatering) {
        hasWaterTouchedSoil = true;
        if (waterSound.paused) {
          fadeAudio(waterSound, 1, 0.5);
          waterSound.play();
        }
      }
      return false;
    }

    return drop.life > 0 && drop.y < soilRect.y + soilRect.height;
  });

  if (hasWaterTouchedSoil && isCurrentlyWatering) {
    flowerHeightSpring.target = Math.min(waterLevel, MAX_GROWTH_HEIGHT);
  }

  if (isCurrentlyWatering && hasWaterTouchedSoil) {
    if (waterSound.paused) {
      waterSound.currentTime = 20;
      waterSound.play();
      fadeAudio(waterSound, 1, 0.1);
    }
  } else if (!isCurrentlyWatering || !hasWaterTouchedSoil) {
    waterSound.pause();
    waterSound.currentTime = 20;
  }

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.fillRect(soilRect.x, soilRect.y, soilRect.width, soilRect.height);

  drawFlowerSVG(canvas.width / 2, soilRect.y + 10, flowerHeightSpring.position);

  ctx.fillStyle = "white";
  waterDrops.forEach((drop) => {
    ctx.globalAlpha = drop.life;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  drawWateringCan(
    canX,
    canY + canYSpring.position,
    math.toRadian(canRotationSpring.position)
  );

  ctx.fillStyle = `rgba(0, 0, 0, ${fadeInOpacity + fadeOutOpacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
