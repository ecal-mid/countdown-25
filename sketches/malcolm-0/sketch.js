import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";
import FallingObject, {
  updateSharedPhysics,
  initSvgCollision,
  hasReachedTargetBodies,
  updateMousePosition,
} from "./fallingObjects.js";
import { onSvgLoad } from "./svg.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// SVG collision settings
const imgGlobalSize = canvas.height * 0.8;
const svgScale = 1;

// Initialize SVG collision after SVGs are loaded
onSvgLoad(() => {
  initSvgCollision(ctx, imgGlobalSize, svgScale);
  //console.log("SVG collision initialized");
});

const objects = [];

// Spawn objects on interval when activated
let spawnInterval = null;
const SPAWN_DELAY = 10; // milliseconds between spawns

function startSpawning() {
  if (spawnInterval) return; // Already spawning
  spawnInterval = setInterval(() => {
    const x = Math.random() * canvas.width; // Spawn within a range
    const y = Math.random() * -20; // Spawn above the canvas
    const size = ctx.canvas.width * 0.02;
    objects.push(new FallingObject(ctx, x, y, size, rollNumberChoice()));
  }, SPAWN_DELAY);
}

function stopSpawning() {
  if (spawnInterval) {
    clearInterval(spawnInterval);
    spawnInterval = null;
  }
}

run(update);

// Lever moving with crossfade loop and velocity-based volume
const leverMoving1 = new Audio("./assets/AUDIO/lever-moving.wav");
const leverMoving2 = new Audio("./assets/AUDIO/lever-moving.wav");
const leverMovingMaxVolume = 1;
leverMoving1.volume = 0;
leverMoving2.volume = 0;

let currentLeverLoop = 1;
let leverLoopInterval = null;
let leverTargetVolume = 0;
let leverCurrentVolume = 0;
const leverOverlapTime = 1000; // Start next loop 500ms before current ends
const leverFadeStep = 16;

// Track lever movement speed
let lastLeverY = 0;
let leverSpeed = 0;

// Track fade progress for each loop
let lever1FadeProgress = 1; // 1 = full volume, 0 = silent
let lever2FadeProgress = 0;
let lever1FadingOut = false;
let lever2FadingOut = false;

function startLeverLoop() {
  if (leverLoopInterval) return;

  currentLeverLoop = 1;
  leverMoving1.currentTime = 0;
  leverMoving1.volume = 0;
  leverMoving1.play();
  lever1FadeProgress = 1;
  lever2FadeProgress = 0;
  lever1FadingOut = false;
  lever2FadingOut = false;

  leverLoopInterval = setInterval(() => {
    // Smoothly interpolate current volume towards target
    leverCurrentVolume += (leverTargetVolume - leverCurrentVolume) * 0.1;

    // Update fade progress for both loops
    const fadeSpeed = 0.02; // How fast to fade in/out

    if (lever1FadingOut) {
      lever1FadeProgress = Math.max(0, lever1FadeProgress - fadeSpeed);
    } else if (lever1FadeProgress < 1 && !lever2FadingOut) {
      lever1FadeProgress = Math.min(1, lever1FadeProgress + fadeSpeed);
    }

    if (lever2FadingOut) {
      lever2FadeProgress = Math.max(0, lever2FadeProgress - fadeSpeed);
    } else if (lever2FadeProgress < 1 && !lever1FadingOut) {
      lever2FadeProgress = Math.min(1, lever2FadeProgress + fadeSpeed);
    }

    // Apply volumes using equal-power curve
    const vol1 =
      leverCurrentVolume * Math.sin((lever1FadeProgress * Math.PI) / 2);
    const vol2 =
      leverCurrentVolume * Math.sin((lever2FadeProgress * Math.PI) / 2);
    leverMoving1.volume = vol1;
    leverMoving2.volume = vol2;

    // Check if loop1 needs to trigger loop2
    if (
      !leverMoving1.paused &&
      leverMoving1.duration &&
      leverMoving1.currentTime >=
        leverMoving1.duration - leverOverlapTime / 1000 &&
      !lever1FadingOut
    ) {
      lever1FadingOut = true;
      lever2FadingOut = false;
      lever2FadeProgress = 0;
      leverMoving2.currentTime = 0;
      leverMoving2.play();
    }

    // Check if loop2 needs to trigger loop1
    if (
      !leverMoving2.paused &&
      leverMoving2.duration &&
      leverMoving2.currentTime >=
        leverMoving2.duration - leverOverlapTime / 1000 &&
      !lever2FadingOut
    ) {
      lever2FadingOut = true;
      lever1FadingOut = false;
      lever1FadeProgress = 0;
      leverMoving1.currentTime = 0;
      leverMoving1.play();
    }

    // Reset loops when they finish fading out
    if (lever1FadeProgress <= 0 && lever1FadingOut) {
      leverMoving1.pause();
      lever1FadingOut = false;
    }
    if (lever2FadeProgress <= 0 && lever2FadingOut) {
      leverMoving2.pause();
      lever2FadingOut = false;
    }
  }, leverFadeStep);
}

