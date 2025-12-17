import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, math, audio, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Load pickup and put sounds
let pickupSound = null;
let putSound = null;
pickupSound = await audio.load("/sketches/malik-2/paper.wav");
// audio.load("/sketches/malik-2/paper.wav").then((sound) => {
//   pickupSound = sound;
// });
putSound = await audio.load("/sketches/malik-2/put.wav");
// audio.load("/sketches/malik-2/put.wav").then((sound) => {
//   putSound = sound;
// });

let DEBUG = false;
let stencilRatio = 0.5;
let slideInDuration = 2.0; // Duration of slide-in animations in seconds (adjust for speed)
let slideOutDuration = 2.0; // Duration of slide-out animations in seconds
let waitBeforeOutro = 2.0; // Wait time in seconds before sliding out (adjust for speed)
let VISIBILITY_THRESHOLD = 95; // Percentage threshold for successful placement

const State = {
  WaitingForInput: "waitingForInput",
  FirstDesign: "firstDesign",
  SecondDesign: "secondDesign",
  ThirdDesign: "thirdDesign",
  Two: "two",
  Finished: "finished",
};
let currentState = State.WaitingForInput;
let startInputX = 0;
let activeDesign = null; // track which design is currently active
let introProgress = 0;
let introComplete = false;
let outroWaitProgress = 0;
let outroProgress = 0;
let outroStarted = false;
let outroComplete = false;
let backOutroOffset = 0; // Track how much the back has moved during outro
let paperMovingOffScreen = false; // Track when paper should move directly off-screen
let paperOffScreen = false; // Track when paper has moved completely off screen

/* ------------------------------ load SVG --------------------------------*/
const back = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  targetX: 0,
  targetY: 0,
  isAnimating: false,
};

const paper = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  isHovered: false,
  isDragging: false,
  targetX: 0,
  targetY: 0,
  isAnimating: false,
  finalX: 0,
  finalY: 0,
  rect: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  },
};

const two = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  width: 0,
  height: 0,
  opacity: 1,
  onSkin: false,
};

const tattooDesign_01 = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  opacity: 1,
  onSkin: false,
};

loadTattooDesign(tattooDesign_01, "/sketches/malik-2/tattoo-design-01.svg");

const tattooDesign_02 = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  opacity: 1,
  onSkin: false,
};

loadTattooDesign(tattooDesign_02, "/sketches/malik-2/tattoo-design-02.svg");

const tattooDesign_03 = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  opacity: 1,
  onSkin: false,
};

loadTattooDesign(tattooDesign_03, "/sketches/malik-2/tattoo-design-03.svg");

// Array to store all placed designs for each state
let placedDesigns = {
  firstDesign: [],
  secondDesign: [],
  thirdDesign: [],
  two: [],
};

// load back svg
const backSVG = new Image();
backSVG.src = "/sketches/malik-2/back.svg";
back.loaded = false;
backSVG.onload = () => {
  back.loaded = true;
  back.svg = backSVG;
  back.ratio = backSVG.naturalHeight / backSVG.naturalWidth;
  back.height = canvas.height * 1.1;
  back.width = back.height / back.ratio;
  back.targetX = canvas.width / 2 - back.width / 2;
  back.targetY = canvas.height / 2 - back.height / 2;
  // Start off-screen to the left
  back.x = -back.width;
  back.y = back.targetY;
  checkIfReady();
};

//load paper svg
const paperSVG = new Image();
paperSVG.src = "/sketches/malik-2/paper.svg";
paper.loaded = false;
paperSVG.onload = () => {
  paper.loaded = true;
  paper.svg = paperSVG;
  paper.ratio = paperSVG.naturalHeight / paperSVG.naturalWidth;
  paper.height = canvas.height * 0.3;
  paper.width = paper.height / paper.ratio;
  paper.opacity = 0.9;
  console.log("paper loaded:", paper.width, paper.height, paper.x, paper.y);
  paper.targetX = canvas.width * 0.85;
  paper.targetY = canvas.height * 0.33;
  paper.originalX = paper.targetX;
  paper.originalY = paper.targetY;
  paper.finalX = canvas.width + canvas.width * 0.5;
  paper.finalY = paper.targetY;
  // Start off-screen at the bottom
  paper.x = paper.targetX;
  paper.y = canvas.height + 2 * paper.height;
  paper.goToOriginal = false;
  paper.rect = {
    x: paper.x - paper.width / 2,
    y: paper.y - paper.height / 2,
    w: paper.width,
    h: paper.height,
  };
  checkIfReady();
};

