import { VerletPhysics } from "../_shared/verletPhysics.js";
import { dOutter, dInner } from "./svg.js";

// Shared physics instance for all falling objects
let sharedPhysics = null;
let sharedCtx = null;

// SVG collision settings
let svgOuterPath = null;
let svgInnerPath = null;
let svgScale = 1;
let svgOffsetX = 0;
let svgOffsetY = 0;
const svgOriginalSize = 500;

// Count of bodies inside the outer SVG
let bodiesInsideCount = 0;
let targetBodiesCount = 220; // Default target

// Mouse collision
let mouseX = 0;
let mouseY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseRadius = 50; // Collision radius of mouse
let isMouseMoving = false;

export function updateMousePosition(x, y) {
  lastMouseX = mouseX;
  lastMouseY = mouseY;
  mouseX = x;
  mouseY = y;
  isMouseMoving =
    Math.abs(x - lastMouseX) > 0.5 || Math.abs(y - lastMouseY) > 0.5;
}

export function setMouseRadius(radius) {
  mouseRadius = radius;
}

export function setTargetBodiesCount(count) {
  targetBodiesCount = count;
}

export function getBodiesInsideCount() {
  return bodiesInsideCount;
}

export function hasReachedTargetBodies() {
  return bodiesInsideCount >= targetBodiesCount;
}

export function initSvgCollision(ctx, imgGlobalSize, scale) {
  sharedCtx = ctx;
  svgScale = (imgGlobalSize * scale) / svgOriginalSize;
  svgOffsetX = ctx.canvas.width / 2 - (imgGlobalSize * scale) / 2;
  svgOffsetY = ctx.canvas.height / 2 - (imgGlobalSize * scale) / 2;

  if (dOutter) svgOuterPath = new Path2D(dOutter);
  if (dInner) svgInnerPath = new Path2D(dInner);
}

export function getSharedPhysics(ctx) {
  if (!sharedPhysics) {
    sharedPhysics = new VerletPhysics();
    /*
    sharedPhysics.bounds = {
      bottom: ctx.canvas.height,
      left: 0,
      right: ctx.canvas.width,
    };
    */
    sharedPhysics.gravityY = 500;
    sharedCtx = ctx;
  }
  return sharedPhysics;
}

function checkSvgCollision(body) {
  if (!sharedCtx) return;

  // Skip SVG collision if disabled for this body
  if (body.svgCollisionDisabled) return;

  // Transform body position to SVG coordinates
  const svgX = (body.positionX - svgOffsetX) / svgScale;
  const svgY = (body.positionY - svgOffsetY) / svgScale;

  const isInsideOuter =
    svgOuterPath && sharedCtx.isPointInPath(svgOuterPath, svgX, svgY);

  // Track if ball has ever been inside the outer shape
  if (isInsideOuter) {
    body.hasEnteredOuter = true;
  }

  // Check collision with outer path - only after ball has entered once
  if (body.hasEnteredOuter && !isInsideOuter) {
    // Ball left the outer SVG shape - push it back in
    const lastX = body.lastPositionX ?? body.positionX;
    const lastY = body.lastPositionY ?? body.positionY;

    body.positionX = lastX;
    body.positionY = lastY;
  }

  // Check collision with inner path - balls should stay OUTSIDE it (bounce off)
  if (svgInnerPath && sharedCtx.isPointInPath(svgInnerPath, svgX, svgY)) {
    // Ball entered the inner SVG shape - push it back out
    const lastX = body.lastPositionX ?? body.positionX;
    const lastY = body.lastPositionY ?? body.positionY;

    body.positionX = lastX;
    body.positionY = lastY;
  }
}

export function updateSharedPhysics() {
  if (sharedPhysics) {
    sharedPhysics.update(1 / 60);

    // Body-to-body collision
    const bodies = sharedPhysics.bodies;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];

        const dx = bodyB.positionX - bodyA.positionX;
        const dy = bodyB.positionY - bodyA.positionY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = bodyA.radius + bodyB.radius;

        if (distance < minDist && distance > 0) {
          const overlap = (minDist - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;

          bodyA.positionX -= overlap * nx;
          bodyA.positionY -= overlap * ny;
          bodyB.positionX += overlap * nx;
          bodyB.positionY += overlap * ny;
        }
      }
    }

    // Mouse collision - only when mouse is moving
    if (isMouseMoving) {
      for (const body of bodies) {
        const dx = body.positionX - mouseX;
        const dy = body.positionY - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = body.radius + mouseRadius;

        if (distance < minDist && distance > 0) {
          const overlap = minDist - distance;
          const nx = dx / distance;
          const ny = dy / distance;

          // Push the body away from the mouse with a soft, limited force
          const maxPush = 3; // Maximum push per frame
          const pushStrength = Math.min(overlap * 0.3, maxPush);
          body.positionX += pushStrength * nx;
          body.positionY += pushStrength * ny;
        }
      }
    }

    // SVG collision for each body and count bodies inside outer SVG
    bodiesInsideCount = 0;
    for (const body of bodies) {
      checkSvgCollision(body);

      // Count if body has entered and is currently inside outer SVG
      if (body.hasEnteredOuter && svgOuterPath && sharedCtx) {
        const svgX = (body.positionX - svgOffsetX) / svgScale;
        const svgY = (body.positionY - svgOffsetY) / svgScale;
        if (sharedCtx.isPointInPath(svgOuterPath, svgX, svgY)) {
          bodiesInsideCount++;
        }
      }
    }
  }
}

