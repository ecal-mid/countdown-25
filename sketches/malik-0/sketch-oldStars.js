import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

const State = {
  WaitingForInput: "waitingForInput",
  Intro: "intro",
  Reviewing: "reviewing",
  Outro: "outro",
  Finished: "finished",
};
let currentState = State.WaitingForInput;

const stars = [];
const starCount = 5;
const starY = canvas.height * 0.23; // Center vertical position
let starsLoaded = 0;
const starAcceleration = 10;
const rotationSpeed = 0.5;

const reviewSVG = new Image();
reviewSVG.src = "/sketches/malik-0/review.svg";
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

reviewSVG.onload = () => {
  review.ratio = reviewSVG.width / reviewSVG.height;
  review.height = canvas.height;
  review.width = review.height * review.ratio;
  review.x = canvas.width / 2 - review.width / 2;
  review.y = canvas.height / 2 - review.height / 2;
  review.targetX = review.x;
  review.targetY = review.y;
  review.loaded = true;

  // Load stars after review is loaded
  for (let i = 0; i < starCount; i++) {
    const starSVG = new Image();
    starSVG.src = `/sketches/malik-0/star-0${i + 1}.svg`;
    starSVG.onload = () => {
      const ratio = starSVG.naturalWidth / starSVG.naturalHeight;
      const height = review.height * 0.15;
      const width = height * ratio;
      const spacing = review.width / (starCount + 2);

      const star = {
        svg: starSVG,
        x: spacing * (i + 2) + review.x,
        y: starY,
        height: height,
        width: width,
        ratio: ratio,
        velocity: 0,
        acceleration: starAcceleration,
        clicked: false,
        rotation: 0,
      };
      stars.push(star);

      starsLoaded++;
      if (starsLoaded === starCount) {
        run(update);
      }
    };
  }
};

function drawStar(star) {
  ctx.save();
  ctx.translate(star.x, star.y);
  ctx.rotate(star.rotation);

  // Draw the star SVG centered at the current position
  ctx.drawImage(
    star.svg,
    -star.width / 2,
    -star.height / 2,
    star.width,
    star.height
  );

  //TODO DEBUG
  ctx.rect(-star.width / 2, -star.height / 2, star.width, star.height);
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.restore();
}

function drawReview() {
  ctx.save();
  ctx.drawImage(review.svg, review.x, review.y, review.width, review.height);
  ctx.rect(review.x, review.y, review.width, review.height);
  ctx.strokeStyle = "#FF0000";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();
}

function checkStarsClicked(event) {
  const mouseX = input.getX();
  const mouseY = input.getY();

  stars.forEach((star) => {
    const halfWidth = star.width / 2;
    const halfHeight = star.height / 2;

    if (
      !star.clicked &&
      mouseX >= star.x - halfWidth &&
      mouseX <= star.x + halfWidth &&
      mouseY >= star.y - halfHeight &&
      mouseY <= star.y + halfHeight
    ) {
      console.log("Star clicked!", star);
      star.clicked = true;
    }
  });
}

function updateStars(dt) {
  for (let i = stars.length - 1; i >= 0; i--) {
    const star = stars[i];
    if (star.clicked) {
      star.velocity += star.acceleration * dt;
      star.y += star.velocity;
      star.rotation += rotationSpeed * dt;

      // Remove star if it falls below the canvas
      if (star.y - star.height / 2 > canvas.height) {
        stars.splice(i, 1);
      }
    }
  }
}

function update(dt) {
  let nextState = undefined;
  switch (currentState) {
    case State.WaitingForInput:
      nextState = State.Intro;
      break;
    case State.Intro:
      nextState = State.Reviewing;
      break;
    case State.Reviewing:
      //nextState = State.Outro;
      break;
    case State.Outro:
      nextState = State.Finished;
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
      break;
    case State.Reviewing:
      window.addEventListener("click", checkStarsClicked);
      updateStars(dt);
      break;
    case State.Outro:
      break;
    case State.Finished:
      finish();
      break;
  }

  //drawReview();
  // Draw all stars
  stars.forEach((star) => {
    drawStar(star);
  });
}