//load 2 svg
const twoSVG = new Image();
twoSVG.src = "/sketches/malik-2/2.svg";
two.loaded = false;
twoSVG.onload = () => {
  two.loaded = true;
  two.svg = twoSVG;
  two.ratio = twoSVG.naturalHeight / twoSVG.naturalWidth;
  two.width = twoSVG.width;
  two.height = twoSVG.height;
  two.x = canvas.width / 2;
  two.y = canvas.height / 2;
  two.free = true;
  two.opacitty = 1;
  checkIfReady();
};

function checkIfReady() {
  if (back.loaded && paper.loaded && two.loaded) {
    console.log("All SVGs loaded:");
    two.height = paper.height * stencilRatio;
    two.width = two.height / two.ratio;

    // Place paper at back.x + back.width
    paper.x = back.x + back.width;
    paper.originalX = paper.targetX;
    paper.originalY = paper.targetY;

    run(update);
  }
}

function update(dt) {
  console.log(
    "Paper X Y originalX original Y Target X Target Y",
    paper.x,
    paper.y,
    paper.originalX,
    paper.originalY,
    paper.targetX,
    paper.targetY
  );
  let nextState = undefined;
  switch (currentState) {
    case State.WaitingForInput: {
      if (input.hasStarted()) {
        startInputX = input.getX();
        nextState = State.FirstDesign;
      }
      //nextState = State.FirstDesign;

      break;
    }

    case State.FirstDesign: {
      console.log("STATE FirstDesign UPDATE");

      // Update intro animation
      if (!introComplete) {
        introProgress += dt / slideInDuration;
        if (introProgress >= 1) {
          introProgress = 1;
          introComplete = true;
        }
      }

      // Only animate during intro, don't override positions after animation completes
      if (!introComplete) {
        // Easing function for smooth intro (smoothstep)
        const ease = introProgress * introProgress * (3 - 2 * introProgress);

        // Animate back sliding in from left
        const backStartX = -back.width;
        back.x = backStartX + (back.targetX - backStartX) * ease;

        // Animate paper sliding in from bottom
        const paperStartY = canvas.height + paper.height;
        paper.x = paper.targetX; // Keep x at target position during slide-in
        paper.y = paperStartY + (paper.targetY - paperStartY) * ease;
      }

      if (paper.hasReturned) {
        nextState = State.SecondDesign;
        paper.hasReturned = false;
      }
      break;
    }
    case State.SecondDesign: {
      console.log("STATE SecondDesign UPDATE");
      if (paper.hasReturned) {
        nextState = State.ThirdDesign;
        paper.hasReturned = false;
      }
      break;
    }
    case State.ThirdDesign: {
      console.log("STATE ThirdDesign UPDATE");
      if (paper.hasReturned) {
        nextState = State.Two;
        paper.hasReturned = false;
      }
      break;
    }
    case State.Two: {
      console.log("STATE TWO UPDATE");

      // Check if the two has been successfully placed
      if (two.onSkin) {
        paperMovingOffScreen = true;
        // Start waiting before outro
        if (!outroStarted) {
          outroWaitProgress += dt / waitBeforeOutro;

          if (outroWaitProgress >= 1) {
            outroStarted = true;
            outroWaitProgress = 1;
          }
        }

        // After wait, start outro animation
        if (outroStarted && !outroComplete) {
          outroProgress += dt / slideOutDuration;

          if (outroProgress >= 1) {
            outroProgress = 1;
            outroComplete = true;
          }

          // Easing function for smooth outro (smoothstep)
          const ease = outroProgress * outroProgress * (3 - 2 * outroProgress);

          // Slide back and paper out to the right by the same distance
          const outroDistance = canvas.width * 1.5;
          back.x = back.targetX + outroDistance * ease;

          // Calculate offset for designs on skin
          backOutroOffset = outroDistance * ease;
          // Move paper to final position off-screen
          const paperStartX = paper.originalX;
          paper.x = paperStartX + (paper.finalX - paperStartX) * ease;
        }

        // Transition to finished after outro completes
        if (outroComplete) {
          nextState = State.Finished;
        }
      }
      break;
    }
    case State.Finished: {
      break;
    }
  }

  if (nextState !== undefined) {
    currentState = nextState;
  }
  switch (currentState) {
    case State.Finished:
      console.log("FINISHED");
      finish();
      break;
    case State.WaitingForInput:
      // console.log("STATE WaitingForInput");
      break;
    case State.FirstDesign:
      // console.log("STATE FirstDesign");
      drawBack();
      // Draw all previously placed failed attempts
      placedDesigns.firstDesign.forEach((design) => drawPlacedDesign(design));
      activeDesign = tattooDesign_01;
      //console.log("ACTIVE DESIGN FIRST:", activeDesign);
      updateObject(tattooDesign_01);
      break;
    case State.SecondDesign:
      //console.log("STATE SecondDesign");
      drawBack();
      placedDesigns.firstDesign.forEach((design) => drawPlacedDesign(design));
      placedDesigns.secondDesign.forEach((design) => drawPlacedDesign(design));
      activeDesign = tattooDesign_02;
      updateObject(tattooDesign_01);
      updateObject(tattooDesign_02);
      break;
    case State.ThirdDesign:
      //console.log("STATE ThirdDesign");
      drawBack();
      placedDesigns.firstDesign.forEach((design) => drawPlacedDesign(design));
      placedDesigns.secondDesign.forEach((design) => drawPlacedDesign(design));
      placedDesigns.thirdDesign.forEach((design) => drawPlacedDesign(design));
      activeDesign = tattooDesign_03;
      updateObject(tattooDesign_01);
      updateObject(tattooDesign_02);
      updateObject(tattooDesign_03);
      break;
    case State.Two:
      // console.log("STATE TWO");
      drawBack();
      placedDesigns.firstDesign.forEach((design) => drawPlacedDesign(design));
      placedDesigns.secondDesign.forEach((design) => drawPlacedDesign(design));
      placedDesigns.thirdDesign.forEach((design) => drawPlacedDesign(design));
      placedDesigns.two.forEach((design) => drawPlacedDesign(design));
      activeDesign = two;
      updateObject(tattooDesign_01);
      updateObject(tattooDesign_02);
      updateObject(tattooDesign_03);
      updateObject(two);
      //updateTwo();
      break;
  }

  DEBUGMODE();

  updatePaper();

  DEBUG_TwoRectangle();
  DEBUG_BackRectangle();
}

