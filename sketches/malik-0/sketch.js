import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";

const { renderer, input, audio, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

const State = {
  WaitingForInput: "waitingForInput",
  Intro: "intro",
  Reviewing: "reviewing",
  Outro: "outro",
  Finished: "finished",
};
let currentState = State.WaitingForInput;

const starsSuccess = await audio.load({
  src: "/sketches/malik-0/stars-success.wav",
});
const starPositive = await audio.load({
  src: "/sketches/malik-0/star-positive.wav",
});
const starNegative = await audio.load({
  src: "/sketches/malik-0/star-negative.wav",
});
const buttonError = await audio.load({
  src: "/sketches/malik-0/button-error.wav",
});
const buttonSuccess = await audio.load({
  src: "/sketches/malik-0/button-success.wav",
});

const stars = [];
const starCount = 5;
const reviewSizeRatio = 0.15;
const starY = canvas.height * 0.5; // Center vertical position
const rateY = canvas.height * 0.63; // Center vertical position
let starsLoaded = 0;
let rateButtonClicked = false;

let introDuration = 0.2;
let introProgress = 0;
let introComplete = false;

//outro
let outroComplete = false;
let outroDuration = 0.2;
let outroProgress = 0;
let goBlack = false;

const reviewSVG = new Image();
reviewSVG.src = "/sketches/malik-0/review-02.svg";
const review = {
  svg: reviewSVG,
  x: 0,
  y: 0,
  ratio: 0,
  width: 0,
  height: 0,
  targetX: 0,
  targetY: 0,
  isAnimating: false,
  loaded: false,
};

// Load star SVGs (outline and filled)
const starOutlinedSVG = new Image();
starOutlinedSVG.src = "/sketches/malik-0/star.svg";

const starFilledSVG = new Image();
starFilledSVG.src = "/sketches/malik-0/star-filled.svg";

let starSVGsLoaded = 0;
starOutlinedSVG.onload = () => {
  starSVGsLoaded++;
  checkStarSVGsLoaded();
};

starFilledSVG.onload = () => {
  starSVGsLoaded++;
  checkStarSVGsLoaded();
};

// Load rate button SVG
const rateButtonSVG = new Image();
rateButtonSVG.src = "/sketches/malik-0/rate-button.svg";
const rate = {
  svg: rateButtonSVG,
  x: 0,
  y: 0,
  ratio: 0,
  width: 0,
  height: 0,
  loaded: false,
  shakeProgress: 0,
  isShaking: false,
};

rateButtonSVG.onload = () => {
  rate.loaded = true;
  rate.ratio = rateButtonSVG.naturalWidth / rateButtonSVG.naturalHeight;
  rate.height = review.height * reviewSizeRatio;
  rate.width = rate.height * rate.ratio;
  rate.x = canvas.width / 2 - rate.width / 2;
  rate.y = rateY;
};
// Load zero and fife (large artwork) SVGs
const zeroSVG = new Image();
zeroSVG.src = "/sketches/malik-0/zero.svg";
const zero = {
  svg: zeroSVG,
  x: 0,
  y: 0,
  ratio: 0,
  width: 0,
  height: 0,
  loaded: false,
};

const fifeSVG = new Image();
fifeSVG.src = "/sketches/malik-0/fife.svg";
const fife = {
  svg: fifeSVG,
  x: 0,
  y: 0,
  ratio: 0,
  width: 0,
  height: 0,
  loaded: false,
};

// Spring for zero scale animation
const zeroSpring = new Spring({
  frequency: 2.5,
  halfLife: 0.1,
  position: 0,
  velocity: 0,
  target: 1,
});
let zeroSpringStarted = false;
let zeroSpringFinished = false;

zeroSVG.onload = () => {
  zero.loaded = true;
  zero.ratio = zeroSVG.naturalWidth / zeroSVG.naturalHeight;
  zero.height = canvas.height * 0.5;
  zero.width = zero.height * zero.ratio;
  zero.x = canvas.width / 2 - zero.width / 2;
  zero.y = canvas.height / 2 - zero.height / 2;
};

fifeSVG.onload = () => {
  fife.loaded = true;
  fife.ratio = fifeSVG.naturalWidth / fifeSVG.naturalHeight;
  fife.height = canvas.height * 0.1;
  fife.width = fife.height * fife.ratio;
  // Position fife below and to the right of zero
  if (zero.loaded) {
    fife.x = zero.x + zero.width - fife.width / 2;
    fife.y = zero.y + zero.height - fife.height;
  }
};

reviewSVG.onload = () => {
  review.ratio = reviewSVG.width / reviewSVG.height;
  review.height = canvas.height * 0.6;
  review.width = review.height * review.ratio;
  review.x = canvas.width / 2 - review.width / 2;
  review.y = canvas.height / 2 - review.height / 2;
  review.targetX = review.x;
  review.targetY = review.y;
  review.loaded = true;

  checkStarSVGsLoaded();
};

function checkStarSVGsLoaded() {
  if (review.loaded && starSVGsLoaded === 2) {
    // Create stars after review and star SVGs are loaded
    const ratio = starOutlinedSVG.naturalWidth / starOutlinedSVG.naturalHeight;
    const height = review.height * reviewSizeRatio;
    const width = height * ratio;

    // Calculate spacing to fit stars inside the review rectangle
    const totalStarsWidth = width * starCount;
    const availableSpace = review.width - totalStarsWidth;
    const spacing = availableSpace / (starCount + 1);

    for (let i = 0; i < starCount; i++) {
      const star = {
        svg_outlined: starOutlinedSVG,
        svg_filled: starFilledSVG,
        x: review.x + spacing * (i + 1) + width * (i + 0.5),
        y: starY,
        height: height,
        width: width,
        ratio: ratio,
        clicked: i < 3, // Stars 0, 1, 2 (first 3) start clicked
      };
      stars.push(star);
    }

    run(update);
  }
}

function drawStar(star) {
  ctx.save();
  ctx.translate(star.x, star.y);

  // Draw the appropriate star SVG (outlined or filled) centered at the current position
  const svgToUse = star.clicked ? star.svg_filled : star.svg_outlined;
  ctx.drawImage(
    svgToUse,
    -star.width / 2,
    -star.height / 2,
    star.width,
    star.height
  );

  //TODO DEBUG
  // ctx.rect(-star.width / 2, -star.height / 2, star.width, star.height);
  // ctx.strokeStyle = "#00FF00";
  // ctx.lineWidth = 5;
  // ctx.stroke();

  ctx.restore();
}

function drawReview() {
  ctx.save();
  ctx.drawImage(review.svg, review.x, review.y, review.width, review.height);
  // ctx.rect(review.x, review.y, review.width, review.height);
  // ctx.strokeStyle = "#FF0000";
  // ctx.lineWidth = 10;
  // ctx.stroke();
  ctx.restore();
}

function shakeRateButton() {
  buttonError.play();
  rate.isShaking = true;
  rate.shakeProgress = 0;
}

function drawRate() {
  if (!rate.loaded) return;
  ctx.save();

  // Check if all stars are unclicked (button is clickable)
  const allStarsUnclicked = stars.every((star) => !star.clicked);

  // Apply shake offset if shaking
  let shakeOffsetX = 0;
  let shakeOffsetY = 0;
  if (rate.isShaking) {
    const shakeIntensity = 5;
    const frequency = 20;
    const decay = Math.exp(-rate.shakeProgress * 8);
    shakeOffsetX =
      Math.sin(rate.shakeProgress * frequency) * shakeIntensity * decay;
    shakeOffsetY =
      Math.cos(rate.shakeProgress * frequency * 1.5) * shakeIntensity * decay;
  }

  ctx.drawImage(
    rate.svg,
    rate.x + shakeOffsetX,
    rate.y + shakeOffsetY,
    rate.width,
    rate.height
  );
  ctx.restore();
}

function drawZero() {
  if (!zero.loaded) return;
  ctx.save();

  // Use spring position as scale (starts at 0.1, overshoots past 1, settles at 1)
  const scale = zeroSpring.position;

  // Translate to center, scale, then draw centered
  const centerX = zero.x + zero.width / 2;
  const centerY = zero.y + zero.height / 2;
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.drawImage(
    zero.svg,
    -zero.width / 2,
    -zero.height / 2,
    zero.width,
    zero.height
  );
  // ctx.rect(-zero.width / 2, -zero.height / 2, zero.width, zero.height);
  // ctx.strokeStyle = "#00FF00";
  // ctx.lineWidth = 5;
  // ctx.stroke();

  ctx.restore();
}

function drawFife() {
  if (!fife.loaded) return;
  ctx.save();
  ctx.drawImage(fife.svg, fife.x, fife.y, fife.width, fife.height);
  ctx.restore();
}

function mouseClicked(event) {
  const mouseX = input.getX();
  const mouseY = input.getY();

  if (currentState == State.Reviewing) {
    // Check rate button click first
    if (rate.loaded && !rateButtonClicked) {
      const allStarsUnclicked = stars.every((star) => !star.clicked);

      if (
        mouseX >= rate.x &&
        mouseX <= rate.x + rate.width &&
        mouseY >= rate.y &&
        mouseY <= rate.y + rate.height
      ) {
        if (allStarsUnclicked) {
          console.log("Rate button clicked!");
          rateButtonClicked = true;
          buttonSuccess.play();
          return; // Exit early to prevent star clicks
        } else {
          shakeRateButton();
        }
      }
    }

    // Check star clicks
    stars.forEach((star) => {
      const halfWidth = star.width / 2;
      const halfHeight = star.height / 2;

      if (
        mouseX >= star.x - halfWidth &&
        mouseX <= star.x + halfWidth &&
        mouseY >= star.y - halfHeight &&
        mouseY <= star.y + halfHeight
      ) {
        console.log("Star clicked!", star);
        star.clicked = !star.clicked; // Toggle the clicked state
        const allStarsUnclicked = stars.every((star) => !star.clicked);
        if (allStarsUnclicked) {
          starsSuccess.play();
        } else {
          if (!star.clicked) {
            starPositive.play();
          } else {
            starNegative.play();
          }
        }
      }
    });
  } else if (currentState == State.Outro) {
    if (zeroSpringFinished) {
      goBlack = true;
    }
  }
}
// Register click handler once
window.addEventListener("click", mouseClicked);
function update(dt) {
  let nextState = undefined;
  switch (currentState) {
    case State.WaitingForInput:
      nextState = State.Intro;
      break;
    case State.Intro:
      if (introComplete) {
        nextState = State.Reviewing;
      }
      break;
    case State.Reviewing:
      if (rateButtonClicked) {
        nextState = State.Outro;
      }
      break;
    case State.Outro:
      if (outroComplete) {
        nextState = State.Finished;
      }
      break;
    case State.Finished:
      break;
  }

  if (nextState) {
    currentState = nextState;
  }

  switch (currentState) {
    case State.WaitingForInput:
      if (input.hasStarted()) {
        nextState = State.Intro;
      }
      break;
    case State.Intro:
      // Update intro animation progress
      if (!introComplete) {
        introProgress += dt / introDuration;
        if (introProgress >= 1) {
          introProgress = 1;
          introComplete = true;
        }
      }

      // Easing function (smoothstep)
      const ease = introProgress * introProgress * (3 - 2 * introProgress);
      const canvasScale = ease; // Scale from 0 to 1

      // Save context and apply scale transformation
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(canvasScale, canvasScale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Draw all objects
      drawReview();
      stars.forEach((star) => {
        drawStar(star);
      });
      drawRate();

      ctx.restore();
      break;
    case State.Reviewing:
      // Update shake animation
      if (rate.isShaking) {
        rate.shakeProgress += dt * 2;
        if (rate.shakeProgress >= 1) {
          rate.isShaking = false;
          rate.shakeProgress = 0;
        }
      }

      drawReview();
      // Draw all stars
      stars.forEach((star) => {
        drawStar(star);
      });
      drawRate();
      break;
    case State.Outro:
      if (!goBlack) {
        // Initialize spring on first frame of outro
        if (!zeroSpringStarted) {
          zeroSpringStarted = true;
          zeroSpring.position = 0.1; // Start very small
          zeroSpring.velocity = 0;
          zeroSpring.target = 1; // Target normal scale
        }

        // Step the spring animation
        zeroSpring.step(dt);

        // Check if spring animation is finished (close to target and low velocity)
        if (
          !zeroSpringFinished &&
          Math.abs(zeroSpring.position - 1) < 0.01 &&
          Math.abs(zeroSpring.velocity) < 0.01
        ) {
          zeroSpringFinished = true;
          console.log("Zero spring animation finished.");
        }

        drawZero();
        drawFife();
      } else {
        // Update outro animation progress when goBlack is true
        if (!outroComplete) {
          outroProgress += dt / outroDuration;
          if (outroProgress >= 1) {
            outroProgress = 1;
            outroComplete = true;
          }
        }

        // Easing function (smoothstep)
        const outroEase =
          outroProgress * outroProgress * (3 - 2 * outroProgress);
        const outroCanvasScale = 1 - outroEase; // Scale from 1 to 0 (inverse)

        // Save context and apply scale transformation
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(outroCanvasScale, outroCanvasScale);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        // Draw zero and fife while shrinking
        drawZero();
        drawFife();

        ctx.restore();
      }
      break;
    case State.Finished:
      finish();
      break;
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key === "f") {
    finish();
  }
});
