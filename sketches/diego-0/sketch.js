import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";

const { renderer, run, finish } = createEngine();
const { ctx, canvas } = renderer;

let eggs = [];
let isDropping = false;
let finished = false;

let eggTimer = 0;
const EGG_INTERVAL = 0.2;

const feet = new Image();
feet.src = "assets/feet.svg";

const face = new Image();
face.src = "assets/face.svg";

let feetLoaded = false;
let faceLoaded = false;

feet.onload = () => (feetLoaded = true);
face.onload = () => (faceLoaded = true);

let feetWidth = 1500;
let feetHeight = 2200;
let faceWidth = 500;
let faceHeight = 2000;

let feetX = canvas.width * 0.5;
let feetY = 100;

let faceX = canvas.width * 0.8;
let faceY = canvas.height * 0.15;

let zeroCenterX = canvas.width * 0.5;
let zeroCenterY = canvas.height * 0.5;
const zeroFontSize = 1000;

const zeroOuterRadius = zeroFontSize * 0.45;
const zeroInnerRadius = zeroFontSize * 0.2;

const font = new FontFace("TWKBurns", "url(assets/TWKBurns-Ultra.otf)");
font
  .load()
  .then(() => {
    document.fonts.add(font);
    console.log("Font loaded");
  })
  .catch((err) => console.error("Font error", err));

const chickenSound = new Audio("assets/chicken.mp3");
chickenSound.loop = true;
chickenSound.volume = 0.5;

function playBackgroundSound() {
  chickenSound.currentTime = 0;
  chickenSound.play();
}

canvas.addEventListener("click", () => {
  if (chickenSound.paused) {
    playBackgroundSound();
  }
});

class Egg {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 80;
    this.vy = 0;
    this.rotation = Math.random() * 0.4 - 0.2;
    this.rotationSpeed = (Math.random() - 0.5) * 1.5;
    this.radius = 35;

    this.eggSound = new Audio("assets/egg.mp3");
    this.eggSound.preload = "auto";
    this.eggSound.volume = 0.5;
  }

  playSound() {
    try {
      this.eggSound.currentTime = 11.8;
      this.eggSound.play();

      this.eggSound.addEventListener("timeupdate", () => {
        if (this.eggSound.currentTime >= 12.3) {
          this.eggSound.pause();
          this.eggSound.currentTime = 12;
        }
      });
    } catch (e) {}
  }

  update(dt) {
    this.vy += 400 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotationSpeed * dt;

    if (this.y + this.radius >= canvas.height) {
      this.y = canvas.height - this.radius;
      this.vy = 0;
      this.vx *= 0.7;
      this.rotationSpeed *= 0.5;
      if (Math.abs(this.vx) < 5) this.vx = 0;
      if (Math.abs(this.rotationSpeed) < 0.02) this.rotationSpeed = 0;
    }

    this.collideWithZero();
  }

  collideWithZero() {
    const dx = this.x - zeroCenterX;
    const dy = this.y - zeroCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

    if (dist + this.radius > zeroOuterRadius) {
      const nX = dx / dist;
      const nY = dy / dist;

      const overlap = dist + this.radius - zeroOuterRadius;
      this.x -= nX * overlap;
      this.y -= nY * overlap;

      const dot = this.vx * nX + this.vy * nY;
      this.vx -= 2 * dot * nX;
      this.vy -= 2 * dot * nY;

      this.vx *= 0.6;
      this.vy *= 0.6;
    }

    if (dist - this.radius < zeroInnerRadius) {
      const nX = dx / dist;
      const nY = dy / dist;

      const overlap = zeroInnerRadius - (dist - this.radius);
      this.x += nX * overlap;
      this.y += nY * overlap;

      const dot = this.vx * nX + this.vy * nY;
      this.vx -= 2 * dot * nX;
      this.vy -= 2 * dot * nY;

      this.vx *= 0.6;
      this.vy *= 0.6;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius, this.radius * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function resolveEggCollisions() {
  for (let i = 0; i < eggs.length; i++) {
    for (let j = i + 1; j < eggs.length; j++) {
      const a = eggs[i];
      const b = eggs[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const minDist = a.radius + b.radius;

      if (dist < minDist) {
        const overlap = minDist - dist;

        const nx = dx / dist;
        const ny = dy / dist;

        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const relVx = b.vx - a.vx;
        const relVy = b.vy - a.vy;
        const relDot = relVx * nx + relVy * ny;

        const impulse = relDot * 0.5;

        a.vx += nx * impulse;
        a.vy += ny * impulse;
        b.vx -= nx * impulse;
        b.vy -= ny * impulse;

        a.vx *= 0.9;
        a.vy *= 0.9;
        b.vx *= 0.9;
        b.vy *= 0.9;
      }
    }
  }
}

function isFaceClicked(mx, my) {
  return (
    mx > faceX - faceWidth / 2 &&
    mx < faceX + faceWidth / 2 &&
    my > faceY - faceHeight / 2 &&
    my < faceY + faceHeight / 2
  );
}

function isFeetClicked(mx, my) {
  return (
    mx > feetX - feetWidth / 2 &&
    mx < feetX + feetWidth / 2 &&
    my > feetY - feetHeight / 2 &&
    my < feetY + feetHeight / 2
  );
}

let mouseX = 0;
let mouseY = 0;

function updateMouseFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = mx * scaleX;
  mouseY = my * scaleY;
}

canvas.addEventListener("mousemove", (e) => {
  updateMouseFromEvent(e);
  if (finished) {
    canvas.style.cursor = "default";
    return;
  }
  if (feetLoaded && isFeetClicked(mouseX, mouseY)) {
    canvas.style.cursor = "pointer";
  } else {
    canvas.style.cursor = "default";
  }
});

canvas.addEventListener("mousedown", (e) => {
  if (finished) return;
  updateMouseFromEvent(e);
  if (feetLoaded && isFeetClicked(mouseX, mouseY)) {
    isDropping = true;
  }
});

window.addEventListener("mouseup", () => {
  isDropping = false;
});

let introFade = 1;
let outroFade = 0;
const introSpeed = 0.9;
const outroSpeed = 0.8;
let fadeOutDelay = 2;
let fadeOutTimer = 0;

run(update);

function update(dt) {
  if (introFade > 0) {
    introFade = Math.max(0, introFade - dt / introSpeed);
  }

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  eggTimer += dt;
  if (isDropping && !finished && eggTimer >= EGG_INTERVAL) {
    eggTimer -= EGG_INTERVAL;

    const spawnX = zeroCenterX;
    const spawnY = -50;

    const newEgg = new Egg(spawnX, spawnY);
    newEgg.playSound();
    eggs.push(newEgg);
  }

  eggs.forEach((egg) => egg.update(dt));

  resolveEggCollisions();

  eggs.forEach((egg) => egg.draw(ctx));

  if (feetLoaded) {
    ctx.drawImage(
      feet,
      feetX - feetWidth / 2,
      feetY - feetHeight / 2,
      feetWidth,
      feetHeight
    );
  }
  if (faceLoaded) {
    ctx.drawImage(
      face,
      faceX - faceWidth / 2,
      faceY - faceHeight / 2,
      faceWidth,
      faceHeight
    );
  }

  if (!finished && eggs.length > 100) {
    finished = true;
    isDropping = false;
    canvas.style.cursor = "default";
    chickenSound.pause();
  }

  if (finished) {
    fadeOutTimer += dt;
    if (fadeOutTimer >= fadeOutDelay) {
      outroFade = Math.min(5, outroFade + dt / outroSpeed);
      if (outroFade >= 5) {
        chickenSound.pause();
        finish();
      }
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