// Shared collision sound pool for optimization
const collisionSoundPool = [];
const POOL_SIZE = 5;
let lastCollisionTime = 0;
const COLLISION_COOLDOWN = 50; // ms between collision sounds

// Sound paths for randomization
const collisionSoundPaths = [
  "./assets/AUDIO/trash-impact.wav",
  "./assets/AUDIO/trash-impact2.wav",
  "./assets/AUDIO/trash-impact3.wav",
  "./assets/AUDIO/trash-impact4.wav",
];

// Initialize sound pool with random sounds
for (let i = 0; i < POOL_SIZE; i++) {
  const randomPath =
    collisionSoundPaths[Math.floor(Math.random() * collisionSoundPaths.length)];
  const sound = new Audio(randomPath);
  sound.volume = 0.3;
  collisionSoundPool.push(sound);
}

let currentSoundIndex = 0;

function playCollisionSound(intensity) {
  const now = Date.now();
  if (now - lastCollisionTime < COLLISION_COOLDOWN) return;

  const sound = collisionSoundPool[currentSoundIndex];
  // Randomize the sound source each time it's played
  sound.src =
    collisionSoundPaths[Math.floor(Math.random() * collisionSoundPaths.length)];
  sound.volume = Math.min(intensity * 0.1, 0.5);
  sound.currentTime = 0;
  sound.play().catch(() => {}); // Ignore autoplay errors

  currentSoundIndex = (currentSoundIndex + 1) % POOL_SIZE;
  lastCollisionTime = now;
}

export default class FallingObject {
  constructor(ctx, x, y, size, isATrashBag = true) {
    this.ctx = ctx;
    this.physics = getSharedPhysics(ctx);
    this.body = this.physics.createBody({
      positionX: x,
      positionY: y,
      radius: size / 2,
    });
    if (isATrashBag) {
      this.size = size;
    } else {
      this.size =
        this.ctx.canvas.width * 0.02 +
        Math.random() * (this.ctx.canvas.width * 0.005);
    }
    this.sizeOffset = Math.random() * (this.size * 1.2);
    this.color = "blue";
    this.sprite = null;
    this.randomSprite = this.getRandomSprite();
    this.isATrashBag = isATrashBag;
    this.rotation = Math.random() * Math.PI * 2; // Initial random rotation
    this.lastVelocity = 0;
  }
  update() {
    // Calculate rotation based on velocity
    const lastX = this.body.lastPositionX ?? this.body.positionX;
    const lastY = this.body.lastPositionY ?? this.body.positionY;
    const velocityX = this.body.positionX - lastX;
    const velocityY = this.body.positionY - lastY;
    const currentVelocity = Math.sqrt(
      velocityX * velocityX + velocityY * velocityY
    );

    // Add rotation based on horizontal velocity
    this.rotation += velocityX * 0.05;

    // Detect collision by sudden velocity change (deceleration)
    const velocityDrop = this.lastVelocity - currentVelocity;
    if (velocityDrop > 2) {
      playCollisionSound(velocityDrop);
    }
    this.lastVelocity = currentVelocity;

    // Physics is updated globally, just draw
    this.draw();
  }
  disableSvgCollision() {
    this.body.svgCollisionDisabled = true;
  }
  draw() {
    let scaleImg;
    if (this.isATrashBag) {
      scaleImg = this.size * 2 + this.sizeOffset;
    } else {
      scaleImg = this.size * 1;
    }
    this.sprite = new Image();

    if (this.isATrashBag) {
      this.sprite.src = `./assets/PNG/trashbag.png`;
    } else {
      this.sprite.src = `./assets/PNG/object${this.randomSprite}.png`;
    }
    //this.sprite.src = `./assets/PNG/test.png`;

    this.ctx.save();
    this.ctx.translate(this.body.positionX, this.body.positionY);
    this.ctx.rotate(this.rotation);
    this.ctx.drawImage(
      this.sprite,
      -scaleImg / 2,
      -scaleImg / 2,
      scaleImg,
      scaleImg
    );
    this.ctx.restore();
  }
  getRandomSprite() {
    const max = 7;
    const rand = Math.floor(Math.random() * max);
    return rand + 1;
  }
}