function drawBack() {
  ctx.save();
  ctx.drawImage(back.svg, back.x, back.y, back.width, back.height);
  ctx.restore();
}

function drawTwo() {
  ctx.save();

  ctx.globalAlpha = two.opacity; // Set opacity (0.0 to 1.0)

  ctx.drawImage(
    two.svg,
    two.x - two.width / 2,
    two.y - two.height / 2,
    two.width,
    two.height
  );

  ctx.restore(); // Restore to reset globalAlpha
}

function drawPaper() {
  ctx.save();
  ctx.globalAlpha = paper.opacity;
  ctx.drawImage(
    paper.svg,
    paper.x - paper.width / 2,
    paper.y - paper.height / 2,
    paper.width,
    paper.height
  );
  ctx.restore();
}
function updatePaper() {
  paper.rect = {
    x: paper.x - paper.width / 2,
    y: paper.y - paper.height / 2,
    w: paper.width,
    h: paper.height,
  };

  paper.isHovered = paperIsHovered();

  paper.height = back.height * 0.3;
  paper.width = paper.height / paper.ratio;

  if (input.isPressed()) {
    if (
      !paper.isDragging &&
      paper.isHovered &&
      !paper.goToOriginal &&
      introComplete &&
      !two.onSkin
    ) {
      paper.isDragging = true;
      paper.goToOriginal = false;
      // Play pickup sound
      if (pickupSound) {
        pickupSound.play({
          volume: Math.random() * 0.1 + 0.9,
        });
      }
    }
  } else if (paper.isDragging) {
    paper.isDragging = false;
    paper.goToOriginal = true;

    // Calculate and log the percentage of the design visible on the back
    const visiblePercentage = calculateVisiblePercentage(activeDesign);
    //console.log(`Visible percentage on back: ${visiblePercentage.toFixed(2)}%`);

    if (visiblePercentage >= VISIBILITY_THRESHOLD) {
      // SUCCESS: The design is placed correctly
      console.log("✓ SUCCESS! Design placed correctly.");
      if (activeDesign) {
        activeDesign.onSkin = true;
      }
    } else {
      // FAILURE: Not enough visibility, keep the design where it is and create a new copy
      console.log("✗ FAILED! Not enough visibility. Creating new copy...");

      if (activeDesign) {
        // Keep the current design where it was released
        activeDesign.onSkin = true;

        // Store this failed attempt
        const currentStateKey = getCurrentStateKey();
        if (currentStateKey) {
          placedDesigns[currentStateKey].push({
            x: activeDesign.x,
            y: activeDesign.y,
            width: activeDesign.width,
            height: activeDesign.height,
            svg: activeDesign.svg,
            opacity: activeDesign.opacity,
            ratio: activeDesign.ratio,
          });
        }

        // Reset the active design to follow the paper again
        activeDesign.onSkin = false;
        activeDesign.x = paper.x;
        activeDesign.y = paper.y;
      }

      // Don't allow state transition - but still smoothly return to original
      paper.goToOriginal = true;
      paper.hasReturned = false; // Ensure this doesn't trigger state change
    }

    if (!activeDesign.onSkin) {
      if (pickupSound) {
        console.log("PLAY pickup SOUND");
        pickupSound.play({
          volume: Math.random() * 0.1 + 0.9,
        });
      }
    } else {
      if (putSound) {
        putSound.play({
          volume: Math.random() * 0.1 + 0.3,
        });
      }
    }
  }

  if (paper.isDragging) {
    paper.x = input.getX();
    paper.y = input.getY();
  } else if (paper.goToOriginal && !paperMovingOffScreen) {
    paper.x = math.lerp(paper.x, paper.originalX, 0.1);
    paper.y = math.lerp(paper.y, paper.originalY, 0.1);

    if (math.dist(paper.x, paper.y, paper.originalX, paper.originalY) < 1) {
      paper.goToOriginal = false;
      paper.x = paper.originalX;
      paper.y = paper.originalY;

      // Only set hasReturned if the active design is successfully on skin
      if (
        activeDesign &&
        activeDesign.onSkin &&
        calculateVisiblePercentage(activeDesign) >= VISIBILITY_THRESHOLD
      ) {
        paper.hasReturned = true;
      }
    }
  } else if (paperMovingOffScreen) {
    // Move paper directly to final position off-screen
    const ease = 0.05;
    paper.x += (paper.finalX - paper.x) * ease;
    paper.y += (paper.finalY - paper.y) * ease;

    // Check if paper has reached off-screen position
    if (paper.x >= paper.finalX - 10) {
      paperOffScreen = true;
    }
  }

  // Only draw paper if it hasn't moved off screen
  if (!paperOffScreen) {
    drawPaper();
  }
}

