import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;
run(update);

// Load SVG images
const giftImg = new Image();
giftImg.src = "gift.svg";
const zeroImg = new Image();
zeroImg.src = "zero.svg";

// Load SVG for green squares
// To change the SVG: replace "square1.svg", "square2.svg", etc. with your own SVG files
// You can use any number of different SVGs - they'll be randomly assigned to squares
const squareSVGs = ["ball.svg", "heart.svg", "snow.svg", "star.svg"];

const squareImages = [];
squareSVGs.forEach((src, index) => {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    console.log(`Square SVG ${index + 1} loaded`);
  };
  img.onerror = () => {
    console.log(`Square SVG ${index + 1} not found, using fallback`);
  };
  squareImages.push(img);
});

let imagesLoaded = 0;
const totalImages = 2;

giftImg.onload = () => {
  imagesLoaded++;
  console.log("Gift SVG loaded");
};
giftImg.onerror = () => {
  console.log("Gift SVG not found, using fallback");
  imagesLoaded++;
};

zeroImg.onload = () => {
  imagesLoaded++;
  console.log("Zero SVG loaded");
};
zeroImg.onerror = () => {
  console.log("Zero SVG not found, using fallback");
  imagesLoaded++;
};

// Load open sound effect
// To change the sound: replace "pop.mp3" with your own audio file
// Supported formats: .mp3, .wav, .ogg
const openSound = new Audio();
openSound.src = "pop.mp3";
openSound.volume = 0.5;
openSound.onerror = () => {
  console.log("Open sound not found, will play silently");
};

// Load fall sound effect
// To change the sound: replace "fall.mp3" with your own audio file
// Supported formats: .mp3, .wav, .ogg
const fallSound = new Audio();
fallSound.src = "whistle.mp3";
fallSound.volume = 0.7;
fallSound.onerror = () => {
  console.log("Fall sound not found, will play silently");
};

const spring = new Spring({
  position: 0,
});

const settings1 = createSpringSettings({
  frequency: 3.5,
  halfLife: 0.05,
});