function stopLeverLoop() {
  if (leverLoopInterval) {
    clearInterval(leverLoopInterval);
    leverLoopInterval = null;
  }
  leverMoving1.pause();
  leverMoving1.currentTime = 0;
  leverMoving1.volume = 0;
  leverMoving2.pause();
  leverMoving2.currentTime = 0;
  leverMoving2.volume = 0;
  leverCurrentVolume = 0;
  leverTargetVolume = 0;
  lever1FadeProgress = 1;
  lever2FadeProgress = 0;
  lever1FadingOut = false;
  lever2FadingOut = false;
}

function updateLeverVolume(currentLeverPosY) {
  // Calculate lever movement speed
  leverSpeed = Math.abs(currentLeverPosY - lastLeverY);
  lastLeverY = currentLeverPosY;

  // Map speed to volume (0 to maxVolume)
  leverTargetVolume = Math.min(leverSpeed / 8, leverMovingMaxVolume);

  // If not moving, fade to 0
  if (leverSpeed < 0.1) {
    leverTargetVolume = 0;
  }
}

const leverStopSFX = new Audio("./assets/AUDIO/lever-click.wav");
leverStopSFX.volume = 0.3;

// Machine running with crossfade loop
const machineRunning1 = new Audio("./assets/AUDIO/machine_running.wav");
const machineRunning2 = new Audio("./assets/AUDIO/machine_running.wav");
const machineTargetVolume = 0.5;
machineRunning1.volume = 0;
machineRunning2.volume = 0;

let currentMachineLoop = 1;
let machineLoopInterval = null;
let isMachineCrossfading = false;
const machineOverlapTime = 400; // Start next loop 400ms before current ends
const machineFadeDuration = 350; // Fade duration
const machineFadeStep = 16;

function startMachineLoop() {
  if (machineLoopInterval) return; // Already running

  currentMachineLoop = 1;
  machineRunning1.currentTime = 0;
  machineRunning1.volume = machineTargetVolume;
  machineRunning1.play();

  machineLoopInterval = setInterval(() => {
    if (isMachineCrossfading) return;

    const activeLoop =
      currentMachineLoop === 1 ? machineRunning1 : machineRunning2;
    const nextLoop =
      currentMachineLoop === 1 ? machineRunning2 : machineRunning1;

    if (
      activeLoop.duration &&
      activeLoop.currentTime >= activeLoop.duration - machineOverlapTime / 1000
    ) {
      isMachineCrossfading = true;
      currentMachineLoop = currentMachineLoop === 1 ? 2 : 1;

      nextLoop.currentTime = 0;
      nextLoop.volume = 0;
      nextLoop.play();

      const steps = machineFadeDuration / machineFadeStep;
      let currentStep = 0;
      const fromStartVolume = activeLoop.volume;

      const crossInt = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        // Equal-power crossfade
        const fadeOutVolume = Math.cos((progress * Math.PI) / 2);
        const fadeInVolume = Math.sin((progress * Math.PI) / 2);
        activeLoop.volume = fromStartVolume * fadeOutVolume;
        nextLoop.volume = machineTargetVolume * fadeInVolume;

        if (currentStep >= steps) {
          clearInterval(crossInt);
          activeLoop.pause();
          activeLoop.currentTime = 0;
          nextLoop.volume = machineTargetVolume;
          isMachineCrossfading = false;
        }
      }, machineFadeStep);
    }
  }, 20);
}