function paperIsHovered() {
  if (
    input.getX() >= paper.rect.x &&
    input.getX() < paper.rect.x + paper.rect.w &&
    input.getY() >= paper.rect.y &&
    input.getY() < paper.rect.y + paper.rect.h
  ) {
    return true;
  } else {
    return false;
  }
}

/* TODO ---------------------- Make that when we leave the two over the body it stays. 
Then make the pixels that overlap between the 2 and and the body stay on the body and the rest make alpha = 0 ------------*/

//maybe do it with blend mode (composite bled mode) to draw

function checkPixelIsOnSkin() {
  const tmpTwoCanvas = document.createElement("canvas");
  tmpTwoCanvas.width = canvas.width;
  tmpTwoCanvas.height = canvas.height;
  const tmpCtx = tmpTwoCanvas.getContext("2d");
  tmpCtx.clearRect(0, 0, canvas.width, canvas.height);

  tmpCtx.drawImage(two.svg, two.x, two.y, two.width, two.height);
  const twoImageData = tmpCtx.getImageData(0, 0, canvas.width, canvas.height);

  const backCanvas = document.createElement("canvas");
  backCanvas.width = canvas.width;
  backCanvas.height = canvas.height;
  const backCtx = threeCanvas.getContext("2d");
  backCtx.clearRect(0, 0, canvas.width, canvas.height);

  backCtx.drawImage(back.svg, back.x, back.y, back.width, back.height);
  const backImageData = backCtx.getImageData(0, 0, canvas.width, canvas.height);

  const overlappingPixels = [];

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
      const twoAlpha = twoImageData.data[index + 3];
      const backAlpha = backImageData.data[index + 3];

      overlappingPixels.push({
        overlapping: twoAlpha > 128 && backAlpha > 128,
        x,
        y,
      });
    }
  }

  console.log("overlappingPixels:", overlappingPixels);
}

