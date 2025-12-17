import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";
import Leaves from "./leaves.js";
import { d } from "./svg.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

run(update);

const ySpring = new Spring({
  position: -canvas.height,
  target: 0,
  frequency: 1.5,
  halfLife: 0.05,
});
const scaleSpring = new Spring({
  position: 1,
  frequency: 1.5,
  halfLife: 0.1,
});
const rotationSpring = new Spring({
  position: 180,
  frequency: 0.5,
  halfLife: 0.805,
  wrap: 360,
});

let fallPos = 0;
let fallVel = 0;
const numberLeaves = 1200;
let leaves = [];
let randomNumbers = [];
let leavesInitialized = false;
let shouldStartFalling = false;

// Generate random positions once
for (let i = 0; i < numberLeaves; i++) {
  randomNumbers.push({
    posX: Math.random() * canvas.width,
    posY: Math.random() * canvas.height,
  });
}

// Preload leaf sound (shared by all leaves)
const preloadedLeafSound = new Audio("./assets/AUDIO/leaf-rustle.wav");
preloadedLeafSound.volume = 1;

const State = {
  WaitingForInput: "waitingForInput",
  Interactive: "interactive",
  Falling: "falling",
  Finished: "finished",
};
let currentState = State.WaitingForInput;
let startInputX = 0;
function update(dt) {
  const x = canvas.width / 2;
  const y = canvas.height / 2 + fallPos;
  const rot = rotationSpring.position;
  const scale = scaleSpring.position;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  playLeafBlowSound();

  // Create leaves only once
  if (!leavesInitialized) {
    for (let i = 0; i < randomNumbers.length; i++) {
      const { posX, posY } = randomNumbers[i];
      leaves.push(new Leaves(ctx, input, posX, posY, preloadedLeafSound));
    }
    leavesInitialized = true;
  }
  // Update and draw all leaves
  let anyLeafMoving = false;
  let totalSpeed = 0;
  let movingCount = 0;
  for (let i = 0; i < leaves.length; i++) {
    leaves[i].update();
    leaves[i].draw();
    if (leaves[i].isMoving()) {
      anyLeafMoving = true;
      totalSpeed += leaves[i].getSpeed();
      movingCount++;
    }
  }

  // Control leaf rustle sound globally with volume based on speed
  if (anyLeafMoving) {
    const avgSpeed = totalSpeed / movingCount;
    // Map average speed (0-20) to volume (0.05-0.5)
    const volume = Math.min(0.05 + (avgSpeed / 20) * 0.45, 0.5);
    preloadedLeafSound.volume = volume;

    if (preloadedLeafSound.paused) {
      preloadedLeafSound.loop = true;
      preloadedLeafSound.play();
    }
  } else if (!preloadedLeafSound.paused) {
    preloadedLeafSound.pause();
    preloadedLeafSound.currentTime = 0;
  }
  //if all of my leaves have their isInsideArea to true, I can finish the sequence
  const allLeavesInside = leaves.every((leaf) => leaf.isInsideArea);
  if (allLeavesInside && currentState !== State.Finished) {
    currentState = State.Finished;
    shouldStartFalling = true;

    console.log("All leaves are inside the SVG area. Finishing sequence.");
    // You can add any additional logic here for when the sequence finishes
  }
  if (shouldStartFalling) {
    setTimeout(() => {
      leaves.forEach((leaf) => {
        leaf.falloffOffset();
        if (leaf.posY > canvas.height + leaf.size) {
          leaves.splice(leaves.indexOf(leaf), 1);
          if (leaves.length === 0) {
            finish();
          }
        }
      });
    }, 1000);
  }

  /*


  ctx.fillStyle = "white"
  ctx.textBaseline = "middle"
  ctx.font = `${canvas.height}px Helvetica Neue, Helvetica , bold`
  ctx.textAlign = "center"
  ctx.translate(x, y + ySpring.position)
  ctx.rotate(math.toRadian(rot))
  ctx.scale(scale, scale)
  ctx.fillText("2", 0, 0)
  
*/
}

// Preload audio outside the function
const blowStart = new Audio("./assets/AUDIO/leafblower-start.wav");
const blowLoop1 = new Audio("./assets/AUDIO/leafblower-loop.wav");
const blowLoop2 = new Audio("./assets/AUDIO/leafblower-loop.wav");
const blowEnd = new Audio("./assets/AUDIO/leafblower-end.wav");
const targetVolume = 0.7;
const fadeDuration = 50; // ms for fade transitions
const fadeStep = 16; // ~60fps update interval

blowStart.volume = 0;
blowLoop1.volume = 0;
blowLoop2.volume = 0;
blowEnd.volume = targetVolume;

let isBlowing = false;
let currentLoop = 1; // Track which loop is active (1 or 2)
let loopCheckInterval = null;