function stopMachineLoop() {
  if (machineLoopInterval) {
    clearInterval(machineLoopInterval);
    machineLoopInterval = null;
  }
  isMachineCrossfading = false;

  // Fade out whichever is playing
  const fadeOutAudio = !machineRunning1.paused
    ? machineRunning1
    : machineRunning2;
  if (!fadeOutAudio.paused) {
    const steps = 150 / machineFadeStep;
    let currentStep = 0;
    const startVol = fadeOutAudio.volume;

    const fadeInt = setInterval(() => {
      currentStep++;
      fadeOutAudio.volume = Math.max(startVol * (1 - currentStep / steps), 0);
      if (currentStep >= steps) {
        clearInterval(fadeInt);
        machineRunning1.pause();
        machineRunning1.currentTime = 0;
        machineRunning1.volume = 0;
        machineRunning2.pause();
        machineRunning2.currentTime = 0;
        machineRunning2.volume = 0;
      }
    }, machineFadeStep);
  }
}

const openingSFX = new Audio("./assets/AUDIO/open.wav");
openingSFX.volume = 0.5;

const containerFullSFX = new Audio("./assets/AUDIO/container-full.wav");
containerFullSFX.volume = 0.5;
let hasPlayedContainerFullSound = false;

const leverGoingDownSFX = new Audio("./assets/AUDIO/lever-going-down.wav");
leverGoingDownSFX.volume = 0.3;
leverGoingDownSFX.loop = true;

const containerGoingDownSFX = new Audio(
  "./assets/AUDIO/container-going-down.wav"
);
containerGoingDownSFX.volume = 0.3;
containerGoingDownSFX.loop = true;

// Track previous positions for sound
let lastPosY = 0;
let lastContainerPosY = -imgGlobalSize;

function update(dt) {
  let bgColor = "black";

  if (activated) {
    startSpawning();
  } else {
    stopSpawning();
  }

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  createContainer();

  // Update mouse position for collision
  updateMousePosition(input.getX(), input.getY());

  // Update physics for all objects
  updateSharedPhysics();

  console.log("Total objects:", objects.length);

  objects.forEach((obj) => {
    obj.update();
    if (obj.body.positionY - obj.size > canvas.height) {
      objects.splice(objects.indexOf(obj), 1);
    }
  });

  createLever();
}

let leverPosX = 0;
let leverPosY = -250;
let lastLeverPosY = leverPosY; // Track previous lever position
let circleSize = canvas.width * 0.01;

let isPullable = false;
let wasAtLimit = false; // Track if lever was at a limit position

let activated = false;
let isSvgDeleteMode = false;
let posY = 0;

const boxImg = new Image();
boxImg.src = "./assets/PNG/box.png";

const boxImg2 = new Image();
boxImg2.src = "./assets/PNG/box2.png";

const connectionImg = new Image();
connectionImg.src = "./assets/PNG/connection.png";

const leverImg = new Image();
leverImg.src = "./assets/PNG/lever.png";