function twoPixels() {
  const twoCanvas = document.createElement("canvas");
  twoCanvas.width = canvas.width;
  twoCanvas.height = canvas.height;
  const twoCtx = twoCanvas.getContext("2d");
  twoCtx.clearRect(0, 0, canvas.width, canvas.height);

  twoCtx.drawImage(two.svg, two.x, two.y, two.width, two.height);
  const imageData = twoCtx.getImageData(0, 0, canvas.width, canvas.height);

  //TODO check pixels the two is in
  window.twoPixelsIsActive = (x, y) => {
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return false;
    const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    return imageData.data[index + 3] > 128;
  };
}

function backPixels() {
  const backCanvas = document.createElement("canvas");
  backCanvas.width = canvas.width;
  backCanvas.height = canvas.height;
  const backCtx = backCanvas.getContext("2d");
  backCtx.clearRect(0, 0, canvas.width, canvas.height);

  backCtx.drawImage(back.svg, back.x, back.y, back.width, back.height);
  const imageData = backCtx.getImageData(0, 0, canvas.width, canvas.height);

  //TODO check pixels the back is in
  window.BackPixelsIsActive = (x, y) => {
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return false;
    const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    return imageData.data[index + 3] > 128;
  };
}

/**
 * Calculate the percentage of the design that overlaps with the back
 * @param {object} design - The design object (tattooDesign_01, tattooDesign_02, tattooDesign_03, or two)
 * @returns {number} - Percentage of visible pixels (0-100)
 */
function calculateVisiblePercentage(design) {
  if (!design || !design.svg) return 0;

  // Create canvas for the design
  const designCanvas = document.createElement("canvas");
  designCanvas.width = canvas.width;
  designCanvas.height = canvas.height;
  const designCtx = designCanvas.getContext("2d");
  designCtx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the design at its current position
  designCtx.drawImage(
    design.svg,
    design.x - design.width / 2,
    design.y - design.height / 2,
    design.width,
    design.height
  );
  const designImageData = designCtx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Create canvas for the back
  const backCanvas = document.createElement("canvas");
  backCanvas.width = canvas.width;
  backCanvas.height = canvas.height;
  const backCtx = backCanvas.getContext("2d");
  backCtx.clearRect(0, 0, canvas.width, canvas.height);

  backCtx.drawImage(back.svg, back.x, back.y, back.width, back.height);
  const backImageData = backCtx.getImageData(0, 0, canvas.width, canvas.height);

  let totalDesignPixels = 0;
  let overlappingPixels = 0;

  // Check each pixel
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      const designAlpha = designImageData.data[index + 3];
      const backAlpha = backImageData.data[index + 3];

      // If the design has a visible pixel at this position
      if (designAlpha > 128) {
        totalDesignPixels++;

        // If the back also has a visible pixel at this position
        if (backAlpha > 128) {
          overlappingPixels++;
        }
      }
    }
  }

  // Calculate percentage
  if (totalDesignPixels === 0) return 0;
  return (overlappingPixels / totalDesignPixels) * 100;
}
/* finsih TODO */