// Gift object
class Gift {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationVel = 0;
    this.baseScale = 1.5; // Base scale for all gifts
    this.scale = 1.5; // Current scale (animated)
    this.targetScale = 1.5; // Target scale for smooth animation
    this.size = 100; // Default size for collision, will be updated when SVG loads
    this.color = this.randomColor();
    this.isDragging = false;
    this.isOpen = false;
    this.hasZero = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastX = x;
    this.lastY = y;
    this.shakeAmount = 0;
    this.shakeCount = 0;
    this.lastDir = null;
    this.openProgress = 0;
    this.isFalling = false;
    this.lastShakeThreshold = 0; // Track when we last played shake sound
  }

  randomColor() {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E2",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  playShakeSound() {
    try {
      // Clone the audio to allow overlapping sounds
      const sound = shakeSound.cloneNode();
      sound.volume = shakeSound.volume;
      sound.play().catch((err) => {
        // Silently fail if audio can't play (e.g., browser autoplay policy)
      });
    } catch (err) {
      // Silently fail if cloning fails
    }
  }

  playOpenSound() {
    try {
      // Clone the audio to allow overlapping sounds
      const sound = openSound.cloneNode();
      sound.volume = openSound.volume;
      sound.play().catch((err) => {
        // Silently fail if audio can't play (e.g., browser autoplay policy)
      });
    } catch (err) {
      // Silently fail if cloning fails
    }
  }

  update(dt, mouseX, mouseY, isPressed) {
    // Smoothly animate scale towards target
    this.scale += (this.targetScale - this.scale) * 10 * dt;

    // If falling, just fall (for unopened gifts)
    if (this.isFalling) {
      this.vy += 3000 * dt;
      // Add more wobble
      this.rotationVel += (Math.random() - 0.5) * 15 * dt;
      this.vx += (Math.random() - 0.5) * 500 * dt;
    }
    this.lastDir = null;
    this.shakeCount = 0;
    this.lastShakeThreshold = 0; // Reset when not dragging

    if (this.isDragging) {
      const springForce = 100;
      const springDamping = 1;
      this.vx += (mouseX - this.x) * springForce - this.vx * springDamping;
      this.vy += (mouseY - this.y) * springForce - this.vy * springDamping;
    }

    this.vy += 4000 * dt;
    this.vx *= 0.999;
    this.vy *= 0.999;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotationVel * dt;
    this.rotationVel *= 0.95;

    if (!this.isFalling) {
      if (this.y > canvas.height - this.size / 2) {
        this.y = canvas.height - this.size / 2;
        this.vy *= -0.6;
        this.vx *= 0.8;
        this.rotationVel *= 0.8;
      }
      if (this.x < this.size / 2) {
        this.x = this.size / 2;
        this.vx *= -0.6;
      }
      if (this.x > canvas.width - this.size / 2) {
        this.x = canvas.width - this.size / 2;
        this.vx *= -0.6;
      }

      if (this.y < this.size / 2) {
        this.y = this.size / 2;
        this.vy *= -0.6;
      }
    }

    if (this.isDragging) {
      const dx = this.vx;
      const dy = this.vy;
      const movement = Math.sqrt(dx * dx + dy * dy);

      const currentDir = Math.atan2(dy, dx);

      if (movement > 10) {
        if (this.lastDir !== null) {
          let dirDiff = Math.abs(currentDir - this.lastDir);
          if (dirDiff > Math.PI) dirDiff = Math.PI * 2 - dirDiff;

          if (dirDiff > Math.PI * 0.5) {
            this.shakeAmount += movement * 2;
            this.shakeCount++;

            // Play sound every 150 shake amount (roughly every good shake)
            if (Math.floor(this.shakeAmount / 150) > this.lastShakeThreshold) {
              this.lastShakeThreshold = Math.floor(this.shakeAmount / 150);
              this.playShakeSound();
            }
          }
        }
        this.lastDir = currentDir;
      }

      if (movement > 10 && this.shakeAmount > 500) {
        this.rotation += (Math.random() - 0.5) * 0.5;
      }
    }
  }

  startDrag(mouseX, mouseY) {
    this.isDragging = true;
    this.targetScale = this.baseScale * 1.2; // Make it 15% bigger when dragging
    this.dragStartX = mouseX;
    this.dragStartY = mouseY;
    this.lastX = this.x;
    this.lastY = this.y;
    this.shakeAmount = 0;
    this.lastShakeThreshold = 0;
    this.vx = 0;
    this.vy = 0;
  }

  endDrag(mouseX, mouseY) {
    this.isDragging = false;
    this.targetScale = this.baseScale; // Return to normal size
    this.rotationVel = (mouseX - this.dragStartX) * 0.05;
    this.isOpen = true;
    this.playOpenSound(); // Play sound when gift opens
  }

  isMouseOver(mouseX, mouseY) {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this.size / 2;
  }

  draw(ctx) {
    if (this.isOpen && !this.hasZero) {
      const alpha = 1 - this.openProgress;
      if (alpha <= 0) return;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // Draw one green rounded square as the gift disappears
      const squareSize = this.size * 0.5;
      const cornerRadius = 10;

      ctx.fillStyle = "#4CAF50";
      this.drawRoundedRect(
        ctx,
        -squareSize / 2,
        -squareSize / 2,
        squareSize,
        squareSize,
        cornerRadius
      );

      ctx.restore();
      return;
    }

    if (this.isOpen && this.hasZero) {
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (giftImg.complete && giftImg.naturalWidth > 0) {
      // Use natural SVG proportions
      const w = giftImg.width * this.scale;
      const h = giftImg.height * this.scale;
      ctx.drawImage(giftImg, -w / 2, -h / 2, w, h);

      // Update size for collision detection (use average of width/height)
      this.size = (w + h) / 2;
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      const ribbonWidth = this.size * 0.2;
      ctx.fillRect(-ribbonWidth / 2, -this.size / 2, ribbonWidth, this.size);
      ctx.fillRect(-this.size / 2, -ribbonWidth / 2, this.size, ribbonWidth);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(-this.size / 4, -this.size / 4, this.size / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.size / 4, -this.size / 4, this.size / 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Green square class for opened gifts
class GreenSquare {
  constructor(x, y, offsetX, offsetY, size) {
    this.x = x + offsetX;
    this.y = y + offsetY;
    this.vx = 0;
    this.vy = 0;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationVel = 0;
    this.size = size;
    this.isDragging = false;
    this.scale = 1;
    this.targetScale = 1;
    this.isFalling = false;
    // Randomly assign one of the square SVGs
    this.svgImage =
      squareImages[Math.floor(Math.random() * squareImages.length)];
  }

  update(dt, mouseX, mouseY) {
    this.scale += (this.targetScale - this.scale) * 10 * dt;

    if (this.isFalling) {
      this.vy += 3000 * dt;
      this.rotationVel += (Math.random() - 0.5) * 15 * dt;
      this.vx += (Math.random() - 0.5) * 500 * dt;
    }

    if (this.isDragging) {
      const springForce = 100;
      const springDamping = 1;
      this.vx += (mouseX - this.x) * springForce - this.vx * springDamping;
      this.vy += (mouseY - this.y) * springForce - this.vy * springDamping;
    }

    this.vy += 4000 * dt;
    this.vx *= 0.999;
    this.vy *= 0.999;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotationVel * dt;
    this.rotationVel *= 0.95;

    if (!this.isFalling) {
      if (this.y > canvas.height - this.size / 2) {
        this.y = canvas.height - this.size / 2;
        this.vy *= -0.6;
        this.vx *= 0.8;
        this.rotationVel *= 0.8;
      }
      if (this.x < this.size / 2) {
        this.x = this.size / 2;
        this.vx *= -0.6;
      }
      if (this.x > canvas.width - this.size / 2) {
        this.x = canvas.width - this.size / 2;
        this.vx *= -0.6;
      }
      if (this.y < this.size / 2) {
        this.y = this.size / 2;
        this.vy *= -0.6;
      }
    }
  }

  startDrag() {
    this.isDragging = true;
    this.targetScale = 1.2;
    this.vx = 0;
    this.vy = 0;
  }

  endDrag() {
    this.isDragging = false;
    this.targetScale = 1;
  }

  isMouseOver(mouseX, mouseY) {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this.size / 2;
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);

    // Try to draw SVG if loaded, otherwise use fallback green square
    if (
      this.svgImage &&
      this.svgImage.complete &&
      this.svgImage.naturalWidth > 0
    ) {
      // Use natural SVG proportions
      const w = this.svgImage.width;
      const h = this.svgImage.height;
      const aspectRatio = w / h;

      let drawW, drawH;
      if (aspectRatio > 1) {
        drawW = this.size;
        drawH = this.size / aspectRatio;
      } else {
        drawH = this.size;
        drawW = this.size * aspectRatio;
      }

      ctx.drawImage(this.svgImage, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      // Fallback: green rounded square
      ctx.fillStyle = "#16db2e";
      const cornerRadius = 10;
      this.drawRoundedRect(
        ctx,
        -this.size / 2,
        -this.size / 2,
        this.size,
        this.size,
        cornerRadius
      );
    }

    ctx.restore();
  }
}

const gifts = [];
const greenSquares = [];
const numGifts = 15;
const specialGiftIndex = Math.floor(Math.random() * numGifts);

for (let i = 0; i < numGifts; i++) {
  const x = Math.random() * canvas.width;
  const y = canvas.height - 100 - Math.random() * 300;
  const gift = new Gift(x, y);
  if (i === specialGiftIndex) {
    gift.hasZero = true;
    gift.color = "#FFD700";
  }
  gifts.push(gift);
}

let draggedGift = null;
let draggedSquare = null;
let zeroRevealed = false;
let zeroScale = 0;
let zeroRevealTime = 0;
let fallAnimationStarted = false;
let zeroY = 0;
let zeroVY = 0;
let zeroRotation = 0;
let zeroRotationVel = 0;
let zeroX = 0;
let zeroVX = 0;

function playFallSound() {
  try {
    const sound = fallSound.cloneNode();
    sound.volume = fallSound.volume;
    sound.play().catch((err) => {
      // Silently fail if audio can't play
    });
  } catch (err) {
    // Silently fail if cloning fails
  }
}

function update(dt) {
  const mouseX = input.getX();
  const mouseY = input.getY();
  const isPressed = input.isPressed();

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Handle drag start
  if (isPressed && !draggedGift && !draggedSquare) {
    // Check green squares first (on top)
    for (let i = greenSquares.length - 1; i >= 0; i--) {
      if (greenSquares[i].isMouseOver(mouseX, mouseY)) {
        draggedSquare = greenSquares[i];
        draggedSquare.startDrag();
        break;
      }
    }

    // If no square was clicked, check gifts
    if (!draggedSquare) {
      for (let i = gifts.length - 1; i >= 0; i--) {
        if (!gifts[i].isOpen && gifts[i].isMouseOver(mouseX, mouseY)) {
          draggedGift = gifts[i];
          draggedGift.startDrag(mouseX, mouseY);
          break;
        }
      }
    }
  }

  // Handle drag end
  if (!isPressed) {
    if (draggedGift) {
      draggedGift.endDrag(mouseX, mouseY);
      draggedGift = null;
    }
    if (draggedSquare) {
      draggedSquare.endDrag();
      draggedSquare = null;
    }
  }

  // Update gifts
  for (const gift of gifts) {
    gift.update(dt, mouseX, mouseY, isPressed);

    // Create one green square when gift opens (non-zero gifts only)
    if (gift.isOpen && !gift.hasZero && gift.openProgress === 0) {
      gift.openProgress = 0.01; // Mark as processed
      const squareSize = gift.size * 0.8;
      greenSquares.push(new GreenSquare(gift.x, gift.y, 0, 0, squareSize));
    }
  }

  // Update green squares
  for (const square of greenSquares) {
    square.update(dt, mouseX, mouseY);
  }

  // Gift-to-gift collisions
  for (let i = 0; i < gifts.length; i++) {
    for (let j = i + 1; j < gifts.length; j++) {
      const g1 = gifts[i];
      const g2 = gifts[j];

      if (g1.isFalling || g2.isFalling) continue;

      const dx = g2.x - g1.x;
      const dy = g2.y - g1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = (g1.size + g2.size) / 2;

      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const force = g1.isDragging || g2.isDragging ? 0.6 : 0.3;

        if (!g1.isDragging) {
          g1.x -= nx * overlap * force;
          g1.y -= ny * overlap * force;
          g1.vx -= nx * 200 * (g2.isDragging ? 2 : 1);
          g1.vy -= ny * 200 * (g2.isDragging ? 2 : 1);
          g1.rotationVel += (Math.random() - 0.5) * 5;
        }

        if (!g2.isDragging) {
          g2.x += nx * overlap * force;
          g2.y += ny * overlap * force;
          g2.vx += nx * 200 * (g1.isDragging ? 2 : 1);
          g2.vy += ny * 200 * (g1.isDragging ? 2 : 1);
          g2.rotationVel += (Math.random() - 0.5) * 5;
        }
      }
    }
  }

  // Square-to-square collisions
  for (let i = 0; i < greenSquares.length; i++) {
    for (let j = i + 1; j < greenSquares.length; j++) {
      const s1 = greenSquares[i];
      const s2 = greenSquares[j];

      if (s1.isFalling || s2.isFalling) continue;

      const dx = s2.x - s1.x;
      const dy = s2.y - s1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = (s1.size + s2.size) / 2;

      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const force = s1.isDragging || s2.isDragging ? 0.6 : 0.3;

        if (!s1.isDragging) {
          s1.x -= nx * overlap * force;
          s1.y -= ny * overlap * force;
          s1.vx -= nx * 200 * (s2.isDragging ? 2 : 1);
          s1.vy -= ny * 200 * (s2.isDragging ? 2 : 1);
          s1.rotationVel += (Math.random() - 0.5) * 5;
        }

        if (!s2.isDragging) {
          s2.x += nx * overlap * force;
          s2.y += ny * overlap * force;
          s2.vx += nx * 200 * (s1.isDragging ? 2 : 1);
          s2.vy += ny * 200 * (s1.isDragging ? 2 : 1);
          s2.rotationVel += (Math.random() - 0.5) * 5;
        }
      }
    }
  }

  // Square-to-gift collisions
  for (const square of greenSquares) {
    for (const gift of gifts) {
      if (square.isFalling || gift.isFalling || gift.isOpen) continue;

      const dx = gift.x - square.x;
      const dy = gift.y - square.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = (square.size + gift.size) / 2;

      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const force = square.isDragging || gift.isDragging ? 0.6 : 0.3;

        if (!square.isDragging) {
          square.x -= nx * overlap * force;
          square.y -= ny * overlap * force;
          square.vx -= nx * 200 * (gift.isDragging ? 2 : 1);
          square.vy -= ny * 200 * (gift.isDragging ? 2 : 1);
          square.rotationVel += (Math.random() - 0.5) * 5;
        }

        if (!gift.isDragging) {
          gift.x += nx * overlap * force;
          gift.y += ny * overlap * force;
          gift.vx += nx * 200 * (square.isDragging ? 2 : 1);
          gift.vy += ny * 200 * (square.isDragging ? 2 : 1);
          gift.rotationVel += (Math.random() - 0.5) * 5;
        }
      }
    }
  }

  // Check for zero reveal
  for (const gift of gifts) {
    if (gift.isOpen && gift.hasZero && !zeroRevealed) {
      zeroRevealed = true;
      zeroRevealTime = 0;
      spring.target = 1;
      spring.settings = settings1;
    }
  }

  // Draw everything (non-dragged items first)
  for (const gift of gifts) {
    if (gift !== draggedGift && !gift.isOpen) {
      gift.draw(ctx);
    }
  }

  for (const square of greenSquares) {
    if (square !== draggedSquare) {
      square.draw(ctx);
    }
  }

  // Draw dragged items on top
  if (draggedGift) {
    draggedGift.draw(ctx);
  }
  if (draggedSquare) {
    draggedSquare.draw(ctx);
  }

  // Handle zero reveal and falling animation
  if (zeroRevealed) {
    zeroRevealTime += dt;
    spring.step(dt);
    zeroScale = Math.max(spring.position, 0);

    if (zeroRevealTime >= 2.0 && !fallAnimationStarted) {
      fallAnimationStarted = true;

      // Play the fall sound when everything starts falling
      playFallSound();

      for (const gift of gifts) {
        gift.isFalling = true;
        gift.vy = Math.random() * 400 - 200;
        gift.vx = Math.random() * 800 - 400;
        gift.rotationVel = Math.random() * 20 - 10;
      }
      for (const square of greenSquares) {
        square.isFalling = true;
        square.vy = Math.random() * 400 - 200;
        square.vx = Math.random() * 800 - 400;
        square.rotationVel = Math.random() * 20 - 10;
      }
      zeroVY = Math.random() * 200 - 100;
      zeroVX = Math.random() * 400 - 200;
      zeroRotationVel = Math.random() * 8 - 4;
    }

    if (fallAnimationStarted) {
      zeroVY += 3000 * dt;
      zeroY += zeroVY * dt;
      zeroX += zeroVX * dt;
      zeroRotation += zeroRotationVel * dt;
      zeroRotationVel += (Math.random() - 0.5) * 12 * dt;
    }

    const x = canvas.width / 2 + zeroX;
    const y = canvas.height / 2 + zeroY;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(zeroRotation);
    ctx.scale(zeroScale, zeroScale);

    if (zeroImg.complete && zeroImg.naturalWidth > 0) {
      const maxSize = canvas.height * 0.5;
      const aspectRatio = zeroImg.width / zeroImg.height;
      let w, h;

      if (aspectRatio > 1) {
        w = maxSize;
        h = maxSize / aspectRatio;
      } else {
        h = maxSize;
        w = maxSize * aspectRatio;
      }

      ctx.drawImage(zeroImg, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = "white";
      ctx.textBaseline = "middle";
      ctx.font = `${canvas.height}px Helvetica Neue, Helvetica, bold`;
      ctx.textAlign = "center";
      ctx.fillText("0", 0, 0);
    }

    ctx.restore();

    if (zeroScale >= 0.98 && zeroRevealTime >= 4.0) {
      setTimeout(() => finish(), 500);
    }
  }
}