function fadeIn(audio, targetVol, duration) {
  const steps = duration / fadeStep;
  const volumeStep = targetVol / steps;
  let currentStep = 0;

  const interval = setInterval(() => {
    currentStep++;
    audio.volume = Math.min(volumeStep * currentStep, targetVol);
    if (currentStep >= steps) {
      clearInterval(interval);
    }
  }, fadeStep);

  return interval;
}

function fadeOut(audio, duration, callback) {
  const steps = duration / fadeStep;
  const startVolume = audio.volume;
  const volumeStep = startVolume / steps;
  let currentStep = 0;

  const interval = setInterval(() => {
    currentStep++;
    audio.volume = Math.max(startVolume - volumeStep * currentStep, 0);
    if (currentStep >= steps) {
      clearInterval(interval);
      if (callback) callback();
    }
  }, fadeStep);

  return interval;
}

function crossFadeLoops(fromLoop, toLoop, duration) {
  const steps = duration / fadeStep;
  const fromStartVolume = fromLoop.volume;
  let currentStep = 0;

  toLoop.currentTime = 0;
  toLoop.volume = 0;
  toLoop.play();

  const interval = setInterval(() => {
    currentStep++;
    const progress = currentStep / steps;
    fromLoop.volume = Math.max(fromStartVolume * (1 - progress), 0);
    toLoop.volume = Math.min(targetVolume * progress, targetVolume);

    if (currentStep >= steps) {
      clearInterval(interval);
      fromLoop.pause();
      fromLoop.currentTime = 0;
    }
  }, fadeStep);
}

const loopOverlapTime = 400; // Start next loop 450ms before current ends
const loopFadeDuration = 200; // Faster fade for loops

function startLoopMonitoring() {
  if (loopCheckInterval) clearInterval(loopCheckInterval);

  loopCheckInterval = setInterval(() => {
    if (!isBlowing) {
      clearInterval(loopCheckInterval);
      loopCheckInterval = null;
      return;
    }

    const activeLoop = currentLoop === 1 ? blowLoop1 : blowLoop2;
    const nextLoop = currentLoop === 1 ? blowLoop2 : blowLoop1;

    if (
      activeLoop.duration &&
      activeLoop.currentTime >= activeLoop.duration - loopOverlapTime / 1000
    ) {
      // Switch to the other loop
      currentLoop = currentLoop === 1 ? 2 : 1;
      crossFadeLoops(activeLoop, nextLoop, loopFadeDuration);
    }
  }, 50);
}

function playLeafBlowSound() {
  // Start blowing
  if (input.isPressed() && !isBlowing) {
    isBlowing = true;
    blowEnd.pause();
    blowEnd.currentTime = 0;
    blowStart.currentTime = 0;
    blowStart.volume = 0;
    blowStart.play();
    fadeIn(blowStart, targetVolume, fadeDuration);

    // Start crossfade to loop earlier (before blowStart ends)
    const overlapTime = 800; // Time before end of blowStart to start loop
    const startToLoopFade = 150; // Faster fade from start to loop
    const checkInterval = setInterval(() => {
      if (
        blowStart.duration &&
        blowStart.currentTime >= blowStart.duration - overlapTime / 1000
      ) {
        clearInterval(checkInterval);
        if (isBlowing) {
          currentLoop = 1;
          blowLoop1.currentTime = 0;
          blowLoop1.volume = 0;
          blowLoop1.play();

          // Crossfade from start to loop1
          const steps = startToLoopFade / fadeStep;
          let currentStep = 0;
          const fromStartVolume = blowStart.volume;

          const crossInt = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            blowStart.volume = Math.max(fromStartVolume * (1 - progress), 0);
            blowLoop1.volume = Math.min(targetVolume * progress, targetVolume);

            if (currentStep >= steps) {
              clearInterval(crossInt);
              blowStart.pause();
              blowStart.currentTime = 0;
              // Start monitoring for loop crossfade
              startLoopMonitoring();
            }
          }, fadeStep);
        }
      }
      if (blowStart.paused || !isBlowing) {
        clearInterval(checkInterval);
      }
    }, 16);
  }

  // Stop blowing
  if (input.isUp() && isBlowing) {
    isBlowing = false;

    // Clear loop monitoring
    if (loopCheckInterval) {
      clearInterval(loopCheckInterval);
      loopCheckInterval = null;
    }

    // Find which audio is playing and fade it out
    const activeAudio = !blowLoop1.paused
      ? blowLoop1
      : !blowLoop2.paused
      ? blowLoop2
      : blowStart;

    fadeOut(activeAudio, fadeDuration, () => {
      blowLoop1.pause();
      blowLoop1.currentTime = 0;
      blowLoop1.volume = 0;
      blowLoop2.pause();
      blowLoop2.currentTime = 0;
      blowLoop2.volume = 0;
      blowStart.pause();
      blowStart.currentTime = 0;
      blowEnd.currentTime = 0;
      blowEnd.volume = targetVolume;
      blowEnd.play();
    });
  }
}