function createLever() {
  const padding = 20;

  const leverLength = canvas.width * 0.2;
  const leverWidth = leverLength / 2;
  const posX = canvas.width * 0.08;
  const STOREDPosY = canvas.height * 0.25 + leverLength / 2;

  // Only clamp posY if not in exit animation (delete mode with no objects)
  const isExiting = isSvgDeleteMode && objects.length === 0;
  if (!isExiting) {
    if (posY < STOREDPosY) {
      posY += 5;
    } else {
      posY = STOREDPosY;
    }
  }

  // Lever going down sound (at beginning entry or end exit)
  const isLeverMovingDown = posY !== lastPosY;
  if (isLeverMovingDown) {
    if (leverGoingDownSFX.paused) {
      leverGoingDownSFX.play();
    }
  } else {
    if (!leverGoingDownSFX.paused) {
      leverGoingDownSFX.pause();
      leverGoingDownSFX.currentTime = 0;
    }
  }
  lastPosY = posY;

  /*
  const plateRectangle = new Image();
  plateRectangle.src = "./assets/PNG/plate-rectangle.png";
*/
  //INTERACTION PART

  let isHovering = false;
  if (
    input.getX() > posX + leverPosX - circleSize &&
    input.getX() < posX + leverPosX + circleSize &&
    input.getY() > posY + leverPosY - circleSize &&
    input.getY() < posY + leverPosY + circleSize
  ) {
    isHovering = true;
    document.body.style.cursor = "grab";
  } else {
    document.body.style.cursor = "default";
  }
  let isInsideConstraint = false;
  const minConstraintY = posY - leverLength + circleSize / 2 + padding;
  const maxConstraintY = posY - circleSize / 2 - padding;
  if (input.getY() >= minConstraintY && input.getY() <= maxConstraintY) {
    isInsideConstraint = true;
  }
  const detectionZoneMinY = posY - leverLength / 3;
  if (leverPosY + posY > detectionZoneMinY) {
    //console.log("activating lever");
    if (!isSvgDeleteMode) {
      activated = true;
    }
  } else {
    activated = false;
  }

  if (input.isPressed()) {
    document.body.style.cursor = "grabbing";

    if (isHovering && isInsideConstraint) {
      isPullable = true;
    }
    if (isPullable && isInsideConstraint) {
      leverPosY = input.getY() - posY;
    }
  } else {
    if (leverPosY > -leverLength + circleSize + padding) {
      leverPosY -= 5;
    }
  }
  if (input.isUp()) {
    isPullable = false;
    document.body.style.cursor = "default";
  }

  // Play sound once when container is full
  if (hasReachedTargetBodies() && !hasPlayedContainerFullSound) {
    containerFullSFX.currentTime = 0;
    containerFullSFX.play();
    hasPlayedContainerFullSound = true;
  }

  if (
    leverPosY < -leverLength + circleSize + padding * 3 &&
    hasReachedTargetBodies()
  ) {
    isSvgDeleteMode = true;
    activated = false;
  }

  if (isSvgDeleteMode && leverPosY + posY > detectionZoneMinY) {
    containerRotation += 0.02;
    if (containerRotation > Math.PI / 6) {
      containerRotation = Math.PI / 6;
    }
    objects.forEach((obj) => {
      // delete collision with svg
      obj.disableSvgCollision();
    });
  }
  if (isSvgDeleteMode) {
    if (objects.length === 0) {
      posY += 5;
      containerPosY += 5;
      if (
        posY > canvas.height + leverLength &&
        containerPosY > canvas.height + imgGlobalSize
      ) {
        finish();
      }
    }
  }

  //DRAWING PART
  ctx.fillStyle = "gray";
  ctx.save();
  ctx.translate(posX, posY);
  // create lever rectangle
  ctx.fillStyle = "gray";
  const currentBoxImg = isSvgDeleteMode ? boxImg2 : boxImg;
  ctx.drawImage(
    currentBoxImg,
    -leverWidth / 2,
    -leverLength,
    leverWidth,
    leverLength
  );
  //ctx.fillRect(-leverWidth / 2, -leverLength, leverWidth, leverLength);

  ctx.fillStyle = "darkgray";

  const rectCenterY = -leverLength / 2;
  let ConnectionHeight = leverPosY - rectCenterY;
  //console.log("ConnectionHeight:", ConnectionHeight);
  //create connection between box and circle
  ctx.drawImage(
    connectionImg,
    -circleSize / 2,
    rectCenterY,
    circleSize,
    ConnectionHeight
  );
  //
  //ctx.fillRect(-circleSize / 4, rectCenterY, circleSize / 2, ConnectionHeight);

  ctx.drawImage(
    leverImg,
    leverPosX - circleSize,
    leverPosY - circleSize,
    circleSize * 2,
    circleSize * 2
  );
  ctx.restore();

  // AUDIO PART
  const leverMinY = -leverLength + circleSize + padding; // Top limit
  const leverMaxY = -circleSize - padding * 2; // Bottom limit

  //console.log("leverPosY:", leverPosY, "MinY:", leverMinY, "MaxY:", leverMaxY);

  const isAtLimit = leverPosY <= leverMinY || leverPosY >= leverMaxY;

  // Lever moving sound - continuous loop with velocity-based volume
  if (isPullable) {
    // Start the loop if not already running
    if (!leverLoopInterval) {
      startLeverLoop();
    }
    // Update volume based on lever movement speed
    updateLeverVolume(leverPosY);
  } else {
    // When not pulling, fade volume to 0
    if (leverLoopInterval) {
      leverTargetVolume = 0;
      // Stop loop completely when volume is very low
      if (leverCurrentVolume < 0.01) {
        stopLeverLoop();
      }
    }
  }
  lastLeverPosY = leverPosY;

  // Only play sound when just reaching a limit (not while staying there)
  if (isAtLimit && !wasAtLimit) {
    leverStopSFX.currentTime = 0;
    leverStopSFX.play();
  }
  wasAtLimit = isAtLimit;

  if (activated) {
    if (!machineLoopInterval) {
      startMachineLoop();
    }
  } else {
    if (machineLoopInterval) {
      stopMachineLoop();
    }
  }
}