function loadTattooDesign(object, path) {
  // load back svg
  const tempSVG = new Image();
  tempSVG.src = path;
  object.loaded = false;
  tempSVG.onload = () => {
    object.loaded = true;
    object.svg = tempSVG;
    object.ratio = tempSVG.naturalHeight / tempSVG.naturalWidth;
    object.height = paper.height * stencilRatio;
    object.width = object.height / object.ratio;
    object.x = paper.x;
    object.y = paper.y;
    object.free = true;
  };
}

function updateObject(object) {
  object.height = paper.height * stencilRatio;
  object.width = object.height / object.ratio;

  if (!object.onSkin) {
    // only follow paper when not on skin - update both x and y
    object.x = paper.x;
    object.y = paper.y;
  }

  // draw the provided object (tattoo design), not the "two"
  drawObject(object);
}

function drawObject(object) {
  ctx.save();

  if (object.onSkin) {
    ctx.globalCompositeOperation = "source-atop";
  }
  ctx.globalAlpha = object.opacity; // Set opacity (0.0 to 1.0);

  // Apply outro offset if design is on skin
  const xOffset = object.onSkin ? backOutroOffset : 0;

  ctx.drawImage(
    object.svg,
    object.x - object.width / 2 + xOffset,
    object.y - object.height / 2,
    object.width,
    object.height
  );

  ctx.restore(); // Restore to reset globalAlpha
}

function drawPlacedDesign(design) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = design.opacity;

  // Apply outro offset to placed designs
  const xOffset = backOutroOffset;

  ctx.drawImage(
    design.svg,
    design.x - design.width / 2 + xOffset,
    design.y - design.height / 2,
    design.width,
    design.height
  );
  ctx.restore();
}

function getCurrentStateKey() {
  switch (currentState) {
    case State.FirstDesign:
      return "firstDesign";
    case State.SecondDesign:
      return "secondDesign";
    case State.ThirdDesign:
      return "thirdDesign";
    case State.Two:
      return "two";
    default:
      return null;
  }
}

/* --------------------------- DEBUG ----------------------------------- */
function DEBUGMODE() {
  if (!DEBUG) return;
  console.log("### DEBUG MODE ACTIVE");
  console.log("### DEBUG MOUSE X Y :", input.getX(), input.getY());

  drawPaperRectangleDebug();
}

function drawPaperRectangleDebug() {
  if (!DEBUG) return;
  console.log("### DEBUG RECTANGLE DRAW");

  ctx.save();
  ctx.beginPath();
  const debugRect = paper.rect;
  console.log("### DEBUG RECTANGLE:", debugRect);

  ctx.rect(debugRect.x, debugRect.y, debugRect.w, debugRect.h);
  // removed fill to avoid covering the background
  ctx.lineWidth = 2;
  ctx.strokeStyle = paper.isHovered ? "rgba(0,255,0,0.6)" : "rgba(255,0,0,0.6)";
  ctx.stroke();
  ctx.restore();
}

function DEBUG_TwoRectangle() {
  if (!DEBUG) return;
  console.log("### DEBUG RECTANGLE TWO DRAW");

  ctx.save();
  ctx.beginPath();
  const debugRect = {
    x: two.x - two.width / 2,
    y: two.y - two.height / 2,
    w: two.width,
    h: two.height,
  };
  console.log("### DEBUG RECTANGLE TWO:", debugRect);
  ctx.rect(debugRect.x, debugRect.y, debugRect.w, debugRect.h);
  // removed fill to avoid covering the background
  ctx.lineWidth = 2;
  ctx.strokeStyle = paper.isHovered ? "rgba(0,255,0,0.6)" : "rgba(255,0,0,0.6)";
  ctx.stroke();
  ctx.restore();
}

function DEBUG_BackRectangle() {
  if (!DEBUG) return;
  console.log("### DEBUG RECTANGLE BACK DRAW");

  ctx.beginPath();
  const debugRect = {
    x: back.x + 0.1 * back.width,
    y: back.y + 0.1 * back.height,
    w: back.width * 0.8,
    h: back.height * 0.8,
  };
  console.log("### DEBUG RECTANGLE TWO:", debugRect);

  ctx.rect(debugRect.x, debugRect.y, debugRect.w, debugRect.h);
  ctx.fillStyle = paper.isHovered ? "green" : "red";
  //ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "blue";
  ctx.stroke();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "f") {
    finish();
  }
});