function rollNumberChoice() {
  const randomNum = Math.floor(Math.random() * 3);
  if (randomNum === 0 || randomNum === 1) {
    return true;
  } else {
    return false;
  }
}

let containerRotation = 0;
let lastContainerRotation = containerRotation;
let containerPosX = canvas.width / 2;
let containerTargetY = canvas.height / 2; // Final position
let containerPosY = -imgGlobalSize; // Start above canvas

const containerImgLeft = new Image();
containerImgLeft.src = "./assets/PNG/container-left.png";

const containerImgRight = new Image();
containerImgRight.src = "./assets/PNG/container-right.png";

function createContainer() {
  let containerWidth = imgGlobalSize / 2;
  let containerHeight = imgGlobalSize;
  const marginWidth = 0;
  const marginHeight = 50;

  // Animate container from top to target position (unless exiting)
  const isExiting = isSvgDeleteMode && objects.length === 0;
  if (!isExiting) {
    if (containerPosY < containerTargetY) {
      containerPosY += 5;
    } else {
      containerPosY = containerTargetY;
    }
  }

  // Container going down sound (at beginning entry or end exit)
  const isContainerMovingDown = containerPosY !== lastContainerPosY;
  if (isContainerMovingDown) {
    if (containerGoingDownSFX.paused) {
      containerGoingDownSFX.play();
    }
  } else {
    if (!containerGoingDownSFX.paused) {
      containerGoingDownSFX.pause();
      containerGoingDownSFX.currentTime = 0;
    }
  }
  lastContainerPosY = containerPosY;

  let containerRotationInv = -containerRotation;

  ctx.save();
  ctx.translate(
    containerPosX - marginWidth,
    containerPosY - containerHeight / 2 + marginHeight
  );

  ctx.rotate(containerRotation);
  ctx.drawImage(
    containerImgLeft,
    -containerWidth,
    0,
    containerWidth,
    containerHeight
  );
  //ctx.fillRect(-containerWidth, 0, containerWidth, containerHeight);
  ctx.restore();

  ctx.save();
  ctx.translate(
    containerPosX + marginWidth,
    containerPosY - containerHeight / 2 + marginHeight
  );

  ctx.rotate(containerRotationInv);
  ctx.drawImage(containerImgRight, 0, 0, containerWidth, containerHeight);
  //ctx.fillRect(0, 0, containerWidth, containerHeight);
  ctx.restore();
  //containerRotation += 0.01;

  //AUDIO for container opening when rotating
  if (containerRotation !== lastContainerRotation) {
    if (containerRotation > 0 && openingSFX.paused) {
      openingSFX.play();
    }
    lastContainerRotation = containerRotation;
  }
}
